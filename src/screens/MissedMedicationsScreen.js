import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fetchDueMedications } from '../api'
import Button from '../components/Button'
import { colors, radius, shadow, spacing } from '../constants/theme'

export default function MissedMedicationsScreen({ onSelectPatient }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)

    fetchDueMedications()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const groups = useMemo(() => {
    const byPatient = new Map()

    items.forEach((item) => {
      if (!byPatient.has(item.patient_id)) {
        byPatient.set(item.patient_id, {
          patient_id: item.patient_id,
          full_name: item.patient_name,
          ward: item.ward,
          bed_no: item.bed_no,
          qr_code_patient: item.qr_code_patient,
          medications: [],
        })
      }
      byPatient.get(item.patient_id).medications.push(item)
    })

    return Array.from(byPatient.values())
  }, [items])

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
        <Button label="ลองใหม่" onPress={load} variant="primary" fullWidth={false} />
      </View>
    )
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={groups}
      keyExtractor={(item) => item.patient_id}
      renderItem={({ item }) => {
        const initial = item.full_name?.trim()?.charAt(0) || '?'

        return (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() =>
              onSelectPatient({
                patient_id: item.patient_id,
                full_name: item.full_name,
                ward: item.ward,
                bed_no: item.bed_no,
                qr_code_patient: item.qr_code_patient,
              })
            }
          >
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={styles.cardTopText}>
                <Text style={styles.name}>{item.full_name}</Text>
                <View style={styles.metaRow}>
                  {!!item.ward && (
                    <View style={styles.wardPill}>
                      <Ionicons name="location" size={10} color={colors.accent} />
                      <Text style={styles.wardPillText}>{item.ward}</Text>
                    </View>
                  )}
                  {!!item.bed_no && <Text style={styles.meta}>เตียง {item.bed_no}</Text>}
                </View>
              </View>
              <View style={styles.countPill}>
                <Ionicons name="alert-circle" size={11} color={colors.highlight} />
                <Text style={styles.countPillText}>{item.medications.length} รายการ</Text>
              </View>
            </View>

            <View style={styles.medList}>
              {item.medications.map((med) => (
                <View key={med.order_id} style={styles.medRow}>
                  <Ionicons name="time-outline" size={12} color={colors.muted} />
                  <Text style={styles.medRowText}>
                    {med.drug_name} · {med.matched_time} น.
                  </Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        )
      }}
      ListEmptyComponent={
        <View style={styles.centerStage}>
          <Text style={styles.meta}>ยังไม่มียาที่ค้างจ่ายตอนนี้</Text>
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
    paddingBottom: spacing.xl,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl + spacing.sm,
  },
  // Elevation-not-border, same treatment as the other list cards — but this
  // list is specifically overdue medications, so the urgency cue doesn't
  // disappear with the border: it moves to a left accent stripe (still
  // impossible to miss when scanning the list) instead of outlining the
  // whole card, while shadow.card gives it the same lift as every other
  // surface in the app.
  card: {
    gap: spacing.sm + 2,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.highlight,
    ...shadow.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cardTopText: {
    flex: 1,
    gap: spacing.xs + 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  wardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 1,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  wardPillText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  countPill: {
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
  countPillText: {
    color: colors.highlight,
    fontSize: 11,
    fontWeight: '800',
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
  medList: {
    gap: spacing.xs,
    paddingLeft: 52, // aligned under the name, not a spacing-scale value (= avatar width 40 + cardTop gap)
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  medRowText: {
    color: colors.muted,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
})
