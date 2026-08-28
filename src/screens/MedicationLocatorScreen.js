import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { CameraView } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import CameraPermissionGate from '../components/CameraPermissionGate'
import Button from '../components/Button'
import { verifyCassette, dispenseMedications } from '../api'
import { normalizeQrValue } from '../utils/qr'
import {
  getBoxRect,
  matchesSlot,
  groupMedicationsByCassetteQr,
  matchesCassetteQr,
  isTargetCassette,
} from '../utils/medicationLocatorLogic'
import { CAMERA_FACING, QR_BARCODE_TYPES } from '../constants/camera'
import { MEAL_LABELS } from '../constants/meals'
import { colors, radius } from '../constants/theme'

// expo-camera's onBarcodeScanned reports ONE result per native event — confirmed
// against the installed version (expo-camera 17.0.10 / Expo SDK 54) three ways:
//   1. Camera.types.d.ts: `onBarcodeScanned?: (scanningResult: BarcodeScanningResult) => void`
//      — a single flat object, not an array.
//   2. Android (BarcodeAnalyzer.kt): MLKit's `barcodeScanner.process(image)` DOES
//      return every code visible in the analyzed frame, but expo-camera explicitly
//      takes only `barcodes.first()` before forwarding to JS — the rest are dropped
//      natively, one event per analyzed frame (~15-30/s).
//   3. iOS (MetaDataDelegate.swift): the AVFoundation delegate loops over every
//      detected `AVMetadataObject` and fires the JS callback once per code, back
//      to back within the same frame — so multiple codes DO each get reported,
//      just as separate rapid-fire single-result events rather than a batch.
// Net effect on both platforms: JS never receives "here are the 3 codes visible
// right now" in one shot. To know that, this screen has to accumulate individual
// reports over a short rolling window and infer what's currently in frame from
// which codes were seen recently vs. not.
//
// Two stages: first confirm the physical drawer (qr_code_slot printed on the cart
// drawer's acrylic label) before hunting for the right medication cassette inside
// it — matches how the cart is actually organized (one drawer per patient, several
// cassettes inside). Patients created before drawer QRs existed skip straight to
// the cassette stage.
const RESCAN_COOLDOWN_MS = 1500
// onBarcodeScanned has no "lost sight of this code" event, so each tracked code
// is dropped from the "currently visible" set if it hasn't been re-reported
// within this window — checked every PRUNE_INTERVAL_MS.
const BOX_LOST_TIMEOUT_MS = 500
const PRUNE_INTERVAL_MS = 150

const TARGET_COLOR = '#22c55e'

// What a given QR value means right now, for whichever stage is active — used
// to label/color each box when several codes are visible at once. Purely
// derived from current props/state each render, so it can't go stale even if
// the target medication or patient changes while a code stays in frame.
function resolveCodeIdentity({ stage, data, patient, cassetteMedicationsByQr, targetMedication }) {
  if (stage === 'slot') {
    if (data === patient.qr_code_slot) {
      return { label: 'ช่องนี้', color: TARGET_COLOR }
    }
    return { label: 'ไม่ใช่ช่องนี้', color: colors.muted }
  }

  const meds = cassetteMedicationsByQr[data]
  if (!meds || meds.length === 0) {
    return { label: 'ไม่รู้จัก', color: colors.muted }
  }
  const label = meds.length === 1 ? meds[0].drug_name : `${meds[0].drug_name} +${meds.length - 1}`
  return { label, color: isTargetCassette(data, targetMedication) ? TARGET_COLOR : colors.accent }
}

function StageBadge({ stage, hasSlotStage }) {
  if (!hasSlotStage) return null
  return (
    <View style={styles.stageBadge}>
      <Text style={styles.stageBadgeText}>
        {stage === 'slot' ? 'ขั้นที่ 1/2 · หาลิ้นชัก' : 'ขั้นที่ 2/2 · หาตลับยา'}
      </Text>
    </View>
  )
}

