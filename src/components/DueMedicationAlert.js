import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Button from './Button'
import { colors, radius, shadow, spacing } from '../constants/theme'

export default function DueMedicationAlert({ items, onViewMissed, onDismiss }) {
  const visible = items.length > 0

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="alert-circle" size={26} color="#FFFFFF" />
          </View>

          <Text style={styles.title}>ถึงเวลาให้ยาแล้ว</Text>
          <Text style={styles.subtitle}>{items.length} รายการที่ถึงกำหนดตอนนี้</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {items.map((item) => (
              <View key={item.order_id} style={styles.row}>
                <Ionicons name="time-outline" size={13} color={colors.highlight} />
                <Text style={styles.rowText}>
                  {item.patient_name} (เตียง {item.bed_no}) — {item.drug_name} เวลา{' '}
                  {item.matched_time} น.
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Button
              label="ไปที่ยาที่ค้างจ่าย"
              onPress={onViewMissed}
              variant="primary"
              icon="arrow-forward"
              style={styles.actionButton}
            />
            <Button
              label="ปิด"
              onPress={onDismiss}
              variant="outline"
              fullWidth={false}
              style={styles.dismissButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Warm near-black backdrop (same family as shadow.card.shadowColor)
    // instead of a neutral black/gray scrim, so the dimmed layer behind the
    // modal still reads as part of the warm palette rather than a leftover
    // cool-toned overlay dropped on top of it.
    backgroundColor: 'rgba(58,46,31,0.55)',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.raised,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.highlight,
    marginBottom: spacing.md + 2,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  list: {
    alignSelf: 'stretch',
    maxHeight: 160,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: {
    flex: 1,
    color: colors.ink,
    fontSize: 12.5,
    lineHeight: 18,
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: spacing.lg + 2,
    gap: spacing.sm,
  },
  actionButton: {
    minHeight: 46,
  },
  dismissButton: {
    alignSelf: 'center',
  },
})
