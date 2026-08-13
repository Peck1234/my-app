import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { fetchDispenseStats } from '../api'
import { colors, gradients, radius, shadow, spacing } from '../constants/theme'

export default function DispenseSummaryCard({ onPress }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetchDispenseStats()
      .then(setStats)
      .catch(() => {})
  }, [])

  if (!stats) return null

  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.85}>
      {/* Gradient now lives only on the icon mark, not the whole card - this
          card sits on a white page next to other white cards, so a full
          gradient wash would be the loudest thing on screen for a
          secondary/supporting entry point. */}
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
        <Ionicons name="stats-chart" size={18} color="#FFFFFF" />
      </LinearGradient>

      <View style={styles.textGroup}>
        <Text style={styles.title}>สรุปการจ่ายยา</Text>
        <Text style={styles.subtitle}>
          จ่ายแล้ว {stats.dispensed}/{stats.total} รายการ ({stats.dispensed_rate}%)
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
})
