import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import LinkButton from '../components/LinkButton'
import { fetchSlotHistory } from '../api'
import { colors, radius } from '../constants/theme'

const ACTION_META = {
  create: { icon: 'add-circle', color: colors.accent, label: 'สร้างช่อง' },
  assign: { icon: 'person-add', color: colors.success, label: 'ผูกผู้ป่วย' },
  update: { icon: 'pencil', color: colors.accent, label: 'แก้ไขข้อมูล' },
  discharge: { icon: 'log-out-outline', color: colors.warning, label: 'เคลียร์ช่อง' },
  reject: { icon: 'close-circle', color: colors.danger, label: 'พยายามแก้ไข (ถูกปฏิเสธ)' },
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export default function SlotHistoryScreen({ slot, onBack }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSlotHistory(slot.id)
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slot.id])

  return (
    <View style={styles.shell}>
      <LinkButton label={`ช่อง ${slot.slot_code}`} onPress={onBack} />
      <Text style={styles.title}>ประวัติช่อง {slot.slot_code}</Text>
      <Text style={styles.subtitle}>เรียงจากล่าสุดไปเก่าสุด — แก้ไขหรือลบไม่ได้</Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.centerStage}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.centerStage}>
          <Ionicons name="time-outline" size={32} color={colors.muted} />
          <Text style={styles.emptyText}>ยังไม่มีประวัติ</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item, index) => `${item.occurred_at}-${index}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const meta = ACTION_META[item.action] || { icon: 'ellipse', color: colors.muted, label: item.action }
            return (
              <View style={styles.logCard}>
                <View style={[styles.logIcon, { backgroundColor: `${meta.color}1A` }]}>
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                </View>
                <View style={styles.logBody}>
                  <View style={styles.logTopRow}>
                    <Text style={[styles.logAction, { color: meta.color }]}>{meta.label}</Text>
                    <Text style={styles.logTime}>{formatTime(item.occurred_at)}</Text>
                  </View>
                  <Text style={styles.logStaff}>{item.staff_name || 'ไม่ทราบผู้ทำรายการ'}</Text>
                </View>
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1, gap: 14, paddingTop: 28 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13.5 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  centerStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { color: colors.muted, fontSize: 13.5 },
  list: { gap: 8, paddingBottom: 20 },
  logCard: {
    flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  logIcon: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  logBody: { flex: 1, gap: 2 },
  logTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logAction: { fontSize: 13.5, fontWeight: '800' },
  logTime: { color: colors.muted, fontSize: 11.5 },
  logStaff: { color: colors.muted, fontSize: 12.5 },
})
