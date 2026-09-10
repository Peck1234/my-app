import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import { createMedicineCatalogEntry } from '../api'
import { colors, radius } from '../constants/theme'

export default function MedicineAddScreen({ onCreated, onCancel }) {
  const [drugName, setDrugName] = useState('')
  const [genericName, setGenericName] = useState('')
  const [standardDose, setStandardDose] = useState('')
  const [category, setCategory] = useState('')
  const [purpose, setPurpose] = useState('')
  const [contraindication, setContraindication] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async () => {
    setError(null)
    if (!drugName.trim()) {
      setError('กรุณากรอกชื่อยา')
      return
    }

    setSaving(true)
    try {
      const created = await createMedicineCatalogEntry({
        drug_name: drugName.trim(),
        generic_name: genericName.trim() || null,
        standard_dose: standardDose.trim() || null,
        category: category.trim() || null,
        purpose: purpose.trim() || null,
        contraindication: contraindication.trim() || null,
      })
      onCreated(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <LinkButton label="คลังยา" onPress={onCancel} />
      <Text style={styles.title}>เพิ่มยาใหม่เข้าคลัง</Text>

      <View style={styles.card}>
        <Field label="ชื่อยา *" value={drugName} onChangeText={setDrugName} placeholder="เช่น Paracetamol 500mg" />
        <Field label="ชื่อสามัญ" value={genericName} onChangeText={setGenericName} placeholder="เช่น Paracetamol" />
        <Field label="ขนาดมาตรฐาน" value={standardDose} onChangeText={setStandardDose} placeholder="เช่น 500mg" />
        <Field label="หมวดหมู่" value={category} onChangeText={setCategory} placeholder="เช่น แก้ปวดลดไข้" />
        <Field label="สรรพคุณ" value={purpose} onChangeText={setPurpose} placeholder="เช่น ลดไข้ บรรเทาปวด" />
        <Field
          label="ข้อควรระวัง / ข้อห้ามใช้"
          value={contraindication}
          onChangeText={setContraindication}
          placeholder="เช่น แพ้ยา Paracetamol"
        />
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button label={saving ? 'กำลังบันทึก...' : 'บันทึกเข้าคลังยา'} onPress={handleSave} loading={saving} variant="primary" />
    </ScrollView>
  )
}

function Field({ label, value, onChangeText, placeholder }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  // This screen has no SafeAreaView of its own, and core RN SafeAreaView
  // doesn't reserve space for Android's status bar anyway (iOS-only
  // no-op there) - without paddingTop the first element (the "คลังยา"
  // back link) rendered right under the clock/battery icons.
  content: { gap: 14, paddingTop: 28, paddingBottom: 40 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  card: {
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  field: { gap: 8 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    color: colors.ink,
    fontSize: 15,
  },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
})
