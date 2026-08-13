import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Button from '../components/Button'
import FadeInView from '../components/FadeInView'
import SlotDetailScreen from './SlotDetailScreen'
import CreateSlotScreen from './CreateSlotScreen'
import AssignPatientScreen from './AssignPatientScreen'
import SlotHistoryScreen from './SlotHistoryScreen'
import { fetchSlots } from '../api'
import { colors, radius, shadow, spacing } from '../constants/theme'

export default function SlotManagementScreen({ nurse, onSubScreenChange, presetAssignPatient, onConsumedPresetAssign }) {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState('list') // list | detail | create | assign | history
  const [selectedSlot, setSelectedSlot] = useState(null)
  // Set once from presetAssignPatient and kept for the rest of this visit, so
  // tapping an empty slot goes straight into confirming THIS patient instead
  // of making the nurse search for someone they just finished entering.
  const [pickingSlotForPatient, setPickingSlotForPatient] = useState(null)

  useEffect(() => {
    onSubScreenChange?.(view !== 'list')
  }, [view, onSubScreenChange])

  const loadSlots = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchSlots()
      .then(setSlots)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  // Deep-link support: after saving a brand-new patient, arrive on this tab
  // already in "pick an empty slot for them" mode instead of a plain list.
  useEffect(() => {
    if (!presetAssignPatient) return
    setPickingSlotForPatient(presetAssignPatient)
    onConsumedPresetAssign?.()
  }, [presetAssignPatient, onConsumedPresetAssign])

  const filteredSlots = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return slots
    return slots.filter((s) =>
      [s.slot_code, s.current_patient?.full_name, s.current_patient?.ward, s.current_patient?.bed_no]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    )
  }, [slots, query])

  const emptySlots = filteredSlots.filter((s) => s.status === 'empty')
  const occupiedSlots = filteredSlots.filter((s) => s.status === 'occupied')
  const takenPatientIds = useMemo(
    () => slots.filter((s) => s.current_patient).map((s) => s.current_patient.patient_id),
    [slots]
  )

  const openSlot = (slot) => {
    setSelectedSlot(slot)
    // In "picking a slot for a just-created patient" mode, tapping any empty
    // slot should go straight to confirming that assignment — no reason to
    // make the nurse search for a patient they just finished entering.
    if (pickingSlotForPatient && slot.status === 'empty') {
      setView('assign')
    } else {
      setView('detail')
    }
  }

  const backToList = () => {
    setSelectedSlot(null)
    setView('list')
    loadSlots()
  }

  const finishAssigning = () => {
    setPickingSlotForPatient(null)
    backToList()
  }

  if (view === 'create') {
    return (
      <FadeInView key="create">
        <CreateSlotScreen
          nurse={nurse}
          existingSlots={slots}
          onCreated={backToList}
          onCancel={() => setView('list')}
        />
      </FadeInView>
    )
  }

  if (view === 'detail' && selectedSlot) {
    return (
      <FadeInView key={`detail-${selectedSlot.id}`}>
        <SlotDetailScreen
          nurse={nurse}
          slot={selectedSlot}
          onBack={backToList}
          onAssign={() => setView('assign')}
          onViewHistory={() => setView('history')}
          onCleared={backToList}
        />
      </FadeInView>
    )
  }

  if (view === 'assign' && selectedSlot) {
    return (
      <FadeInView key={`assign-${selectedSlot.id}`}>
        <AssignPatientScreen
          nurse={nurse}
          slot={selectedSlot}
          takenPatientIds={takenPatientIds}
          presetPatient={pickingSlotForPatient}
          onAssigned={finishAssigning}
          onCancel={() => (pickingSlotForPatient ? backToList() : setView('detail'))}
        />
      </FadeInView>
    )
  }

  if (view === 'history' && selectedSlot) {
    return (
      <FadeInView key={`history-${selectedSlot.id}`}>
        <SlotHistoryScreen slot={selectedSlot} onBack={() => setView('detail')} />
      </FadeInView>
    )
  }

  return (
    <View style={styles.shell}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>จัดการช่องยา</Text>
          <Text style={styles.subtitle}>
            {occupiedSlots.length} ช่องมีผู้ป่วย · {emptySlots.length} ช่องว่าง
          </Text>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={() => setView('create')} activeOpacity={0.7}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={15} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหารหัสช่อง, ชื่อผู้ป่วย"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {!!pickingSlotForPatient && (
        <View style={styles.pickingBanner}>
          <Ionicons name="person-add" size={16} color={colors.accent} />
          <Text style={styles.pickingBannerText}>
            เลือกช่องว่างเพื่อผูกกับ "{pickingSlotForPatient.full_name}"
          </Text>
          <TouchableOpacity onPress={() => setPickingSlotForPatient(null)} hitSlop={8}>
            <Text style={styles.pickingBannerCancel}>ยกเลิก</Text>
          </TouchableOpacity>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.centerStage}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : filteredSlots.length === 0 ? (
        <View style={styles.centerStage}>
          <Ionicons name="grid-outline" size={32} color={colors.muted} />
          <Text style={styles.emptyText}>{query ? 'ไม่พบช่องที่ตรงกับคำค้นหา' : 'ยังไม่มีช่องยาในระบบ'}</Text>
          {!query && (
            <Button label="สร้างช่องแรก" onPress={() => setView('create')} variant="primary" style={styles.emptyCta} />
          )}
        </View>
      ) : (
        <FlatList
          data={[
            ...(occupiedSlots.length > 0 ? [{ type: 'section', key: 'occupied', label: `มีผู้ป่วยใช้งานอยู่ (${occupiedSlots.length})` }] : []),
            ...occupiedSlots.map((s) => ({ type: 'slot', key: `slot-${s.id}`, slot: s })),
            ...(emptySlots.length > 0 ? [{ type: 'section', key: 'empty', label: `ว่าง (${emptySlots.length})` }] : []),
            ...emptySlots.map((s) => ({ type: 'slot', key: `slot-${s.id}`, slot: s })),
          ]}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            if (item.type === 'section') {
              return <Text style={styles.sectionLabel}>{item.label}</Text>
            }
            const slot = item.slot
            const isOccupied = slot.status === 'occupied'
            const dimmed = !!pickingSlotForPatient && isOccupied
            return (
              <TouchableOpacity
                style={[styles.slotRow, dimmed && styles.slotRowDimmed]}
                onPress={() => openSlot(slot)}
                activeOpacity={0.7}
              >
                <View style={[styles.slotIcon, isOccupied ? styles.slotIconOccupied : styles.slotIconEmpty]}>
                  <Ionicons name={isOccupied ? 'person' : 'ellipse-outline'} size={16} color={isOccupied ? colors.warning : colors.success} />
                </View>
                <View style={styles.slotInfo}>
                  <Text style={styles.slotCode}>{slot.slot_code}</Text>
                  <Text style={styles.slotMeta}>
                    {isOccupied
                      ? slot.current_patient.full_name
                      : slot.slot_no
                      ? `ตำแหน่ง ${slot.slot_no} · ว่าง`
                      : 'ว่าง'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1, gap: spacing.md + 2 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  createButton: {
    width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, ...shadow.card,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, ...shadow.card,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, padding: 0 },
  pickingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  pickingBannerText: { flex: 1, color: colors.accent, fontSize: 13, fontWeight: '700' },
  pickingBannerCancel: { color: colors.accent, fontSize: 12.5, fontWeight: '700', textDecorationLine: 'underline' },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  centerStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: 40 },
  emptyText: { color: colors.muted, fontSize: 13.5, textAlign: 'center' },
  emptyCta: { marginTop: 6, alignSelf: 'center' },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  sectionLabel: {
    color: colors.muted, fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 0.4, marginTop: spacing.sm, marginBottom: 2,
  },
  // Same elevation-not-border treatment as the patient list card — plus the
  // status icon backgrounds (successBg/warningBg) now carry real semantic
  // weight since they're the only color-coding left once the border is gone,
  // reinforcing empty/occupied at a glance rather than relying on the text.
  slotRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card,
  },
  slotRowDimmed: { opacity: 0.45, shadowOpacity: 0 },
  slotIcon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  slotIconEmpty: { backgroundColor: colors.successBg },
  slotIconOccupied: { backgroundColor: colors.warningBg },
  slotInfo: { flex: 1, gap: 2 },
  slotCode: { color: colors.ink, fontSize: 14.5, fontWeight: '800', fontFamily: 'monospace' },
  slotMeta: { color: colors.muted, fontSize: 12.5 },
})
