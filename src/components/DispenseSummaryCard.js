import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { fetchDispenseStats } from '../api'
import { gradients, radius, shadow, spacing } from '../constants/theme'

export default function DispenseSummaryCard({ onPress }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetchDispenseStats()
      .then(setStats)
      .catch(() => {})
  }, [])

  if (!stats) return null

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.button}>
        <View style={styles.icon}>
          <Ionicons name="stats-chart" size={18} color="#FFFFFF" />
        </View>

        <View style={styles.textGroup}>
          <Text style={styles.title}>สรุปการจ่ายยา</Text>
          <Text style={styles.subtitle}>
            จ่ายแล้ว {stats.dispensed}/{stats.total} รายการ ({stats.dispensed_rate}%)
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </LinearGradient>
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
    ...shadow.card,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  textGroup: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
})
