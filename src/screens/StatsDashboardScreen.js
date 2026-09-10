import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fetchDispenseStats } from '../api'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import { exportStatsPdf } from '../utils/exportStatsPdf'
import { colors, radius } from '../constants/theme'

// Was a generic navy (#12182A) unrelated to either theme this app has had -
// now the palette's own ink color, so this header block reads as part of the
// same indigo/violet family instead of a leftover neutral-dark block.
const NAVY = colors.ink
const NAVY_SOFT = 'rgba(255,255,255,0.65)'

function CardTitle({ icon, children }) {
  return (
    <View style={styles.cardTitleRow}>
      <Ionicons name={icon} size={15} color={colors.accent} />
      <Text style={styles.cardTitle}>{children}</Text>
    </View>
  )
}

function BarRow({ label, value, total }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <View style={styles.barRow}>
      <View style={styles.barRowTop}>
        <Text style={styles.barRowLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barRowMeta}>
          {value}/{total} ({pct}%)
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
    </View>
  )
}

export default function StatsDashboardScreen({ onBack, onViewLogs }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  const handleExportPdf = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await exportStatsPdf(stats)
    } catch (err) {
      setExportError(err.message)
    } finally {
      setExporting(false)
    }
  }

  const load = useCallback(() => {
    setLoading(true)
    setError(null)

    fetchDispenseStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <View style={styles.shell}>
        {!!onBack && <LinkButton label="รายชื่อผู้ป่วย" onPress={onBack} style={styles.backLink} />}
        <View style={styles.centerStage}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.shell}>
        {!!onBack && <LinkButton label="รายชื่อผู้ป่วย" onPress={onBack} style={styles.backLink} />}
        <View style={styles.centerStage}>
          <Text style={styles.error}>{error}</Text>
          <Button label="ลองใหม่" onPress={load} variant="primary" icon="refresh" fullWidth={false} />
        </View>
      </View>
    )
  }

  const maxTrend = Math.max(1, ...stats.trend.map((d) => d.dispensed))
  const maxDrugTotal = Math.max(1, ...stats.by_drug.map((d) => d.total))

  return (
    <ScrollView style={styles.shell} showsVerticalScrollIndicator={false}>
      {!!onBack && <LinkButton label="รายชื่อผู้ป่วย" onPress={onBack} style={styles.backLink} />}

      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="stats-chart" size={16} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.headerEyebrow}>ภาพรวม</Text>
            <Text style={styles.headerTitle}>สถิติการจ่ายยา</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <View style={styles.kpiLabelRow}>
              <Ionicons name="trending-up" size={12} color={NAVY_SOFT} />
              <Text style={styles.kpiLabel}>อัตราจ่ายยาแล้ว</Text>
            </View>
            <Text style={styles.kpiValue}>{stats.dispensed_rate}%</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpi}>
            <View style={styles.kpiLabelRow}>
              <Ionicons name="checkmark-done" size={12} color={NAVY_SOFT} />
              <Text style={styles.kpiLabel}>จ่ายแล้ว / ทั้งหมด</Text>
            </View>
            <Text style={styles.kpiValue}>
              {stats.dispensed} / {stats.total}
            </Text>
          </View>
        </View>

        <View style={styles.headerActionRow}>
          {!!onViewLogs && (
            <TouchableOpacity style={styles.logsLink} onPress={onViewLogs} activeOpacity={0.7}>
              <Ionicons name="time-outline" size={13} color="#FFFFFF" />
              <Text style={styles.logsLinkText}>ดูประวัติการจ่ายยา</Text>
              <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.exportLink}
            onPress={handleExportPdf}
            disabled={exporting}
            activeOpacity={0.7}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="download-outline" size={13} color="#FFFFFF" />
            )}
            <Text style={styles.logsLinkText}>{exporting ? 'กำลังสร้าง PDF...' : 'ส่งออก PDF'}</Text>
          </TouchableOpacity>
        </View>

        {!!exportError && <Text style={styles.exportError}>{exportError}</Text>}
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <CardTitle icon="calendar-outline">แนวโน้ม 7 วันล่าสุด</CardTitle>
          <View style={styles.sparkRow}>
            {stats.trend.map((d) => (
              <View key={d.date} style={styles.sparkCol}>
                <View style={styles.sparkBarTrack}>
                  <View
                    style={[
                      styles.sparkBarFill,
                      { height: `${(d.dispensed / maxTrend) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.sparkLabel}>{d.date.slice(5)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <CardTitle icon="time-outline">ตามช่วงเวลา</CardTitle>
          {stats.by_time_slot.map((row) => (
            <BarRow
              key={row.slot}
              label={`${row.slot} น.`}
              value={row.dispensed}
              total={row.total}
            />
          ))}
        </View>

        <View style={styles.card}>
          <CardTitle icon="location-outline">ตามวอร์ด</CardTitle>
          {stats.by_ward.map((row) => (
            <BarRow key={row.ward} label={row.ward} value={row.dispensed} total={row.total} />
          ))}
        </View>

        <View style={styles.card}>
          <CardTitle icon="medkit-outline">ตามรายการยา</CardTitle>
          {stats.by_drug.map((row) => (
            <View key={row.drug_name} style={styles.tableRow}>
              <Text style={styles.tableRowText} numberOfLines={1}>
                {row.drug_name}
              </Text>
              <View style={styles.tableBarTrack}>
                <View
                  style={[
                    styles.tableBarFill,
                    { width: `${(row.total / maxDrugTotal) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.tableRowCount}>{row.total}</Text>
            </View>
          ))}
          <View style={styles.tableTotalRow}>
            <Text style={styles.tableTotalText}>รวมทั้งหมด</Text>
            <Text style={styles.tableTotalText}>{stats.total}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingTop: 28,
  },
  backLink: {
    marginBottom: 14,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  header: {
    backgroundColor: NAVY,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerEyebrow: {
    color: NAVY_SOFT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  kpi: {
    flex: 1,
  },
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  kpiValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  kpiLabel: {
    color: NAVY_SOFT,
    fontSize: 12,
  },
  kpiDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 18,
  },
  headerActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  logsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  exportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  logsLinkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  exportError: {
    color: '#FCA5A5',
    fontSize: 11.5,
    marginTop: 10,
  },
  content: {
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  sparkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sparkCol: {
    alignItems: 'center',
    gap: 6,
  },
  sparkBarTrack: {
    width: 20,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  sparkBarFill: {
    width: '100%',
    backgroundColor: colors.accent,
  },
  sparkLabel: {
    color: colors.muted,
    fontSize: 10,
  },
  barRow: {
    marginBottom: 14,
  },
  barRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barRowLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  barRowMeta: {
    color: colors.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
    width: 110,
  },
  tableBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  tableRowCount: {
    color: colors.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    width: 24,
    textAlign: 'right',
  },
  tableTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  tableTotalText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
})
