import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { BEFORE_AFTER_LABELS, MAIN_MEALS, MEAL_LABELS } from '../constants/meals'
import { colors, radius, spacing } from '../constants/theme'

// Renders the 9 meal values grouped as 4 main-meal cards (each with a
// ก่อนอาหาร/หลังอาหาร pair) plus PRN on its own - replaces a flat 9-pill row,
// which stopped being scannable once "ก่อน/หลังอาหาร" doubled the old 4
// real-meal count. `value` is one of MEALS, `onChange` receives one back.
export default function MealPicker({ value, onChange }) {
  return (
    <View style={styles.wrap}>
      {MAIN_MEALS.map((main) => (
        <View key={main.key} style={styles.mainCard}>
          <Text style={styles.mainLabel}>{main.label}</Text>
          <View style={styles.subRow}>
            {['before', 'after'].map((phase) => {
              const meal = main[phase]
              const isActive = value === meal
              return (
                <TouchableOpacity
                  key={meal}
                  style={[styles.subPill, isActive && styles.subPillActive]}
                  onPress={() => onChange(meal)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subPillText, isActive && styles.subPillTextActive]}>
                    {BEFORE_AFTER_LABELS[phase]}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.prnPill, value === 'prn' && styles.prnPillActive]}
        onPress={() => onChange('prn')}
        activeOpacity={0.7}
      >
        <Text style={[styles.prnPillText, value === 'prn' && styles.prnPillTextActive]}>
          {MEAL_LABELS.prn}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  mainCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    padding: spacing.sm + 2, borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  mainLabel: { color: colors.ink, fontSize: 14, fontWeight: '700', width: 66 },
  subRow: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  subPill: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  subPillActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  subPillText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  subPillTextActive: { color: '#FFFFFF' },
  prnPill: {
    alignItems: 'center', paddingVertical: spacing.sm + 2, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  prnPillActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  prnPillText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  prnPillTextActive: { color: '#FFFFFF' },
})
