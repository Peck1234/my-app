import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { Ionicons } from '@expo/vector-icons'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import MedicineAutocompleteField from '../components/MedicineAutocompleteField'
import { fetchCassetteDetail, fetchMedicineCatalog, removeCassetteMedicine, updateCassetteMedicine, assignMedicineToMeal } from '../api'
import { isAdmin } from '../utils/roles'
import { useAndroidBack } from '../hook/useAndroidBack'
import { downloadQrCode } from '../utils/downloadQrCode'
import { MEAL_LABELS } from '../constants/meals'
import { colors, radius, spacing } from '../constants/theme'

function emptyDrugForm() {
  return { drug_name: '', standard_dose: '', purpose: '', dose: '', instruction: '' }
}

// Opened either by tapping an existing QR card in PatientQrCodesScreen
// (pass cassetteId) or by tapping a meal that doesn't have a cassette yet
// (pass meal instead - a cassette can't exist without at least one drug in
// it, so "creating" one here really means "add the first drug for this
// meal", after which the response's own cassette_id/qr_code take over and
// the screen behaves exactly like the existing-cassette case).
export default function CassetteDetailScreen({ nurse, patient, cassetteId, meal, onBack }) {
  const [cassette, setCassette] = useState(null)
  const [loading, setLoading] = useState(!!cassetteId)
  const [error, setError] = useState(null)
  const [medicineCatalog, setMedicineCatalog] = useState([])

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyDrugForm())
  const [savingEdit, setSavingEdit] = useState(false)

  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const [addingNew, setAddingNew] = useState(false)
  const [newDrug, setNewDrug] = useState(emptyDrugForm())
  const [savingNew, setSavingNew] = useState(false)

  const qrRef = useRef(null)

  // Android back closes an open edit/add form before leaving the cassette.
  useAndroidBack(() => {
    if (editingId) setEditingId(null)
    else if (addingNew) {
      setAddingNew(false)
      setNewDrug(emptyDrugForm())
    }
    else return false
    return true
  })
  const isCreatingCassette = !cassette && !cassetteId

  const loadCassette = () => {
    setLoading(true)
    setError(null)
    fetchCassetteDetail(patient.patient_id, cassetteId)
      .then(setCassette)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (cassetteId) loadCassette()
    fetchMedicineCatalog().then(setMedicineCatalog).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.patient_id, cassetteId])

  const startEdit = (med) => {
    setConfirmDeleteId(null)
    setAddingNew(false)
    setEditingId(med.order_id)
    setEditForm({
      drug_name: med.drug_name || '',
      standard_dose: med.standard_dose || '',
      purpose: med.purpose || '',
      dose: med.dose || '',
      instruction: med.instruction || '',
    })
  }

  const saveEdit = async () => {
    if (!editForm.drug_name.trim() || !editForm.dose.trim()) {
      setError('กรุณากรอกชื่อยาและขนาดที่ให้')
      return
    }
    setError(null)
    setSavingEdit(true)
    try {
      const updated = await updateCassetteMedicine(patient.patient_id, cassetteId, editingId, {
        drugName: editForm.drug_name.trim(),
        standardDose: editForm.standard_dose.trim(),
        purpose: editForm.purpose.trim(),
        dose: editForm.dose.trim(),
        instruction: editForm.instruction.trim(),
      })
      setCassette(updated)
      setEditingId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const confirmDelete = async (orderId) => {
    setError(null)
    setDeletingId(orderId)
    try {
      const updated = await removeCassetteMedicine(patient.patient_id, cassetteId, orderId, { token: nurse.token })
      setCassette(updated)
      setConfirmDeleteId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const saveNewDrug = async () => {
    if (!newDrug.drug_name.trim() || !newDrug.dose.trim()) {
      setError('กรุณากรอกชื่อยาและขนาดที่ให้')
      return
    }
    setError(null)
    setSavingNew(true)
    try {
      const result = await assignMedicineToMeal(patient.patient_id, {
        meal: cassette ? cassette.meal : meal,
        drugName: newDrug.drug_name.trim(),
        standardDose: newDrug.standard_dose.trim(),
        purpose: newDrug.purpose.trim(),
        dose: newDrug.dose.trim(),
        instruction: newDrug.instruction.trim(),
      })
      // First drug for a brand-new cassette: the response now carries the
      // real cassette_id/qr_code the rest of this screen (edit/delete/QR
      // display) needs - swap straight to it instead of just patching
      // `medications` into a cassette object that didn't exist a moment ago.
      setCassette((prev) => (prev ? { ...prev, medications: result.medications } : result))
      setNewDrug(emptyDrugForm())
      setAddingNew(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingNew(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.centerStage}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (isCreatingCassette) {
    return (
      <ScrollView contentContainerStyle={styles.shell} keyboardShouldPersistTaps="handled">
        <LinkButton label="ย้อนกลับ" onPress={onBack} />

        <View style={styles.qrCard}>
          <Text style={styles.mealTitle}>มื้อ{MEAL_LABELS[meal]} (ยังไม่มีตลับ)</Text>
          <Text style={styles.patientName}>{patient.full_name}</Text>
          <Text style={styles.createHint}>
            เพิ่มยาตัวแรกด้านล่างเพื่อสร้างตลับมื้อนี้ - ระบบจะออก QR ใหม่ให้ทันที
          </Text>
        </View>

        <View style={styles.card}>
          <MedicineAutocompleteField
            value={newDrug.drug_name}
            onChangeText={(v) => setNewDrug((f) => ({ ...f, drug_name: v }))}
            onSelectMedicine={(medicine) =>
              setNewDrug((f) => ({
                ...f,
                drug_name: medicine.drug_name,
                standard_dose: medicine.standard_dose || '',
                purpose: medicine.purpose || '',
              }))
            }
            medicines={medicineCatalog}
          />
          <Field label="ขนาดมาตรฐาน" value={newDrug.standard_dose} onChangeText={(v) => setNewDrug((f) => ({ ...f, standard_dose: v }))} />
          <Field label="สรรพคุณ" value={newDrug.purpose} onChangeText={(v) => setNewDrug((f) => ({ ...f, purpose: v }))} />
          <Field label="ขนาดที่ให้ *" value={newDrug.dose} onChangeText={(v) => setNewDrug((f) => ({ ...f, dose: v }))} />
          <Field label="วิธีใช้" value={newDrug.instruction} onChangeText={(v) => setNewDrug((f) => ({ ...f, instruction: v }))} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button
            label={savingNew ? 'กำลังสร้างตลับ...' : 'สร้างตลับและเพิ่มยา'}
            onPress={saveNewDrug}
            loading={savingNew}
            variant="primary"
          />
        </View>
      </ScrollView>
    )
  }

  if (!cassette) {
    return (
      <View style={styles.shell}>
        <LinkButton label="ย้อนกลับ" onPress={onBack} />
        <Text style={styles.error}>{error || 'ไม่พบตลับยานี้'}</Text>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.shell} keyboardShouldPersistTaps="handled">
      <LinkButton label="ย้อนกลับ" onPress={onBack} />

      <View style={styles.qrCard}>
        <Text style={styles.mealTitle}>มื้อ{MEAL_LABELS[cassette.meal]}</Text>
        <Text style={styles.patientName}>{patient.full_name}</Text>
        <View style={styles.qrBox}>
          <QRCode value={cassette.qr_code} size={150} getRef={(ref) => (qrRef.current = ref)} />
        </View>
        <Text style={styles.qrCode}>{cassette.qr_code}</Text>
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => downloadQrCode(qrRef, `${cassette.qr_code}.png`)}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={14} color={colors.accent} />
          <Text style={styles.downloadButtonText}>ดาวน์โหลด</Text>
        </TouchableOpacity>
      </View>

      {!!error && !editingId && !addingNew && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionTitle}>ยาในตลับนี้ ({cassette.medications.length})</Text>

      {cassette.medications.map((med) => {
        const isEditing = editingId === med.order_id
        const isConfirmingDelete = confirmDeleteId === med.order_id
        const isDeleting = deletingId === med.order_id

        if (isEditing) {
          return (
            <View key={med.order_id} style={styles.card}>
              <Field label="ชื่อยา *" value={editForm.drug_name} onChangeText={(v) => setEditForm((f) => ({ ...f, drug_name: v }))} />
              <Field label="ขนาดมาตรฐาน" value={editForm.standard_dose} onChangeText={(v) => setEditForm((f) => ({ ...f, standard_dose: v }))} />
              <Field label="สรรพคุณ" value={editForm.purpose} onChangeText={(v) => setEditForm((f) => ({ ...f, purpose: v }))} />
              <Field label="ขนาดที่ให้ *" value={editForm.dose} onChangeText={(v) => setEditForm((f) => ({ ...f, dose: v }))} />
              <Field label="วิธีใช้" value={editForm.instruction} onChangeText={(v) => setEditForm((f) => ({ ...f, instruction: v }))} />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.editActions}>
                <Button label="ยกเลิก" onPress={() => setEditingId(null)} variant="outline" style={styles.editActionButton} />
                <Button
                  label={savingEdit ? 'กำลังบันทึก...' : 'บันทึก'}
                  onPress={saveEdit}
                  loading={savingEdit}
                  variant="primary"
                  style={styles.editActionButton}
                />
              </View>
            </View>
          )
        }

        return (
          <View key={med.order_id} style={styles.card}>
            <View style={styles.drugRow}>
              <View style={styles.drugInfo}>
                <Text style={styles.drugName}>
                  {med.drug_name}
                  {med.standard_dose ? ` ${med.standard_dose}` : ''}
                </Text>
                {!!med.purpose && <Text style={styles.drugMeta}>{med.purpose}</Text>}
                <Text style={styles.drugMeta}>{[med.dose, med.instruction].filter(Boolean).join(' · ')}</Text>
                {med.is_dispensed_today && (
                  <View style={styles.dispensedPill}>
                    <Ionicons name="checkmark-circle" size={11} color={colors.success} />
                    <Text style={styles.dispensedPillText}>จ่ายแล้ววันนี้</Text>
                  </View>
                )}
              </View>
              <View style={styles.drugActions}>
                <TouchableOpacity onPress={() => startEdit(med)} hitSlop={8}>
                  <Ionicons name="create-outline" size={19} color={colors.accent} />
                </TouchableOpacity>
                {isAdmin(nurse) && (
                  <TouchableOpacity onPress={() => setConfirmDeleteId(med.order_id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={19} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {isConfirmingDelete && (
              <View style={styles.confirmRow}>
                <Text style={styles.confirmText}>ลบยานี้ออกจากตลับ?</Text>
                <View style={styles.confirmActions}>
                  <Button
                    label="ยกเลิก"
                    onPress={() => setConfirmDeleteId(null)}
                    variant="outline"
                    fullWidth={false}
                    style={styles.confirmButton}
                  />
                  <Button
                    label={isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
                    onPress={() => confirmDelete(med.order_id)}
                    loading={isDeleting}
                    variant="danger"
                    fullWidth={false}
                    style={styles.confirmButton}
                  />
                </View>
              </View>
            )}
          </View>
        )
      })}

      {addingNew ? (
        <View style={styles.card}>
          <MedicineAutocompleteField
            value={newDrug.drug_name}
            onChangeText={(v) => setNewDrug((f) => ({ ...f, drug_name: v }))}
            onSelectMedicine={(medicine) =>
              setNewDrug((f) => ({
                ...f,
                drug_name: medicine.drug_name,
                standard_dose: medicine.standard_dose || '',
                purpose: medicine.purpose || '',
              }))
            }
            medicines={medicineCatalog}
          />
          <Field label="ขนาดมาตรฐาน" value={newDrug.standard_dose} onChangeText={(v) => setNewDrug((f) => ({ ...f, standard_dose: v }))} />
          <Field label="สรรพคุณ" value={newDrug.purpose} onChangeText={(v) => setNewDrug((f) => ({ ...f, purpose: v }))} />
          <Field label="ขนาดที่ให้ *" value={newDrug.dose} onChangeText={(v) => setNewDrug((f) => ({ ...f, dose: v }))} />
          <Field label="วิธีใช้" value={newDrug.instruction} onChangeText={(v) => setNewDrug((f) => ({ ...f, instruction: v }))} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.editActions}>
            <Button
              label="ยกเลิก"
              onPress={() => {
                setAddingNew(false)
                setNewDrug(emptyDrugForm())
              }}
              variant="outline"
              style={styles.editActionButton}
            />
            <Button
              label={savingNew ? 'กำลังเพิ่ม...' : 'เพิ่มยา'}
              onPress={saveNewDrug}
              loading={savingNew}
              variant="primary"
              style={styles.editActionButton}
            />
          </View>
        </View>
      ) : (
        <Button label="เพิ่มยาเข้าตลับนี้" onPress={() => setAddingNew(true)} variant="outline" icon="add-circle-outline" />
      )}
    </ScrollView>
  )
}

function Field({ label, value, onChangeText }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    gap: 14,
    paddingTop: 28,
    paddingBottom: 40,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  qrCard: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealTitle: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  patientName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  qrBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    marginTop: 6,
  },
  qrCode: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  createHint: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  downloadButtonText: {
    color: colors.accent,
    fontSize: 12.5,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  drugRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  drugInfo: {
    flex: 1,
    gap: 3,
  },
  drugName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  drugMeta: {
    color: colors.muted,
    fontSize: 12.5,
  },
  dispensedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  dispensedPillText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  drugActions: {
    flexDirection: 'row',
    gap: 14,
    paddingTop: 2,
  },
  confirmRow: {
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    flex: 1,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editActionButton: {
    flex: 1,
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
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    color: colors.ink,
    fontSize: 15,
  },
  error: {
    color: colors.danger,
    fontSize: 13.5,
    textAlign: 'center',
  },
})
