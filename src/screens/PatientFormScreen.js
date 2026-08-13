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
import { createPatient, fetchPatientMedications, updatePatient } from '../api'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
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
    time_slot: '',
    qr_code_cassette: '',
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
            time_slot: med.time_slot || '',
            qr_code_cassette: med.qr_code_cassette || '',
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

  const handleSave = async () => {
    setError(null)

    if (!fullName.trim() || !qrCodePatient.trim()) {
      setError('กรุณากรอกชื่อผู้ป่วยและรหัส QR ผู้ป่วย')
      return
    }

    for (const med of medications) {
      if (!med.drug_name.trim() || !med.dose.trim() || !med.qr_code_cassette.trim()) {
        setError('กรุณากรอกชื่อยา, ขนาดยา, และรหัส QR ตลับยาให้ครบทุกรายการ')
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
        time_slot: med.time_slot.trim() || null,
        qr_code_cassette: med.qr_code_cassette.trim(),
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
      setSavedQrData({
        patient_id: patientId,
        full_name: payload.full_name,
        qr_code_patient: payload.qr_code_patient,
        medications: payload.medications,
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
        medications={savedQrData.medications}
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

            <Field
              label="ชื่อยา *"
              value={med.drug_name}
              onChangeText={(v) => updateMedicationField(med.key, 'drug_name', v)}
              placeholder="เช่น Paracetamol"
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
            <Field
              label="เวลาให้ยา (คั่นด้วยคอมมา)"
              value={med.time_slot}
              onChangeText={(v) => updateMedicationField(med.key, 'time_slot', v)}
              placeholder="เช่น 08:00,12:00,18:00"
            />
            <Field
              label="รหัส QR ตลับยา *"
              value={med.qr_code_cassette}
              onChangeText={(v) => updateMedicationField(med.key, 'qr_code_cassette', v)}
              placeholder="เช่น CASSETTE-0027"
              autoCapitalize="characters"
            />
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
