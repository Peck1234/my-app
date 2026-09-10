import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fetchDispenseLogs } from '../api'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import { colors, radius } from '../constants/theme'

function formatDateTime(isoString) {
  const date = new Date(isoString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${day}/${month} ${time} น.`
}

export default function DispenseLogScreen({ onBack }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)

    fetchDispenseLogs()
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        {!!onBack && <LinkButton label="กลับ" onPress={onBack} />}
        <Text style={styles.title}>ประวัติการจ่ายยา</Text>
        <Text style={styles.subtitle}>รายการสแกนล่าสุด 100 ครั้ง (ทั้งสำเร็จและไม่สำเร็จ)</Text>
      </View>

      {loading && (
        <View style={styles.centerStage}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {!loading && !!error && (
        <View style={styles.centerStage}>
          <Text style={styles.error}>{error}</Text>
          <Button label="ลองใหม่" onPress={load} variant="primary" icon="refresh" fullWidth={false} />
        </View>
      )}

      {!loading && !error && (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isCorrect = item.result === 'correct'

            return (
              <View style={[styles.row, isCorrect ? styles.rowSuccess : styles.rowError]}>
                <View
                  style={[
                    styles.resultIcon,
                    isCorrect ? styles.resultIconSuccess : styles.resultIconError,
                  ]}
                >
                  <Ionicons name={isCorrect ? 'checkmark' : 'close'} size={14} color="#FFFFFF" />
                </View>

                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>
                    {item.drug_name || item.cassette_qr}
                    {item.patient_name ? ` · ${item.patient_name}` : ''}
                  </Text>
                  <Text style={styles.rowMessage}>{item.message}</Text>
                  <View style={styles.metaRow}>
                    {!!item.nurse_name && (
                      <View style={styles.metaItem}>
                        <Ionicons name="person-outline" size={11} color={colors.muted} />
                        <Text style={styles.metaText}>{item.nurse_name}</Text>
                      </View>
                    )}
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={11} color={colors.muted} />
                      <Text style={styles.metaText}>{formatDateTime(item.created_at)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={styles.centerStage}>
              <Text style={styles.meta}>ยังไม่มีประวัติการสแกนจ่ายยา</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingTop: 28,
  },
  header: {
    gap: 4,
    marginBottom: 14,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
  },
  rowSuccess: {
    borderLeftColor: colors.success,
  },
  rowError: {
    borderLeftColor: colors.danger,
  },
  resultIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  resultIconSuccess: {
    backgroundColor: colors.success,
  },
  resultIconError: {
    backgroundColor: colors.danger,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  rowMessage: {
    color: colors.muted,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: colors.muted,
    fontSize: 11,
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
