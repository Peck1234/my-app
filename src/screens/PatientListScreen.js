import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { deletePatient, fetchPatients } from '../api'
import Button from '../components/Button'
import ConfirmDialog from '../components/ConfirmDialog'
import FadeInView from '../components/FadeInView'
import PatientScanScreen from './PatientScanScreen'
import PatientFormScreen from './PatientFormScreen'
import { colors, gradients, radius, shadow, spacing } from '../constants/theme'

export default function PatientListScreen({ nurse, onSelectPatient, onSubScreenChange, onAssignNewPatient }) {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [scanning, setScanning] = useState(false)
  const [formMode, setFormMode] = useState(null) // null | 'create' | patient object to edit
  const [deletingPatient, setDeletingPatient] = useState(null) // patient pending confirmation, or null
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  useEffect(() => {
    onSubScreenChange?.(scanning || !!formMode)
  }, [scanning, formMode, onSubScreenChange])

  const loadPatients = useCallback(() => {
    setLoading(true)
    setError(null)

    fetchPatients()
      .then(setPatients)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadPatients()
  }, [loadPatients])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(null), 2500)
    return () => clearTimeout(timer)
  }, [successMessage])

  useEffect(() => {
    if (!deleteError) return
    const timer = setTimeout(() => setDeleteError(null), 4000)
    return () => clearTimeout(timer)
  }, [deleteError])

  const confirmDeletePatient = async () => {
    if (!deletingPatient) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deletePatient(deletingPatient.patient_id, { token: nurse.token })
      setPatients((list) => list.filter((p) => p.patient_id !== deletingPatient.patient_id))
      setSuccessMessage(`ลบผู้ป่วย "${deletingPatient.full_name}" ออกจากระบบแล้ว`)
      setDeletingPatient(null)
    } catch (err) {
      setDeleteError(err.message)
      setDeletingPatient(null)
    } finally {
      setDeleting(false)
    }
  }

  const filteredPatients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return patients

    return patients.filter((patient) =>
      [patient.full_name, patient.ward, patient.bed_no]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(normalizedQuery))
    )
  }, [patients, query])

  if (loading) {
    return (
      <View style={styles.centerStage}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centerStage}>
        <Text style={styles.error}>{error}</Text>
        <Button label="ลองใหม่" onPress={loadPatients} variant="primary" fullWidth={false} />
      </View>
    )
  }

  if (scanning) {
    return (
      <FadeInView key="scan-patient">
        <PatientScanScreen
          patients={patients}
          onFound={(patient) => {
            setScanning(false)
            onSelectPatient(patient)
          }}
          onClose={() => setScanning(false)}
        />
      </FadeInView>
    )
  }

  if (formMode) {
    return (
      <FadeInView key="patient-form">
        <PatientFormScreen
          patient={formMode === 'create' ? null : formMode}
          onSaved={() => {
            setFormMode(null)
            loadPatients()
          }}
          onCancel={() => setFormMode(null)}
          onAssignNewPatient={(patient) => {
            setFormMode(null)
            onAssignNewPatient?.(patient)
          }}
        />
      </FadeInView>
    )
  }

  return (
    <>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={filteredPatients}
        keyExtractor={(item) => item.patient_id}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {!!successMessage && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                <Text style={styles.successBannerText}>{successMessage}</Text>
              </View>
            )}
            {!!deleteError && <Text style={styles.error}>{deleteError}</Text>}
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="ค้นหาชื่อ, วอร์ด, หรือเตียง"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Button
              label="สแกน QR ยืนยันตัวผู้ป่วย"
              onPress={() => setScanning(true)}
              variant="outline"
              icon="qr-code-outline"
              style={styles.scanButton}
            />

            <Button
              label="เพิ่มผู้ป่วยใหม่"
              onPress={() => setFormMode('create')}
              variant="primary"
              icon="person-add-outline"
              style={styles.scanButton}
            />
          </View>
        }
        renderItem={({ item }) => {
          const initial = item.full_name?.trim()?.charAt(0) || '?'

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelectPatient(item)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
              <View style={styles.cardText}>
                <Text style={styles.name}>{item.full_name}</Text>
                <View style={styles.metaRow}>
                  {!!item.ward && (
                    <View style={styles.wardPill}>
                      <Ionicons name="location" size={10} color={colors.accent} />
                      <Text style={styles.wardPillText}>{item.ward}</Text>
                    </View>
                  )}
                  {!!item.bed_no && (
                    <View style={styles.bedRow}>
                      <Ionicons name="bed-outline" size={13} color={colors.muted} />
                      <Text style={styles.meta}>เตียง {item.bed_no}</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setFormMode(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => setDeletingPatient(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.centerStage}>
            <Text style={styles.meta}>
              {query ? 'ไม่พบผู้ป่วยที่ตรงกับคำค้นหา' : 'ยังไม่มีข้อมูลผู้ป่วย'}
            </Text>
          </View>
        }
      />

      <ConfirmDialog
        visible={!!deletingPatient}
        icon="trash-outline"
        title={`ยืนยันลบผู้ป่วย "${deletingPatient?.full_name}" ออกจากระบบ?`}
        message="ข้อมูล/ประวัติการจ่ายยาเดิมจะยังเก็บไว้ในระบบ แค่จะไม่แสดงในรายชื่อผู้ป่วยอีกต่อไป ถ้าผู้ป่วยนี้กำลังใช้ช่องยาอยู่ ช่องจะถูกเคลียร์ให้อัตโนมัติ"
        confirmLabel="ลบผู้ป่วย"
        loading={deleting}
        onConfirm={confirmDeletePatient}
        onCancel={() => setDeletingPatient(null)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.md,
    paddingVertical: 4,
    paddingBottom: spacing.xl,
  },
  listHeader: {
    marginBottom: spacing.md,
    gap: spacing.sm + 2,
  },
  // Border dropped in favor of shadow.card — same "this is a distinct input,
  // not part of the page" job, done with elevation instead of a hairline.
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  scanButton: {
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: 40,
  },
  // Patient rows are the single most-tapped surface in the whole app — this is
  // the card that most needed to stop looking like a flat list item. Real
  // shadow (not just a border) makes each row read as a pressable object
  // sitting on the page, which also happens to make the row bounds far more
  // obvious at a glance in a long scrolling list.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerBg,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.successBg,
  },
  successBannerText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  cardText: {
    flex: 1,
    gap: spacing.xs + 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Was outline-only (border, transparent fill) — filled with accentSoft
  // instead so it reads as a soft little "chip" rather than a stroked badge,
  // matching the general softer/warmer treatment everywhere else.
  wardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 1,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  wardPillText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  bedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
})
