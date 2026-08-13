import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fetchPatientMedications } from '../api'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import FadeInView from '../components/FadeInView'
import DispenseCompleteScreen from './DispenseCompleteScreen'
import MedicationLocatorScreen from './MedicationLocatorScreen'
import { colors, radius, shadow, spacing } from '../constants/theme'

function isCurrentSlot(timeSlot) {
  if (!timeSlot) return true

  const now = new Date()
  const nowText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return timeSlot.split(',').some((slot) => slot <= nowText)
}

export default function PatientMedicationScreen({ nurse, patient, onBack }) {
  const [medications, setMedications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [locating, setLocating] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const visibleMedications = useMemo(() => {
    if (showAll) return medications
    return medications.filter((item) => isCurrentSlot(item.time_slot))
  }, [medications, showAll])

  const loadMedications = useCallback(() => {
    setLoading(true)
    setError(null)

    fetchPatientMedications(patient.patient_id)
      .then((data) => setMedications(data.medications))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [patient.patient_id])

  useEffect(() => {
    loadMedications()
  }, [loadMedications])

  if (locating) {
    return (
      <FadeInView key="locating">
        <MedicationLocatorScreen
          nurse={nurse}
          patient={patient}
          medications={medications}
          onDispensed={() => {
            setLocating(false)
            loadMedications()
          }}
        />
      </FadeInView>
    )
  }

  const allDispensed =
    !loading &&
    !error &&
    medications.length > 0 &&
    medications.every((item) => !!item.is_dispensed_today)

  if (allDispensed) {
    return (
      <FadeInView key="complete" style={styles.shell}>
        <LinkButton label="รายชื่อผู้ป่วย" onPress={onBack} />
        <DispenseCompleteScreen
          nurse={nurse}
          patient={patient}
          medications={medications}
          onBack={onBack}
        />
      </FadeInView>
    )
  }

  return (
    <FadeInView key="list" style={styles.shell}>
      <View style={styles.header}>
        <LinkButton label="รายชื่อผู้ป่วย" onPress={onBack} />
        <Text style={styles.title}>{patient.full_name}</Text>
        <Text style={styles.subtitle}>
          {[patient.ward, patient.bed_no && `เตียง ${patient.bed_no}`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Button
          label="หาช่องยาและจ่ายยา (AR)"
          onPress={() => setLocating(true)}
          variant="primary"
          icon="locate-outline"
          style={styles.scanButton}
        />

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterTab, !showAll && styles.filterTabActive]}
            onPress={() => setShowAll(false)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="time-outline"
              size={14}
              color={!showAll ? '#FFFFFF' : colors.muted}
            />
            <Text style={[styles.filterTabText, !showAll && styles.filterTabTextActive]}>
              ถึงเวลานี้
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, showAll && styles.filterTabActive]}
            onPress={() => setShowAll(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="list-outline"
              size={14}
              color={showAll ? '#FFFFFF' : colors.muted}
            />
            <Text style={[styles.filterTabText, showAll && styles.filterTabTextActive]}>
              ทั้งหมด
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.centerStage}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {!loading && !!error && (
        <View style={styles.centerStage}>
          <Text style={styles.error}>{error}</Text>
          <Button label="ลองใหม่" onPress={loadMedications} variant="primary" fullWidth={false} />
        </View>
      )}

      {!loading && !error && (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={visibleMedications}
          keyExtractor={(item) => item.order_id}
          renderItem={({ item, index }) => {
            const isDispensed = !!item.is_dispensed_today
            const isDueNow = !isDispensed && item.is_due

            return (
              <View style={[styles.card, isDispensed && styles.cardDispensed]}>
                <View style={styles.cardTop}>
                  <View style={styles.indexBadge}>
                    <Text style={styles.indexBadgeText}>{index + 1}</Text>
                  </View>
                  <View style={styles.cardTopText}>
                    <Text style={[styles.drugName, isDispensed && styles.drugNameDispensed]}>
                      {item.drug_name}
                      {item.standard_dose ? ` ${item.standard_dose}` : ''}
                    </Text>
                    {!!item.purpose && (
                      <View style={styles.purposePill}>
                        <Ionicons name="medical-outline" size={11} color={colors.accent} />
                        <Text style={styles.purposeText}>{item.purpose}</Text>
                      </View>
                    )}
                  </View>
                  {isDispensed && (
                    <View style={styles.statusPillSuccess}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                      <Text style={styles.statusPillSuccessText}>จ่ายแล้ว</Text>
                    </View>
                  )}
                  {isDueNow && (
                    <View style={styles.statusPillDue}>
                      <Ionicons name="alert-circle" size={12} color={colors.highlight} />
                      <Text style={styles.statusPillDueText}>ถึงเวลาแล้ว</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.instruction}>
                  {[item.dose, item.instruction].filter(Boolean).join(' · ')}
                </Text>
                {!!item.time_slot && (
                  <View style={styles.timeSlotRow}>
                    {item.time_slot.split(',').map((slot) => (
                      <View key={slot} style={styles.timeSlotPill}>
                        <Ionicons name="time-outline" size={11} color={colors.ink} />
                        <Text style={styles.timeSlotText}>{slot} น.</Text>
                      </View>
                    ))}
                  </View>
                )}
                {!!item.qr_code_cassette && (
                  <View style={styles.cassetteRow}>
                    <Ionicons name="qr-code-outline" size={12} color={colors.muted} />
                    <Text style={styles.cassetteQr}>{item.qr_code_cassette}</Text>
                  </View>
                )}
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={styles.centerStage}>
              <Text style={styles.meta}>
                {showAll ? 'ไม่มีรายการยาที่ต้องจ่าย' : 'ยังไม่ถึงเวลาให้ยารายการใดในตอนนี้'}
              </Text>
            </View>
          }
        />
      )}
    </FadeInView>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.md + 2,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
  },
  scanButton: {
    marginTop: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md + 2,
  },
  // Outlined segmented-control tab, not a card — border stays here on
  // purpose (same reasoning as Button's `outline` variant), it's not the
  // "border standing in for elevation" anti-pattern this pass targets.
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  filterTabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  filterTabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl + spacing.sm,
  },
  // Elevation-not-border card, same treatment as the patient list/slot list
  // cards — the medication card is the single most-viewed surface in the
  // app (opened on every patient tap), so it's the highest-value place to
  // bring in line with the rest of the "Warm Trust" screens.
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  cardDispensed: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  statusPillSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.success,
  },
  statusPillSuccessText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  statusPillDue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  statusPillDueText: {
    color: colors.highlight,
    fontSize: 11,
    fontWeight: '800',
  },
  indexBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  indexBadgeText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  cardTopText: {
    flex: 1,
    gap: spacing.xs + 2,
  },
  drugName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  drugNameDispensed: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  purposePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  purposeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  instruction: {
    color: colors.muted,
    fontSize: 13,
  },
  timeSlotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  timeSlotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeSlotText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  cassetteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  cassetteQr: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: 'monospace',
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