// Idle state before any code has been seen yet — a generic centered reticle.
function ScanReticle() {
  return (
    <View style={styles.reticleWrap} pointerEvents="none">
      <View style={styles.reticleBox}>
        <View style={[styles.corner, styles.cornerTL, { borderColor: colors.accent }]} />
        <View style={[styles.corner, styles.cornerTR, { borderColor: colors.accent }]} />
        <View style={[styles.corner, styles.cornerBL, { borderColor: colors.accent }]} />
        <View style={[styles.corner, styles.cornerBR, { borderColor: colors.accent }]} />
      </View>
    </View>
  )
}

// Single-code case (the common one): only ever rendered once that one code is
// confirmed as the target — sits directly over its real position. Wrong/
// unrecognized codes don't get a box at all, so the camera view only ever
// "focuses" on a hit. No tap needed here — this is the fast auto-lock path.
function ScanHighlightBox({ rect }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.highlightBox,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderColor: TARGET_COLOR },
      ]}
    />
  )
}

// Multi-code case: several QR values are all currently in frame at once (e.g.
// the nurse pulled back to see the whole cart). Auto-locking onto whichever one
// the camera happened to report first is exactly the bug this fixes — instead,
// box + label every code that's currently visible and let the nurse tap the one
// they actually mean.
function MultiScanOverlay({ codes, identityFor, onSelect }) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {codes.map(({ data, rect }) => {
        const identity = identityFor(data)
        const labelTop = Math.max(rect.y - 24, 4)
        const labelLeft = Math.max(rect.x, 4)
        return (
          <View key={data} style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            <Pressable
              onPress={() => onSelect(data)}
              hitSlop={10}
              style={[
                styles.multiBox,
                { left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderColor: identity.color },
              ]}
            />
            <View
              pointerEvents="none"
              style={[styles.multiBoxLabel, { left: labelLeft, top: labelTop, backgroundColor: identity.color }]}
            >
              <Text style={styles.multiBoxLabelText} numberOfLines={1}>
                {identity.label}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

function MultiScanBanner({ count }) {
  return (
    <View style={styles.multiBanner} pointerEvents="none">
      <Ionicons name="hand-left" size={14} color="#fff" />
      <Text style={styles.multiBannerText}>พบ QR {count} ดวง — แตะเลือกดวงที่ต้องการ</Text>
    </View>
  )
}

function SlotTargetPanel({ patient }) {
  return (
    <View style={styles.targetPanel} pointerEvents="box-none">
      <View style={styles.targetCard}>
        <Text style={styles.targetEyebrow}>กำลังหาลิ้นชักให้คุณ</Text>
        <Text style={styles.targetName} numberOfLines={1}>
          {patient.slot_no ? `ช่องที่ ${patient.slot_no}` : 'ลิ้นชัก'} — {patient.full_name}
        </Text>
        <Text style={styles.targetProgress}>ส่อง QR บนป้ายลิ้นชักเพื่อยืนยันว่าเปิดถูกช่อง</Text>
      </View>
    </View>
  )
}

// Shown once the scanned drawer matches this patient's slot — holds the screen
// here (no auto-advance) so the nurse can actually read the slot number and
// confirm it's the right person before looking away to open the drawer.
//
// The slot number is the whole point of this card: a nurse glances at it, then
// looks away from the phone to physically reach for the drawer — if the number
// isn't the first and biggest thing on screen, they forget it mid-reach and
// open the wrong one. It's rendered as a large solid badge, sized well above
// the patient name, before anything else in reading order.
//
// The backdrop is anchored to the bottom (bottom-sheet style) instead of
// covering the full screen — the drawer the nurse just scanned is usually
// still centered in the upper/middle part of the camera view, so leaving that
// area only lightly dimmed (not fully blacked out) lets them keep visual
// contact with it while reading the card, instead of losing their place
// entirely behind an opaque full-screen backdrop.
function SlotConfirmModal({ patient, onConfirm }) {
  return (
    <View style={styles.modalBackdrop} pointerEvents="box-none">
      <View style={styles.modalCard}>
        <View style={styles.modalHeaderRow}>
          <Ionicons name="checkmark-circle" size={18} color={TARGET_COLOR} />
          <Text style={styles.modalEyebrow}>เจอลิ้นชักแล้ว</Text>
        </View>

        {!!patient.slot_no && (
          <View style={styles.slotBadge}>
            <Text style={styles.slotBadgeLabel}>ช่องที่</Text>
            <Text style={styles.slotBadgeNumber}>{patient.slot_no}</Text>
          </View>
        )}

        <Text style={styles.modalPatientName} numberOfLines={2}>
          {patient.full_name}
        </Text>
        {(!!patient.bed_no || !!patient.ward) && (
          <Text style={styles.modalSub}>
            {patient.ward ? patient.ward : ''}
            {patient.ward && patient.bed_no ? ' · ' : ''}
            {patient.bed_no ? `เตียง ${patient.bed_no}` : ''}
          </Text>
        )}
        <Pressable style={styles.modalButton} onPress={onConfirm}>
          <Text style={styles.modalButtonText}>ไปหน้าจ่ายยา</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  )
}

function CassetteTargetPanel({ targetMedication, query, onChangeQuery, verifying, totalCount }) {
  return (
    <View style={styles.targetPanel} pointerEvents="box-none">
      <View style={styles.targetCard}>
        <Text style={styles.targetEyebrow}>{verifying ? 'กำลังตรวจสอบตลับยา...' : 'กำลังหาให้คุณ'}</Text>
        {targetMedication ? (
          <Text style={styles.targetName} numberOfLines={1}>
            {targetMedication.drug_name}
            {targetMedication.standard_dose ? ` ${targetMedication.standard_dose}` : ''}
            {' '}· มื้อ{MEAL_LABELS[targetMedication.meal]}
          </Text>
        ) : (
          <Text style={styles.targetName}>จ่ายยาครบทุกรายการแล้ว</Text>
        )}
        {!!totalCount && <Text style={styles.targetProgress}>เหลืออีก {totalCount} รายการ</Text>}
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={14} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="หายาตัวอื่นแทน พิมพ์ชื่อยา"
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={onChangeQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!query && (
          <Pressable onPress={() => onChangeQuery('')} hitSlop={10}>
            <Ionicons name="close" size={15} color="#888" />
          </Pressable>
        )}
      </View>
    </View>
  )
}

function ScanFeedback({ feedback }) {
  if (!feedback) return null

  const isTarget = feedback.status === 'target'
  const isWrong = feedback.status === 'wrong'

  return (
    <View
      style={[
        styles.feedbackCard,
        isTarget ? styles.feedbackTarget : isWrong ? styles.feedbackWrong : styles.feedbackUnknown,
      ]}
    >
      <Ionicons
        name={isTarget ? 'checkmark-circle' : isWrong ? 'close-circle' : 'help-circle'}
        size={22}
        color="#fff"
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.feedbackTitle}>{feedback.title}</Text>
        {!!feedback.sub && <Text style={styles.feedbackSub}>{feedback.sub}</Text>}
      </View>
    </View>
  )
}

// Shown once a cassette QR resolves - the drug list is always the fresh copy
// verify-cassette just returned (never decoded from the QR itself), so this
// modal is the one place in the flow that can show more than one drug at
// once. Each row is independently checkable, plus a one-tap "confirm all"
// shortcut, per the 5-rights-of-administration + partial-dispense reasoning
// (a nurse may only have some of a meal's drugs on hand right now).
function CassetteChecklistModal({ cassette, checkedIds, dispensingIds, onToggle, onConfirmSelected, onConfirmAll, onClose }) {
  const pending = cassette.medications.filter((m) => !m.is_dispensed_today)
  const allDone = pending.length === 0
  const isDispensing = dispensingIds.size > 0

  return (
    <View style={styles.modalBackdrop} pointerEvents="box-none">
      <View style={styles.modalCard}>
        <View style={styles.modalHeaderRow}>
          <Ionicons name="checkmark-circle" size={18} color={TARGET_COLOR} />
          <Text style={styles.modalEyebrow}>มื้อ{MEAL_LABELS[cassette.meal]}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView style={styles.checklistScroll} contentContainerStyle={styles.checklistScrollContent}>
          {cassette.medications.map((med) => {
            const isDispensed = !!med.is_dispensed_today
            const isChecked = checkedIds.has(med.order_id)
            const isBusy = dispensingIds.has(med.order_id)
            return (
              <Pressable
                key={med.order_id}
                style={[styles.checklistRow, isDispensed && styles.checklistRowDone]}
                onPress={() => !isDispensed && !isBusy && onToggle(med.order_id)}
                disabled={isDispensed || isBusy}
              >
                <Ionicons
                  name={isDispensed ? 'checkmark-circle' : isChecked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isDispensed ? colors.success : isChecked ? colors.accent : colors.muted}
                />
                <View style={styles.checklistRowText}>
                  <Text style={[styles.checklistDrugName, isDispensed && styles.checklistDrugNameDone]} numberOfLines={1}>
                    {med.drug_name}
                    {med.standard_dose ? ` ${med.standard_dose}` : ''}
                  </Text>
                  {!!(med.dose || med.instruction) && (
                    <Text style={styles.checklistDrugMeta} numberOfLines={1}>
                      {[med.dose, med.instruction].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
                {isDispensed && <Text style={styles.checklistDoneLabel}>จ่ายแล้ว</Text>}
                {isBusy && <Ionicons name="hourglass-outline" size={16} color={colors.muted} />}
              </Pressable>
            )
          })}
        </ScrollView>

        {allDone ? (
          <Pressable style={styles.modalButton} onPress={onClose}>
            <Text style={styles.modalButtonText}>เสร็จสิ้นมื้อนี้</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.checklistActions}>
            <Pressable
              style={[styles.modalButtonOutline, (checkedIds.size === 0 || isDispensing) && styles.modalButtonDisabled]}
              onPress={onConfirmSelected}
              disabled={checkedIds.size === 0 || isDispensing}
            >
              <Text style={styles.modalButtonOutlineText}>
                ยืนยันที่เลือก{checkedIds.size > 0 ? ` (${checkedIds.size})` : ''}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.checklistConfirmAllButton, isDispensing && styles.modalButtonDisabled]}
              onPress={onConfirmAll}
              disabled={isDispensing}
            >
              <Text style={styles.modalButtonText}>ยืนยันทั้งหมด</Text>
              <Ionicons name="checkmark-done" size={16} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  )
}

export default function MedicationLocatorScreen({ nurse, patient, medications, onDispensed }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const hasSlotStage = !!patient.qr_code_slot
  const [stage, setStage] = useState(hasSlotStage ? 'slot' : 'cassette')
  const [query, setQuery] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [slotConfirmed, setSlotConfirmed] = useState(false)
  // Mirrors codesMapRef for rendering: every QR code currently believed to be
  // in frame, each with its own on-screen position.
  const [visibleCodes, setVisibleCodes] = useState([]) // [{ data, rect }]
  // The cassette a scan just resolved to, via verify-cassette - always the
  // fresh server copy (never decoded from the QR itself), since the whole
  // point of the meal-cassette design is that a cassette's drug list can
  // change without its QR being reprinted. null while no cassette is open.
  const [scannedCassette, setScannedCassette] = useState(null) // { qrCode, cassetteId, meal, medications }
  const [verifyingCassette, setVerifyingCassette] = useState(false)
  const [checkedIds, setCheckedIds] = useState(() => new Set())
  const [dispensingIds, setDispensingIds] = useState(() => new Set())
  // Local, optimistically-updated copy so the target can advance to the next
  // due medication right after a dispense, without waiting on a server refetch —
  // the parent still gets the authoritative reload once the nurse exits this screen.
  const [localMedications, setLocalMedications] = useState(medications)
  const busyRef = useRef(false)
  // data -> { rect, lastSeenAt } for every code reported recently. Rebuilt into
  // visibleCodes state on every change; pruned on an interval since there's no
  // native "lost sight of this code" event to react to.
  const codesMapRef = useRef(new Map())
  // data -> timestamp last dispatched to handleSlotScan/handleCassetteScan.
  // Per-code now (not a single {data, at} pair) since several codes can be
  // live at once and each needs its own independent cooldown.
  const lastProcessedRef = useRef(new Map())

  const pendingMedications = useMemo(
    () => localMedications.filter((item) => !item.is_dispensed_today),
    [localMedications]
  )

  const targetMedication = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      return pendingMedications.find((item) => item.drug_name.toLowerCase().includes(q)) || null
    }
    return pendingMedications.find((item) => item.is_due) || pendingMedications[0] || null
  }, [pendingMedications, query])

  const cassetteMedicationsByQr = useMemo(
    () => groupMedicationsByCassetteQr(localMedications),
    [localMedications]
  )

  const syncVisibleCodes = () => {
    setVisibleCodes(Array.from(codesMapRef.current, ([data, v]) => ({ data, rect: v.rect })))
  }

  // Closes the checklist and releases everything the cassette stage was
  // holding onto, whether the nurse dismissed it manually or finished every
  // drug in it - the next scan should start clean, same code lock as the
  // slot->cassette stage transition.
  const closeCassette = () => {
    setScannedCassette(null)
    setCheckedIds(new Set())
    busyRef.current = false
    codesMapRef.current.clear()
    setVisibleCodes([])
    lastProcessedRef.current.clear()
  }

  const toggleChecked = (orderId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  const confirmDispense = async (orderIds) => {
    if (orderIds.length === 0 || !scannedCassette) return
    setDispensingIds(new Set(orderIds))
    try {
      const data = await dispenseMedications({
        nurseQr: nurse.qr_code_nurse,
        patientQr: patient.qr_code_patient,
        cassetteQr: scannedCassette.qrCode,
        medicationIds: orderIds,
      })
      const results = data.results || []
      const succeededIds = results.filter((r) => r.result === 'correct').map((r) => r.order_id)
      const failed = results.filter((r) => r.result !== 'correct')

      setScannedCassette((prev) =>
        prev
          ? {
              ...prev,
              medications: prev.medications.map((med) =>
                succeededIds.includes(med.order_id) ? { ...med, is_dispensed_today: true } : med
              ),
            }
          : prev
      )
      setLocalMedications((list) =>
        list.map((item) =>
          succeededIds.includes(item.order_id) ? { ...item, is_dispensed_today: true } : item
        )
      )
      setCheckedIds((prev) => {
        const next = new Set(prev)
        orderIds.forEach((id) => next.delete(id))
        return next
      })

      if (succeededIds.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
      if (failed.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        setFeedback({
          status: succeededIds.length > 0 ? 'target' : 'wrong',
          title: succeededIds.length > 0 ? `จ่ายสำเร็จ ${succeededIds.length} รายการ` : 'จ่ายยาไม่สำเร็จ',
          sub: failed.map((f) => `${f.drug_name}: ${f.message}`).join(', '),
        })
      } else {
        setFeedback({ status: 'target', title: `จ่ายสำเร็จ ${succeededIds.length} รายการ` })
      }
      setTimeout(() => setFeedback(null), 2200)
    } catch (err) {
      setFeedback({ status: 'wrong', title: err.message })
      setTimeout(() => setFeedback(null), 2000)
    } finally {
      setDispensingIds(new Set())
    }
  }

  const handleSlotScan = (data) => {
    if (matchesSlot(data, patient.qr_code_slot)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      busyRef.current = true
      setSlotConfirmed(true)
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    setFeedback({ status: 'wrong', title: 'ไม่ใช่ลิ้นชักนี้', sub: 'ลองส่องป้ายลิ้นชักช่องอื่น' })
    setTimeout(() => setFeedback(null), 1400)
  }

  // Nurse has read the popped-up patient name and explicitly chosen to move on —
  // release everything the slot stage was holding onto so the cassette stage
  // starts clean (its own scans shouldn't be blocked by the drawer's QR lock).
  const handleSlotConfirmed = () => {
    setSlotConfirmed(false)
    setStage('cassette')
    busyRef.current = false
    codesMapRef.current.clear()
    setVisibleCodes([])
    lastProcessedRef.current.clear()
  }

  const handleCassetteScan = async (data) => {
    if (!matchesCassetteQr(data, cassetteMedicationsByQr)) {
      setFeedback({ status: 'unknown', title: 'ไม่รู้จัก QR นี้' })
      setTimeout(() => setFeedback(null), 1400)
      return
    }

    busyRef.current = true
    setVerifyingCassette(true)
    try {
      const result = await verifyCassette({
        nurseQr: nurse.qr_code_nurse,
        patientQr: patient.qr_code_patient,
        cassetteQr: data,
      })
      if (result.result === 'correct') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setQuery('')
        setScannedCassette({
          qrCode: data,
          cassetteId: result.cassette_id,
          meal: result.meal,
          medications: result.medications,
        })
        setCheckedIds(new Set())
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        setFeedback({ status: 'wrong', title: result.message })
        setTimeout(() => setFeedback(null), 1600)
        busyRef.current = false
      }
    } catch (err) {
      setFeedback({ status: 'wrong', title: err.message })
      setTimeout(() => setFeedback(null), 1600)
      busyRef.current = false
    } finally {
      setVerifyingCassette(false)
    }
  }

  // Single entry point for actually acting on a code, whether it got here by
  // auto-lock (only one code in frame) or by the nurse tapping one of several
  // boxes. Same per-code cooldown and busy-guard either way.
  const processCode = (data) => {
    if (busyRef.current) return

    const now = Date.now()
    const lastAt = lastProcessedRef.current.get(data) || 0
    if (now - lastAt < RESCAN_COOLDOWN_MS) return
    lastProcessedRef.current.set(data, now)

    if (stage === 'slot') {
      handleSlotScan(data)
    } else {
      handleCassetteScan(data)
    }
  }
  // Always-fresh reference for the prune interval below, so it can act on a
  // code dropping out down to a lone survivor without needing to tear down
  // and recreate the interval every time stage/medications/target change.
  const processCodeRef = useRef(processCode)
  processCodeRef.current = processCode

  const handleSelectCode = (data) => {
    processCode(data)
  }

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      let removedAny = false
      for (const [data, entry] of codesMapRef.current) {
        if (now - entry.lastSeenAt > BOX_LOST_TIMEOUT_MS) {
          codesMapRef.current.delete(data)
          removedAny = true
        }
      }
      if (!removedAny) return

      syncVisibleCodes()

      // Sweeping down to exactly one surviving code re-enables auto-lock for
      // it, same as if it had been the only thing seen from the start.
      if (codesMapRef.current.size === 1) {
        const [soleData] = codesMapRef.current.keys()
        processCodeRef.current(soleData)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, PRUNE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const handleBarcodeScanned = (result) => {
    const data = normalizeQrValue(result?.data)
    if (!data) return

    codesMapRef.current.set(data, { rect: getBoxRect(result, screenWidth, screenHeight), lastSeenAt: Date.now() })
    syncVisibleCodes()

    // Only one code currently believed to be in frame — fast path, same as
    // the original single-code behavior (instant auto-lock, no tap needed).
    if (codesMapRef.current.size === 1) {
      processCode(data)
    }
    // 2+ codes: suppress auto-processing entirely. MultiScanOverlay is now
    // showing a box over every one of them; the nurse taps to pick.
  }

  const handleExit = () => {
    onDispensed()
  }

  const scanStatus = feedback?.status || null
  const singleCode = visibleCodes.length === 1 ? visibleCodes[0] : null
  const isTargetLock = !!singleCode && (scanStatus === 'target' || slotConfirmed || !!scannedCassette)
  const isMultiMode = visibleCodes.length > 1

  const identityFor = (data) =>
    resolveCodeIdentity({ stage, data, patient, cassetteMedicationsByQr, targetMedication })

  return (
    <CameraPermissionGate>
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing={CAMERA_FACING}
          barcodeScannerSettings={{ barcodeTypes: QR_BARCODE_TYPES }}
          onBarcodeScanned={handleBarcodeScanned}
        />

        <Pressable style={styles.closeButton} onPress={handleExit} hitSlop={10}>
          <Ionicons name="close" size={20} color="#fff" />
        </Pressable>

        <StageBadge stage={stage} hasSlotStage={hasSlotStage} />

        {isMultiMode ? (
          <MultiScanOverlay codes={visibleCodes} identityFor={identityFor} onSelect={handleSelectCode} />
        ) : isTargetLock ? (
          <ScanHighlightBox rect={singleCode.rect} />
        ) : (
          <ScanReticle />
        )}

        {isMultiMode && <MultiScanBanner count={visibleCodes.length} />}

        {stage === 'slot' ? (
          <SlotTargetPanel patient={patient} />
        ) : (
          <CassetteTargetPanel
            targetMedication={targetMedication}
            query={query}
            onChangeQuery={setQuery}
            verifying={verifyingCassette}
            totalCount={pendingMedications.length}
          />
        )}

        <ScanFeedback feedback={feedback} />

        {stage === 'cassette' && !scannedCassette && pendingMedications.length === 0 && (
          <View style={styles.doneButtonWrap} pointerEvents="box-none">
            <Button label="เสร็จสิ้น" onPress={handleExit} variant="success" />
          </View>
        )}

        {slotConfirmed && <SlotConfirmModal patient={patient} onConfirm={handleSlotConfirmed} />}

        {!!scannedCassette && (
          <CassetteChecklistModal
            cassette={scannedCassette}
            checkedIds={checkedIds}
            dispensingIds={dispensingIds}
            onToggle={toggleChecked}
            onConfirmSelected={() => confirmDispense(Array.from(checkedIds))}
            onConfirmAll={() =>
              confirmDispense(
                scannedCassette.medications.filter((m) => !m.is_dispensed_today).map((m) => m.order_id)
              )
            }
            onClose={closeCassette}
          />
        )}
      </View>
    </CameraPermissionGate>
  )
}

const RETICLE_SIZE = 200

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 30,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageBadge: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    zIndex: 10,
    // Was a hardcoded leftover from the very first theme (#1D7FE0) that never
    // got updated across two theme passes since - rgba() can't reference a
    // token directly, so this is the new accent's own RGB spelled out.
    backgroundColor: 'rgba(67,56,202,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  stageBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  reticleWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightBox: {
    position: 'absolute',
    borderWidth: 4,
    borderRadius: 12,
  },
  multiBox: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  multiBoxLabel: {
    position: 'absolute',
    maxWidth: 160,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  multiBoxLabelText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  multiBanner: {
    position: 'absolute',
    bottom: 168,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(15,17,21,0.85)',
    paddingVertical: 9,
    borderRadius: 999,
  },
  multiBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  reticleBox: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  targetPanel: {
    position: 'absolute',
    top: 56,
    left: 60,
    right: 16,
    gap: 8,
  },
  targetCard: {
    backgroundColor: 'rgba(15,17,21,0.85)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  targetEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  targetName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  targetProgress: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111',
    padding: 0,
  },
  feedbackCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
  },
  feedbackTarget: {
    backgroundColor: '#22c55e',
  },
  feedbackWrong: {
    backgroundColor: colors.danger,
  },
  feedbackUnknown: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  feedbackTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  feedbackSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 1,
  },
  checklistScroll: {
    alignSelf: 'stretch',
    maxHeight: 320,
    marginTop: 6,
  },
  checklistScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checklistRowDone: {
    opacity: 0.55,
  },
  checklistRowText: {
    flex: 1,
    gap: 2,
  },
  checklistDrugName: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: '700',
  },
  checklistDrugNameDone: {
    textDecorationLine: 'line-through',
  },
  checklistDrugMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  checklistDoneLabel: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  checklistActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  modalButtonOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  modalButtonOutlineText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  modalButtonDisabled: {
    opacity: 0.4,
  },
  checklistConfirmAllButton: {
    flex: 1,
    width: undefined,
    marginTop: 0,
  },
  doneButtonWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 40,
    zIndex: 15,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    // Lighter + bottom-anchored on purpose (was a fully opaque full-screen
    // cover before) — the drawer the nurse just scanned is usually still
    // visible in the upper/middle part of the camera view behind this, only
    // dimmed rather than blacked out entirely.
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 36,
    alignItems: 'center',
    gap: 4,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // The number a nurse has to remember after looking away from the phone —
  // deliberately the single biggest, boldest element in the card (well above
  // the patient name) so it reads instantly at a glance in dim pharmacy
  // lighting, with enough size/contrast margin to still be legible with a
  // slightly unsteady hand.
  slotBadge: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: TARGET_COLOR,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginTop: 10,
    marginBottom: 10,
  },
  slotBadgeLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  slotBadgeNumber: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 70,
  },
  modalPatientName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 2,
  },
  modalSub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  modalButton: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    width: '100%',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
})
