import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  createPatient,
  fetchMedicineCatalog,
  fetchPatientMealCassettes,
  fetchPatientMedications,
  updatePatient,
} from '../api'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import MedicineAutocompleteField from '../components/MedicineAutocompleteField'
import MealPicker from '../components/MealPicker'
import PatientQrCodesScreen from './PatientQrCodesScreen'
import { colors, radius } from '../constants/theme'

function emptyMedication() {
  return {
    key: `new-${Date.now()}-${Math.random()}`,
    id: null,
    drug_name: '',
    standard_dose: '',
    purpose: '',
    dose: '',
    instruction: '',
    meal: '',
  }
}

function makeEmptyMedications(count) {
  return Array.from({ length: count }, () => emptyMedication())
}

export default function PatientFormScreen({ patient, onSaved, onCancel, onAssignNewPatient }) {
  const isEditing = !!patient

  const [fullName, setFullName] = useState(patient ? patient.full_name : '')
  const [ward, setWard] = useState(patient ? patient.ward || '' : '')
  const [bedNo, setBedNo] = useState(patient ? patient.bed_no || '' : '')
  const [qrCodePatient, setQrCodePatient] = useState(patient ? patient.qr_code_patient : '')
  const [medications, setMedications] = useState([])
  const [loadingMedications, setLoadingMedications] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [savedQrData, setSavedQrData] = useState(null)
  const [medicineCatalog, setMedicineCatalog] = useState([])

  useEffect(() => {
    // Best-effort - if the catalog fails to load, the drug-name field just
    // behaves as plain free-text (no dropdown), same as before this feature
    // existed, so a failure here is silently swallowed rather than blocking
    // the whole form.
    fetchMedicineCatalog()
      .then(setMedicineCatalog)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEditing) return

    fetchPatientMedications(patient.patient_id)
      .then((data) => {
        setMedications(
          (data.medications || []).map((med) => ({
            key: `existing-${med.order_id}`,
            id: med.order_id,
            drug_name: med.drug_name || '',
            standard_dose: med.standard_dose || '',
            purpose: med.purpose || '',
            dose: med.dose || '',
            instruction: med.instruction || '',
            meal: med.meal || '',
          }))
        )
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMedications(false))
  }, [isEditing, patient])

  const updateMedicationField = (key, field, value) => {
    setMedications((list) =>
      list.map((med) => (med.key === key ? { ...med, [field]: value } : med))
    )
  }

  const removeMedication = (key) => {
    setMedications((list) => list.filter((med) => med.key !== key))
  }

  // Auto-fills standard_dose/purpose from the catalog entry on selection -
  // the nurse can still edit either field afterward for a patient who needs
  // a non-standard dose, this just saves retyping the common case.
  const selectCatalogMedicine = (key, medicine) => {
    setMedications((list) =>
      list.map((med) =>
        med.key === key
          ? {
              ...med,
              drug_name: medicine.drug_name,
              standard_dose: medicine.standard_dose || '',
              purpose: medicine.purpose || '',
            }
          : med
      )
    )
  }

  const handleSave = async () => {
    setError(null)

    if (!fullName.trim() || !qrCodePatient.trim()) {
      setError('กรุณากรอกชื่อผู้ป่วยและรหัส QR ผู้ป่วย')
      return
    }

    for (const med of medications) {
      if (!med.drug_name.trim() || !med.dose.trim() || !med.meal) {
        setError('กรุณากรอกชื่อยา, ขนาดยา, และเลือกมื้อให้ครบทุกรายการ')
        return
      }
    }

    const payload = {
      full_name: fullName.trim(),
      ward: ward.trim() || null,
      bed_no: bedNo.trim() || null,
      qr_code_patient: qrCodePatient.trim(),
      medications: medications.map((med) => ({
        id: med.id,
        drug_name: med.drug_name.trim(),
        standard_dose: med.standard_dose.trim() || null,
        purpose: med.purpose.trim() || null,
        dose: med.dose.trim(),
        instruction: med.instruction.trim() || null,
        meal: med.meal,
      })),
    }

    setSaving(true)
    try {
      let patientId = patient?.patient_id
      if (isEditing) {
        await updatePatient(patient.patient_id, payload)
      } else {
        const created = await createPatient(payload)
        patientId = created.patient_id
      }
      const cassettes = await fetchPatientMealCassettes(patientId)
      setSavedQrData({
        patient_id: patientId,
        full_name: payload.full_name,
        qr_code_patient: payload.qr_code_patient,
        cassettes,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (savedQrData) {
    return (
      <PatientQrCodesScreen
        patient={savedQrData}
        cassettes={savedQrData.cassettes}
        onDone={onSaved}
        onAssignToSlot={
          !isEditing && onAssignNewPatient
            ? () => onAssignNewPatient({ patient_id: savedQrData.patient_id, full_name: savedQrData.full_name })
            : null
        }
      />
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <LinkButton label="รายชื่อผู้ป่วย" onPress={onCancel} />
        <Text style={styles.title}>{isEditing ? 'แก้ไขข้อมูลผู้ป่วย' : 'เพิ่มผู้ป่วยใหม่'}</Text>

        <View style={styles.card}>
          <Field label="ชื่อ-นามสกุล *" value={fullName} onChangeText={setFullName} placeholder="เช่น สมชาย ใจงาม" />
          <Field label="วอร์ด" value={ward} onChangeText={setWard} placeholder="เช่น A1" />
          <Field label="เตียง" value={bedNo} onChangeText={setBedNo} placeholder="เช่น 12" />
          <Field
            label="รหัส QR ผู้ป่วย *"
            value={qrCodePatient}
            onChangeText={setQrCodePatient}
            placeholder="เช่น PATIENT-0005"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.medicationsHeader}>
          <Text style={styles.sectionTitle}>
            รายการยา{medications.length > 0 ? ` (${medications.length})` : ''}
          </Text>
          {loadingMedications && <ActivityIndicator color={colors.accent} size="small" />}
        </View>

        <View style={styles.quickAddRow}>
          <Button
            label="เพิ่มรายการยา"
            onPress={() => setMedications((list) => [...list, emptyMedication()])}
            variant="outline"
            icon="add-circle-outline"
            style={styles.quickAddButton}
          />
          <Button
            label="+5 รายการ"
            onPress={() => setMedications((list) => [...list, ...makeEmptyMedications(5)])}
            variant="outline"
            icon="albums-outline"
            style={styles.quickAddButtonSmall}
          />
        </View>

        {medications.map((med, index) => (
          <View key={med.key} style={styles.card}>
            <View style={styles.medicationTop}>
              <Text style={styles.medicationIndex}>ยาที่ {index + 1}</Text>
              <TouchableOpacity
                onPress={() => removeMedication(med.key)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>

            <MedicineAutocompleteField
              value={med.drug_name}
              onChangeText={(v) => updateMedicationField(med.key, 'drug_name', v)}
              onSelectMedicine={(medicine) => selectCatalogMedicine(med.key, medicine)}
              medicines={medicineCatalog}
            />
            <Field
              label="ขนาดมาตรฐาน"
              value={med.standard_dose}
              onChangeText={(v) => updateMedicationField(med.key, 'standard_dose', v)}
              placeholder="เช่น 500mg"
            />
            <Field
              label="สรรพคุณ"
              value={med.purpose}
              onChangeText={(v) => updateMedicationField(med.key, 'purpose', v)}
              placeholder="เช่น ลดไข้"
            />
            <Field
              label="ขนาดที่ให้ *"
              value={med.dose}
              onChangeText={(v) => updateMedicationField(med.key, 'dose', v)}
              placeholder="เช่น 1 เม็ด"
            />
            <Field
              label="วิธีใช้"
              value={med.instruction}
              onChangeText={(v) => updateMedicationField(med.key, 'instruction', v)}
              placeholder="เช่น หลังอาหาร"
            />
            <View style={styles.field}>
              <Text style={styles.label}>มื้อ *</Text>
              <MealPicker value={med.meal} onChange={(meal) => updateMedicationField(med.key, 'meal', meal)} />
            </View>
          </View>
        ))}

        <Button
          label="เพิ่มรายการยาอีก"
          onPress={() => setMedications((list) => [...list, emptyMedication()])}
          variant="outline"
          icon="add-circle-outline"
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          label={saving ? 'กำลังบันทึก...' : 'บันทึก'}
          onPress={handleSave}
          loading={saving}
          variant="primary"
          style={styles.saveButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Field({ label, value, onChangeText, placeholder, autoCapitalize = 'none', keyboardType = 'default' }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
    gap: 14,
    paddingTop: 28,
    paddingBottom: 40,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  card: {
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  medicationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -4,
  },
  quickAddButton: {
    flex: 1,
    minHeight: 44,
  },
  quickAddButtonSmall: {
    flex: 0,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  medicationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medicationIndex: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  field: {
    gap: 8,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
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
  saveButton: {
    marginTop: 6,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
})
