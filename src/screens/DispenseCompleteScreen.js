import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Button from '../components/Button'
import { colors, radius, shadow, spacing } from '../constants/theme'

function formatTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function DispenseCompleteScreen({ nurse, patient, medications, onBack }) {
  const total = medications.length
  const lastDispensedAt = medications
    .map((item) => item.dispensed_at)
    .filter(Boolean)
    .sort()
    .pop()
  const locationText = [patient.ward, patient.bed_no && `เตียง ${patient.bed_no}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <ScrollView
      style={styles.shell}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.icon}>
        <Ionicons name="checkmark" size={36} color="#FFFFFF" />
      </View>

      <Text style={styles.title}>จ่ายยาครบทุกรายการแล้ว</Text>
      <Text style={styles.subtitle}>
        {patient.full_name}
        {locationText ? ` · ${locationText}` : ''}
      </Text>

      {!!nurse?.full_name && (
        <View style={styles.nurseRow}>
          <Ionicons name="person-circle-outline" size={15} color={colors.accent} />
          <Text style={styles.nurseText}>จ่ายโดยพยาบาล {nurse.full_name}</Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>รายการที่จ่ายแล้ว</Text>
        </View>
        {!!lastDispensedAt && (
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatTime(lastDispensedAt)}</Text>
            <Text style={styles.statLabel}>จ่ายรายการล่าสุดเมื่อ</Text>
          </View>
        )}
      </View>

      <View style={styles.list}>
        {medications.map((item) => (
          <View key={item.order_id} style={styles.listRow}>
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
            <Text style={styles.listRowText}>
              {item.drug_name}
              {item.standard_dose ? ` ${item.standard_dose}` : ''}
            </Text>
            <Text style={styles.listRowTime}>{formatTime(item.dispensed_at)} น.</Text>
          </View>
        ))}
      </View>

      <Button
        label="กลับไปรายชื่อผู้ป่วย"
        onPress={onBack}
        variant="primary"
        icon="arrow-back"
        style={styles.backButton}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingBottom: spacing.xxl + spacing.sm,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    marginBottom: spacing.lg + 2,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: spacing.sm - 2,
    textAlign: 'center',
  },
  nurseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm + 2,
  },
  nurseText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    width: '100%',
  },
  // Elevation-not-border, same pattern as the medication list card — this
  // screen is the very last thing a nurse sees after every dispense round,
  // so it should read as part of the same surface language as everything
  // before it, not a leftover flat-bordered card.
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  statValue: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  list: {
    width: '100%',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  listRowText: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  listRowTime: {
    color: colors.muted,
    fontSize: 12,
  },
  backButton: {
    marginTop: spacing.xl + 4,
  },
})
