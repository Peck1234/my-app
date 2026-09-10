import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import { fetchPatients, assignPatientToSlot } from '../api'
import { colors, radius } from '../constants/theme'

export default function AssignPatientScreen({ nurse, slot, takenPatientIds, presetPatient, onAssigned, onCancel }) {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(!presetPatient)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [assigningId, setAssigningId] = useState(null)
  const [assignedSuccess, setAssignedSuccess] = useState(null)

  useEffect(() => {
    if (presetPatient) return
    fetchPatients()
      .then(setPatients)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [presetPatient])

  const availablePatients = useMemo(() => {
    const takenSet = new Set(takenPatientIds)
    const normalizedQuery = query.trim().toLowerCase()
    return patients
      .filter((p) => !takenSet.has(p.patient_id))
      .filter((p) => {
        if (!normalizedQuery) return true
        return [p.full_name, p.ward, p.bed_no]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(normalizedQuery))
      })
  }, [patients, takenPatientIds, query])

  const handleAssign = async (patient) => {
    setError(null)
    setAssigningId(patient.patient_id)
    try {
      await assignPatientToSlot(slot.id, {
        patient_id: patient.patient_id,
        staff_id: nurse.nurse_id,
        base_version: slot.version,
      })
      setAssignedSuccess({ patient, slotCode: slot.slot_code })
    } catch (err) {
      setError(err.message)
    } finally {
      setAssigningId(null)
    }
  }

  if (assignedSuccess) {
    return (
      <View style={styles.shell}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={28} color={colors.success} />
          </View>
          <Text style={styles.successText}>
            ผูกผู้ป่วย {assignedSuccess.patient.full_name} เข้าช่อง {assignedSuccess.slotCode} สำเร็จ
          </Text>
        </View>

        <Button
          label="ย้อนกลับ"
          onPress={() => onAssigned(assignedSuccess.patient)}
          variant="success"
        />
      </View>
    )
  }

  if (presetPatient) {
    return (
      <View style={styles.shell}>
        <LinkButton label="จัดการช่องยา" onPress={onCancel} />
        <Text style={styles.title}>ผูกผู้ป่วยเข้าช่อง {slot.slot_code}</Text>
        <Text style={styles.subtitle}>ยืนยันผูกผู้ป่วยที่เพิ่งบันทึกไว้เข้ากับช่องนี้</Text>

        <View style={styles.presetCard}>
          <View style={styles.patientAvatar}>
            <Text style={styles.patientAvatarText}>{presetPatient.full_name?.trim()?.charAt(0) || '?'}</Text>
          </View>
          <Text style={styles.presetName}>{presetPatient.full_name}</Text>
          <Text style={styles.presetInto}>เข้าช่อง {slot.slot_code}{slot.slot_no ? ` (ตำแหน่ง ${slot.slot_no})` : ''}</Text>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          label={assigningId ? 'กำลังผูก...' : 'ยืนยันผูกผู้ป่วยเข้าช่องนี้'}
          onPress={() => handleAssign(presetPatient)}
          loading={!!assigningId}
          variant="primary"
        />
      </View>
    )
  }

  return (
    <View style={styles.shell}>
      <LinkButton label={`ช่อง ${slot.slot_code}`} onPress={onCancel} />
      <Text style={styles.title}>ผูกผู้ป่วยเข้าช่อง {slot.slot_code}</Text>
      <Text style={styles.subtitle}>เลือกผู้ป่วยที่ยังไม่ผูกกับช่องไหน</Text>

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
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.centerStage}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : availablePatients.length === 0 ? (
        <View style={styles.centerStage}>
          <Ionicons name="people-outline" size={32} color={colors.muted} />
          <Text style={styles.emptyText}>
            {query ? 'ไม่พบผู้ป่วยที่ตรงกับคำค้นหา' : 'ไม่มีผู้ป่วยว่างให้ผูกแล้ว (ทุกคนมีช่องอยู่แล้ว)'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={availablePatients}
          keyExtractor={(item) => String(item.patient_id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.patientRow}
              onPress={() => handleAssign(item)}
              disabled={assigningId !== null}
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
              {assigningId === item.patient_id ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1, gap: 14, paddingTop: 28 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13.5 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, padding: 0 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  presetCard: {
    alignItems: 'center', gap: 6, padding: 24, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  presetName: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 6 },
  presetInto: { color: colors.muted, fontSize: 13 },
  successCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24,
  },
  successIcon: {
    width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.successBg,
  },
  successText: { color: colors.ink, fontSize: 16, fontWeight: '700', textAlign: 'center', maxWidth: 280 },
  centerStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { color: colors.muted, fontSize: 13.5, textAlign: 'center', maxWidth: 240 },
  list: { gap: 8, paddingBottom: 20 },
  patientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  patientAvatar: {
    width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  patientAvatarText: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  patientInfo: { flex: 1, gap: 2 },
  patientName: { color: colors.ink, fontSize: 14.5, fontWeight: '700' },
  patientMeta: { color: colors.muted, fontSize: 12.5 },
})
