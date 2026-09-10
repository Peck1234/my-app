import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import SlotQrCard from '../components/SlotQrCard'
import { createSlot } from '../api'
import { colors, radius } from '../constants/theme'

function suggestSlotCode(existingSlots) {
  const numbers = existingSlots
    .map((s) => {
      const match = /^SLOT-(\d+)$/.exec(s.slot_code || '')
      return match ? Number(match[1]) : null
    })
    .filter((n) => n !== null)

  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
  return `SLOT-${String(next).padStart(4, '0')}`
}

export default function CreateSlotScreen({ nurse, existingSlots, onCreated, onCancel }) {
  const [slotCode, setSlotCode] = useState(suggestSlotCode(existingSlots))
  const [slotNo, setSlotNo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [createdSlot, setCreatedSlot] = useState(null)

  const handleCreate = async () => {
    setError(null)
    if (!slotCode.trim()) {
      setError('กรุณากรอกรหัสช่อง')
      return
    }

    setSaving(true)
    try {
      const data = await createSlot({
        slot_code: slotCode.trim(),
        slot_no: slotNo.trim() ? Number(slotNo.trim()) : null,
        created_by: nurse.nurse_id,
      })
      setCreatedSlot(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (createdSlot) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconMark}>
            <Ionicons name="checkmark" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>สร้างช่องยาสำเร็จ</Text>
          <Text style={styles.subtitle}>
            QR นี้ผูกกับช่องนี้ถาวร — พิมพ์ติดหน้าตู้หรือบันทึกรูปสำรองไว้ได้เลย
          </Text>
        </View>

        <SlotQrCard slotCode={createdSlot.slot_code} slotNo={createdSlot.slot_no} />

        <Button label="เสร็จสิ้น" onPress={() => onCreated(createdSlot)} variant="primary" style={styles.doneButton} />
      </ScrollView>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <LinkButton label="จัดการช่องยา" onPress={onCancel} />
      <Text style={styles.title}>สร้างช่องยาใหม่</Text>
      <Text style={styles.subtitle}>
        ระบบเสนอรหัสช่องให้อัตโนมัติ แก้เป็นรหัสของโรงพยาบาลเองได้ก่อนยืนยัน — QR ที่ได้ผูกกับช่องนี้ถาวร เปลี่ยนอีกไม่ได้
      </Text>

      <View style={styles.card}>
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>รหัสช่อง *</Text>
            <TouchableOpacity onPress={() => setSlotCode(suggestSlotCode(existingSlots))} hitSlop={8}>
              <Text style={styles.resetLink}>ใช้รหัสที่แนะนำ</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={slotCode}
            onChangeText={setSlotCode}
            placeholder="เช่น A12"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>ตำแหน่งบนรถเข็น (ไม่บังคับ)</Text>
          <TextInput
            style={styles.input}
            value={slotNo}
            onChangeText={setSlotNo}
            placeholder="เช่น 21"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button label={saving ? 'กำลังสร้าง...' : 'สร้างช่อง + QR'} onPress={handleCreate} loading={saving} variant="primary" />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingTop: 28, paddingBottom: 40 },
  header: { alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  iconMark: {
    width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.success, marginBottom: 6,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 19 },
  card: { gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  resetLink: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.bg, color: colors.ink, fontSize: 15,
  },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  doneButton: { marginTop: 6 },
})
