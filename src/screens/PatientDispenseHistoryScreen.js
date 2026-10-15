import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import { exportPatientDispenseHistory, fetchPatientDispenseHistory } from '../api'
import { colors, radius, spacing } from '../constants/theme'

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const MAX_DAYS = 31
const PRESETS = [7, 14, 30]

// Local calendar dates as YYYY-MM-DD (the backend reads them in Thai time).
export function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  return toIsoDate(new Date(y, m - 1, d + days))
}

export function daysBetween(fromIso, toIso) {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000) + 1
}

export function thaiDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${THAI_MONTHS[m - 1]} ${String(y + 543).slice(-2)}`
}

function DateStepper({ label, value, onChange, min, max }) {
  const canBack = !min || value > min
  const canForward = !max || value < max
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={[styles.stepButton, !canBack && styles.stepButtonDisabled]}
          onPress={() => canBack && onChange(addDays(value, -1))}
          disabled={!canBack}
          accessibilityLabel={`${label} ย้อนไป 1 วัน`}
        >
          <Ionicons name="chevron-back" size={18} color={canBack ? colors.accent : colors.border} />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{thaiDate(value)}</Text>
        <TouchableOpacity
          style={[styles.stepButton, !canForward && styles.stepButtonDisabled]}
          onPress={() => canForward && onChange(addDays(value, 1))}
          disabled={!canForward}
          accessibilityLabel={`${label} ถัดไป 1 วัน`}
        >
          <Ionicons name="chevron-forward" size={18} color={canForward ? colors.accent : colors.border} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function PatientDispenseHistoryScreen({ nurse, patient, onBack }) {
  const today = toIsoDate(new Date())
  const [to, setTo] = useState(today)
  const [from, setFrom] = useState(addDays(today, -6))
  const [dispenses, setDispenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(null) // 'history' | null
  const [exportError, setExportError] = useState(null)

  const rangeDays = daysBetween(from, to)
  const safeName = patient.full_name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'patient'

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchPatientDispenseHistory({ token: nurse.token, patientId: patient.patient_id, from, to })
      .then((data) => setDispenses(data.dispenses || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [nurse.token, patient.patient_id, from, to])

  useEffect(() => {
    load()
  }, [load])

  const byDate = useMemo(() => {
    const groups = []
    for (const d of dispenses) {
      const last = groups[groups.length - 1]
      if (last && last.date === d.date) last.items.push(d)
      else groups.push({ date: d.date, items: [d] })
    }
    return groups
  }, [dispenses])

  const setPreset = (days) => {
    setTo(today)
    setFrom(addDays(today, -(days - 1)))
  }

  // Keep the range valid (from <= to, at most MAX_DAYS) whichever end moves.
  const changeFrom = (value) => {
    setFrom(value)
    if (daysBetween(value, to) > MAX_DAYS) setTo(addDays(value, MAX_DAYS - 1))
  }
  const changeTo = (value) => {
    setTo(value)
    if (daysBetween(from, value) > MAX_DAYS) setFrom(addDays(value, -(MAX_DAYS - 1)))
  }

  const runExport = async (kind, task) => {
    setExporting(kind)
    setExportError(null)
    try {
      await task()
    } catch (err) {
      setExportError({ kind, message: err.message })
    } finally {
      setExporting(null)
    }
  }

  const exportHistory = () =>
    runExport('history', () =>
      exportPatientDispenseHistory({
        token: nurse.token,
        patientId: patient.patient_id,
        from,
        to,
        fileName: `บันทึกการให้ยา-${safeName}-${from}_${to}.xlsx`,
      })
    )

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <LinkButton label={patient.full_name} onPress={onBack} />
      <Text style={styles.title}>บันทึกการให้ยา</Text>
      <Text style={styles.subtitle}>
        {[patient.full_name, patient.ward, patient.bed_no && `เตียง ${patient.bed_no}`].filter(Boolean).join(' · ')}
      </Text>

      <View style={styles.card}>
        <View style={styles.presetRow}>
          {PRESETS.map((days) => {
            const active = to === today && rangeDays === days
            return (
              <TouchableOpacity
                key={days}
                style={[styles.preset, active && styles.presetActive]}
                onPress={() => setPreset(days)}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetText, active && styles.presetTextActive]}>{days} วันล่าสุด</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={styles.stepperPair}>
          <DateStepper label="ตั้งแต่" value={from} onChange={changeFrom} max={to} />
          <DateStepper label="ถึง" value={to} onChange={changeTo} min={from} max={today} />
        </View>
        <Text style={styles.rangeNote}>{rangeDays} วัน (เลือกได้สูงสุด {MAX_DAYS} วัน)</Text>
        <Button
          label={exporting === 'history' ? 'กำลังสร้างไฟล์...' : 'ส่งออกบันทึกการให้ยา (Excel)'}
          onPress={exportHistory}
          loading={exporting === 'history'}
          disabled={!!exporting}
          variant="primary"
          icon="document-text-outline"
        />
        {exportError?.kind === 'history' && <Text style={styles.error}>{exportError.message}</Text>}
      </View>

      {loading ? (
        <View style={styles.centerStage}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.centerStage}>
          <Text style={styles.error}>{error}</Text>
          <Button label="ลองใหม่" onPress={load} variant="outline" fullWidth={false} />
        </View>
      ) : byDate.length === 0 ? (
        <View style={styles.centerStage}>
          <Ionicons name="document-outline" size={30} color={colors.muted} />
          <Text style={styles.emptyText}>ไม่มีการจ่ายยาในช่วงวันที่นี้</Text>
        </View>
      ) : (
        <>
          <Text style={styles.countText}>จ่ายยาทั้งหมด {dispenses.length} ครั้ง</Text>
          {byDate.map((group) => (
            <View key={group.date} style={styles.dayGroup}>
              <Text style={styles.dayTitle}>{thaiDate(group.date)}</Text>
              {group.items.map((d) => (
                <View key={d.id} style={styles.row}>
                  <Text style={styles.time}>{d.time}</Text>
                  <View style={styles.rowBody}>
                    <Text style={styles.drug}>
                      {d.drug_name}
                      {d.dose ? `  ${d.dose}` : ''}
                    </Text>
                    <Text style={styles.meta}>
                      {[d.meal_label, d.nurse_name && `จ่ายโดย ${d.nurse_name}`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.md + 2, paddingTop: 28, paddingBottom: 40 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13.5 },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  presetText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  presetTextActive: { color: '#FFFFFF' },
  stepperPair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stepper: { flexGrow: 1, flexBasis: 140, gap: 4 },
  stepperLabel: { color: colors.muted, fontSize: 12.5, fontWeight: '700' },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  stepButton: { paddingHorizontal: 10, paddingVertical: 9 },
  stepButtonDisabled: { opacity: 0.5 },
  stepperValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  rangeNote: { color: colors.muted, fontSize: 12 },
  centerStage: { alignItems: 'center', gap: spacing.md, paddingVertical: 32 },
  emptyText: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  countText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  dayGroup: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayTitle: { color: colors.accent, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  time: { color: colors.ink, fontSize: 14, fontWeight: '800', width: 48 },
  rowBody: { flex: 1, gap: 2 },
  drug: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12.5 },
})
