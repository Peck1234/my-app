import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import Button from '../components/Button'
import ConfirmDialog from '../components/ConfirmDialog'
import LinkButton from '../components/LinkButton'
import { fetchMealTimes, saveMealTimes } from '../api'
import { BEFORE_AFTER_LABELS, MAIN_MEALS } from '../constants/meals'
import { colors, radius, spacing } from '../constants/theme'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

// "730" / "7.30" / "7:30" -> "07:30", so nurses can type it however feels natural.
function normalizeTime(value) {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 3 || digits.length > 4) return value.trim()
  return `${digits.slice(0, -2).padStart(2, '0')}:${digits.slice(-2)}`
}

// Admin only: the ward-wide clock time of each of the 8 meal rounds. Saving
// moves every patient's drugs in a changed round (and their reminders) too.
export default function MealTimesScreen({ nurse, onBack }) {
  const [rounds, setRounds] = useState(null) // [{ meal, time, default_time }]
  const [form, setForm] = useState({})
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const apply = (data) => {
    setRounds(data)
    setForm(Object.fromEntries(data.map((r) => [r.meal, r.time])))
  }

  const load = useCallback(() => {
    setError(null)
    fetchMealTimes()
      .then(apply)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const byMeal = Object.fromEntries((rounds || []).map((r) => [r.meal, r]))
  const changed = (rounds || []).filter((r) => normalizeTime(form[r.meal] || '') !== r.time)
  const invalid = (rounds || []).filter((r) => !TIME_PATTERN.test(normalizeTime(form[r.meal] || '')))
  const isDefault = (rounds || []).every((r) => form[r.meal] === r.default_time)

  const setTime = (meal, value) => {
    setSaved(false)
    setForm((f) => ({ ...f, [meal]: value }))
  }

  const askToSave = () => {
    if (invalid.length > 0) {
      setError('กรอกเวลาเป็น ชั่วโมง:นาที เช่น 07:30')
      return
    }
    setError(null)
    setConfirming(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const times = Object.fromEntries(changed.map((r) => [r.meal, normalizeTime(form[r.meal])]))
      apply(await saveMealTimes({ token: nurse.token, times }))
      setSaved(true)
      setConfirming(false)
    } catch (err) {
      setError(err.message)
      setConfirming(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <LinkButton label="บัญชีผู้ใช้" onPress={onBack} />
      <Text style={styles.title}>เวลามื้อยา</Text>
      <Text style={styles.subtitle}>
        ใช้กับทั้งหอผู้ป่วย เมื่อบันทึก ยาของผู้ป่วยทุกคนในมื้อที่เปลี่ยนจะย้ายไปเวลาใหม่ รวมถึงการแจ้งเตือนและรายการยาที่ถึงเวลาจ่าย
      </Text>

      {rounds === null && !error ? (
        <ActivityIndicator color={colors.accent} />
      ) : rounds === null ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button label="ลองใหม่" onPress={load} variant="outline" fullWidth={false} />
        </>
      ) : (
        <>
          <View style={styles.card}>
            {MAIN_MEALS.map((main, i) => (
              <View key={main.key} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Text style={styles.mealName}>{main.label}</Text>
                <View style={styles.pair}>
                  {['before', 'after'].map((side) => {
                    const meal = main[side]
                    const value = form[meal] || ''
                    const bad = !TIME_PATTERN.test(normalizeTime(value))
                    return (
                      <View key={side} style={styles.field}>
                        <Text style={styles.fieldLabel}>{BEFORE_AFTER_LABELS[side]}</Text>
                        <TextInput
                          style={[styles.input, bad && styles.inputBad]}
                          value={value}
                          onChangeText={(v) => setTime(meal, v)}
                          onBlur={() => setTime(meal, normalizeTime(value))}
                          placeholder={byMeal[meal]?.default_time}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          accessibilityLabel={`${main.label} ${BEFORE_AFTER_LABELS[side]}`}
                        />
                        {value !== byMeal[meal]?.default_time && (
                          <Text style={styles.hint}>ค่าเริ่มต้น {byMeal[meal]?.default_time}</Text>
                        )}
                      </View>
                    )
                  })}
                </View>
              </View>
            ))}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
          {saved && changed.length === 0 && <Text style={styles.success}>บันทึกเวลามื้อยาแล้ว</Text>}

          <Button
            label="บันทึกเวลา"
            onPress={askToSave}
            disabled={changed.length === 0}
            variant="primary"
            icon="time-outline"
          />
          <Button
            label="คืนค่าเริ่มต้น"
            onPress={() => {
              setSaved(false)
              setForm(Object.fromEntries(rounds.map((r) => [r.meal, r.default_time])))
            }}
            disabled={isDefault}
            variant="outline"
            icon="refresh-outline"
          />
        </>
      )}

      <ConfirmDialog
        visible={confirming}
        icon="time-outline"
        title={`เปลี่ยนเวลา ${changed.length} มื้อ?`}
        message="ยาของผู้ป่วยทุกคนในมื้อเหล่านี้จะย้ายไปเวลาใหม่ทันที"
        confirmLabel="บันทึก"
        danger={false}
        loading={saving}
        onConfirm={save}
        onCancel={() => setConfirming(false)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.md + 2, paddingTop: 28, paddingBottom: 40 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  success: { color: colors.success, fontSize: 13, textAlign: 'center', fontWeight: '700' },
  card: {
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { paddingVertical: 12, gap: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  mealName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  pair: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1, gap: 4 },
  fieldLabel: { color: colors.muted, fontSize: 12.5, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    backgroundColor: colors.bg,
    textAlign: 'center',
  },
  inputBad: { borderColor: colors.danger },
  hint: { color: colors.muted, fontSize: 11.5, textAlign: 'center' },
})
