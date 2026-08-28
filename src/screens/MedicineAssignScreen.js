import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import QRCode from 'react-native-qrcode-svg'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import { assignMedicineToMeal, fetchPatients } from '../api'
import { downloadQrCode } from '../utils/downloadQrCode'
import { MEALS, MEAL_LABELS } from '../constants/meals'
import { colors, radius, shadow, spacing } from '../constants/theme'

// Three steps: pick a patient, pick a meal, see the result. Mirrors
// AssignPatientScreen's search-and-pick pattern for the patient step so the
// interaction stays consistent with the rest of the app.
export default function MedicineAssignScreen({ medicine, onDone, onCancel }) {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const [result, setResult] = useState(null)
  const qrRef = useRef(null)

  useEffect(() => {
    fetchPatients()
      .then(setPatients)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return patients
    return patients.filter((p) =>
      [p.full_name, p.ward, p.bed_no].filter(Boolean).some((field) => field.toLowerCase().includes(q))
    )
  }, [patients, query])

  const handleAssign = async () => {
    setError(null)
    setAssigning(true)
    try {
      const data = await assignMedicineToMeal(selectedPatient.patient_id, {
        meal: selectedMeal,
        drugName: medicine.drug_name,
        standardDose: medicine.standard_dose,
        purpose: medicine.purpose,
        dose: medicine.standard_dose || '1 หน่วย',
        instruction: null,
      })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setAssigning(false)
    }
  }

  // Result screen - branches on is_new since that's the whole point of the
  // permanent-QR design: a brand-new cassette needs its QR printed/saved,
  // reusing an existing one doesn't (the physical label is already there).
  if (result) {
    return (
      <View style={styles.shell}>
        {result.is_new ? (
          <View style={styles.content}>
            <View style={styles.successHeader}>
              <View style={styles.successIcon}>
                <Ionicons name="qr-code" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>สร้างตลับมื้อ{MEAL_LABELS[result.meal]}ใหม่</Text>
              <Text style={styles.subtitle}>
                นี่คือ QR ใหม่ของตลับนี้ — พิมพ์หรือถ่ายภาพหน้าจอนี้ไปติดที่ตลับยาจริง QR นี้จะใช้ตลอดไป
                ต่อให้เพิ่ม/ลดยาข้างในทีหลังก็ไม่ต้องเปลี่ยน QR
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.qrBox}>
                <QRCode value={result.qr_code} size={168} getRef={(ref) => (qrRef.current = ref)} />
              </View>
              <Text style={styles.qrName}>{selectedPatient.full_name} — มื้อ{MEAL_LABELS[result.meal]}</Text>
              <Text style={styles.qrCode}>{result.qr_code}</Text>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => downloadQrCode(qrRef, `${result.qr_code}.png`)}
                activeOpacity={0.7}
              >
                <Ionicons name="download-outline" size={14} color={colors.accent} />
                <Text style={styles.downloadButtonText}>ดาวน์โหลด</Text>
              </TouchableOpacity>
            </View>

            <Button label="เสร็จสิ้น" onPress={onDone} variant="primary" />
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.successIconLarge}>
              <Ionicons name="checkmark" size={28} color={colors.success} />
            </View>
            <Text style={styles.successText}>
              เพิ่ม{medicine.drug_name}เข้าตลับมื้อ{MEAL_LABELS[result.meal]}ที่มีอยู่แล้วสำเร็จ
            </Text>
            <Text style={styles.subtitle}>ใช้ QR เดิมของตลับนี้ได้เลย ไม่ต้องพิมพ์ใหม่</Text>
            <Button label="เสร็จสิ้น" onPress={onDone} variant="success" />
          </View>
        )}
      </View>
    )
  }

  // Step 2: pick the meal, once a patient is chosen.
  if (selectedPatient) {
    return (
      <View style={styles.shell}>
        <LinkButton label="เลือกผู้ป่วย" onPress={() => setSelectedPatient(null)} />
        <Text style={styles.title}>เพิ่ม {medicine.drug_name} ให้ {selectedPatient.full_name}</Text>
        <Text style={styles.subtitle}>เลือกมื้อที่จะให้ยานี้ — ถ้าผู้ป่วยมีตลับมื้อนี้อยู่แล้ว จะเพิ่มยาเข้าตลับเดิมทันที</Text>

        <View style={styles.mealGrid}>
          {MEALS.map((meal) => {
            const isActive = selectedMeal === meal
            return (
              <TouchableOpacity
                key={meal}
                style={[styles.mealPill, isActive && styles.mealPillActive]}
                onPress={() => setSelectedMeal(meal)}
                activeOpacity={0.7}
              >
                <Text style={[styles.mealPillText, isActive && styles.mealPillTextActive]}>
                  {MEAL_LABELS[meal]}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          label={assigning ? 'กำลังเพิ่ม...' : 'ยืนยัน'}
          onPress={handleAssign}
          loading={assigning}
          disabled={!selectedMeal}
          variant="primary"
        />
      </View>
    )
  }

  // Step 1: pick a patient.
  return (
    <View style={styles.shell}>
      <LinkButton label="คลังยา" onPress={onCancel} />
      <Text style={styles.title}>เพิ่ม {medicine.drug_name} ให้ผู้ป่วย</Text>
      <Text style={styles.subtitle}>เลือกผู้ป่วยที่ต้องการให้ยานี้</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={15} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหาชื่อ, วอร์ด, เตียง"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.centerStage}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : filteredPatients.length === 0 ? (
        <View style={styles.centerStage}>
          <Ionicons name="people-outline" size={32} color={colors.muted} />
          <Text style={styles.emptyText}>ไม่พบผู้ป่วยที่ตรงกับคำค้นหา</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPatients}
          keyExtractor={(item) => String(item.patient_id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.patientRow}
              onPress={() => setSelectedPatient(item)}
              activeOpacity={0.7}
            >
              <View style={styles.patientAvatar}>
                <Text style={styles.patientAvatarText}>{item.full_name?.trim()?.charAt(0) || '?'}</Text>
              </View>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{item.full_name}</Text>
                <Text style={styles.patientMeta}>
                  {[item.ward, item.bed_no ? `เตียง ${item.bed_no}` : null].filter(Boolean).join(' · ') || 'ไม่ระบุวอร์ด/เตียง'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1, gap: spacing.md + 2 },
  content: { gap: spacing.md + 2 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 19 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, padding: 0 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  centerStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: 40 },
  emptyText: { color: colors.muted, fontSize: 13.5, textAlign: 'center' },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  patientRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card,
  },
  patientAvatar: {
    width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  patientAvatarText: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  patientInfo: { flex: 1, gap: 2 },
  patientName: { color: colors.ink, fontSize: 14.5, fontWeight: '700' },
  patientMeta: { color: colors.muted, fontSize: 12.5 },
  mealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mealPill: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  mealPillActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  mealPillText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  mealPillTextActive: { color: '#FFFFFF' },
  successHeader: { alignItems: 'flex-start', gap: spacing.xs },
  successIcon: {
    width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, marginBottom: spacing.xs,
  },
  successIconLarge: {
    alignSelf: 'center', width: 64, height: 64, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successBg, marginTop: spacing.xxl,
  },
  successText: { color: colors.ink, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  card: {
    alignItems: 'center', gap: spacing.sm + 2, padding: spacing.xl, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  qrBox: { padding: 14, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  qrName: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  qrCode: { color: colors.muted, fontSize: 12, fontFamily: 'monospace' },
  downloadButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accent,
  },
  downloadButtonText: { color: colors.accent, fontSize: 12.5, fontWeight: '700' },
})
