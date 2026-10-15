import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import SlotQrCard from '../components/SlotQrCard'
import { clearSlot } from '../api'
import { isAdmin } from '../utils/roles'
import { colors, radius } from '../constants/theme'

export default function SlotDetailScreen({ nurse, slot, onBack, onAssign, onViewHistory, onCleared }) {
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState(null)

  const isOccupied = slot.status === 'occupied'

  const handleClear = async () => {
    setError(null)
    setClearing(true)
    try {
      await clearSlot(slot.id, { staff_id: nurse.nurse_id, base_version: slot.version }, { token: nurse.token })
      onCleared()
    } catch (err) {
      setError(err.message)
      setConfirmingClear(false)
    } finally {
      setClearing(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <LinkButton label="จัดการช่องยา" onPress={onBack} />

      <View style={styles.header}>
        <Text style={styles.slotCode}>{slot.slot_code}</Text>
        <View style={[styles.statusPill, isOccupied ? styles.statusPillOccupied : styles.statusPillEmpty]}>
          <Text style={[styles.statusPillText, isOccupied ? styles.statusPillTextOccupied : styles.statusPillTextEmpty]}>
            {isOccupied ? 'มีผู้ป่วยใช้งานอยู่' : 'ว่าง'}
          </Text>
        </View>
      </View>
      {!!slot.slot_no && <Text style={styles.slotNo}>ตำแหน่ง {slot.slot_no}</Text>}

      {isOccupied && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ผู้ป่วยปัจจุบัน</Text>
          <Text style={styles.patientName}>{slot.current_patient.full_name}</Text>
          <Text style={styles.patientMeta}>
            {[slot.current_patient.ward, slot.current_patient.bed_no ? `เตียง ${slot.current_patient.bed_no}` : null]
              .filter(Boolean)
              .join(' · ') || 'ไม่ระบุวอร์ด/เตียง'}
          </Text>
        </View>
      )}

      <SlotQrCard slotCode={slot.slot_code} slotNo={slot.slot_no} />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        {isOccupied ? (
          confirmingClear ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmText}>
                ยืนยันเคลียร์ผู้ป่วย "{slot.current_patient.full_name}" ออกจากช่องนี้? (รหัสช่อง/QR เดิมยังใช้ได้ต่อ)
              </Text>
              <View style={styles.confirmRow}>
                <Button
                  label="ยกเลิก"
                  onPress={() => setConfirmingClear(false)}
                  variant="outline"
                  style={styles.confirmButton}
                  disabled={clearing}
                />
                <Button
                  label={clearing ? 'กำลังเคลียร์...' : 'ยืนยันเคลียร์ช่อง'}
                  onPress={handleClear}
                  variant="danger"
                  style={styles.confirmButton}
                  loading={clearing}
                />
              </View>
            </View>
          ) : isAdmin(nurse) ? (
            <Button label="เคลียร์ช่อง (ผู้ป่วยออก)" onPress={() => setConfirmingClear(true)} variant="danger" icon="log-out-outline" />
          ) : null
        ) : (
          <Button label="ผูกผู้ป่วยเข้าช่องนี้" onPress={onAssign} variant="primary" icon="person-add-outline" />
        )}

        <Button label="ดูประวัติช่องนี้" onPress={onViewHistory} variant="outline" icon="time-outline" />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingTop: 28, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  slotCode: { color: colors.ink, fontSize: 22, fontWeight: '800', fontFamily: 'monospace' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  statusPillEmpty: { backgroundColor: colors.successBg },
  statusPillOccupied: { backgroundColor: colors.warningBg },
  statusPillText: { fontSize: 11.5, fontWeight: '800' },
  statusPillTextEmpty: { color: colors.success },
  statusPillTextOccupied: { color: colors.warning },
  slotNo: { color: colors.muted, fontSize: 13 },
  card: { gap: 6, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardLabel: { color: colors.accent, fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  patientName: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 2 },
  patientMeta: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  actions: { gap: 10, marginTop: 6 },
  confirmBox: { gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.dangerBg },
  confirmText: { color: colors.ink, fontSize: 13.5, lineHeight: 19 },
  confirmRow: { flexDirection: 'row', gap: 10 },
  confirmButton: { flex: 1 },
})
