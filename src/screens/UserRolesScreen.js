import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Button from '../components/Button'
import ConfirmDialog from '../components/ConfirmDialog'
import LinkButton from '../components/LinkButton'
import { deleteNurseAccount, fetchNurseAccounts, setNurseRole } from '../api'
import { colors, radius, spacing } from '../constants/theme'

export const ROLE_LABELS = { admin: 'ผู้ดูแลระบบ', nurse: 'พยาบาลจ่ายยา' }

// Admin only: who is an admin. Admins can delete patients, catalog medicines,
// drugs from a meal and slot assignments; dispensing nurses can't.
export default function UserRolesScreen({ nurse, onBack }) {
  const [accounts, setAccounts] = useState(null)
  const [error, setError] = useState(null)
  const [changing, setChanging] = useState(null) // { account, role }
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null) // account

  const load = useCallback(() => {
    setError(null)
    fetchNurseAccounts({ token: nurse.token })
      .then(setAccounts)
      .catch((err) => setError(err.message))
  }, [nurse.token])

  useEffect(() => {
    load()
  }, [load])

  const confirmChange = async () => {
    setSaving(true)
    try {
      const updated = await setNurseRole({ token: nurse.token, nurseId: changing.account.nurse_id, role: changing.role })
      setAccounts((list) => list.map((a) => (a.nurse_id === updated.nurse_id ? updated : a)))
      setChanging(null)
    } catch (err) {
      setError(err.message)
      setChanging(null)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    setSaving(true)
    try {
      await deleteNurseAccount({ token: nurse.token, nurseId: deleting.nurse_id })
      setAccounts((list) => list.filter((a) => a.nurse_id !== deleting.nurse_id))
      setDeleting(null)
    } catch (err) {
      setError(err.message)
      setDeleting(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <LinkButton label="บัญชีผู้ใช้" onPress={onBack} />
      <Text style={styles.title}>จัดการสิทธิ์ผู้ใช้</Text>
      <Text style={styles.subtitle}>
        ผู้ดูแลระบบลบผู้ป่วย ลบยาจากคลังยา ลบยาออกจากมื้อ เคลียร์ช่องยา และจัดการบัญชีผู้ใช้ได้ ส่วนพยาบาลจ่ายยาทำรายการเหล่านี้ไม่ได้
        คนที่สมัครใหม่จะเป็นพยาบาลจ่ายยาเสมอ
      </Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {accounts === null && !error ? (
        <ActivityIndicator color={colors.accent} />
      ) : accounts === null ? (
        <Button label="ลองใหม่" onPress={load} variant="outline" fullWidth={false} />
      ) : (
        <View style={styles.card}>
          {accounts.map((a, i) => {
            const isSelf = a.nurse_id === nurse.nurse_id
            const admin = a.role === 'admin'
            return (
              <View key={a.nurse_id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={styles.rowBody}>
                  <Text style={styles.name}>
                    {a.full_name}
                    {isSelf ? ' (คุณ)' : ''}
                  </Text>
                  <Text style={styles.meta}>@{a.username}</Text>
                </View>
                <View style={[styles.rolePill, admin && styles.rolePillAdmin]}>
                  <Text style={[styles.roleText, admin && styles.roleTextAdmin]}>{ROLE_LABELS[a.role] || a.role}</Text>
                </View>
                {!isSelf && (
                  <TouchableOpacity
                    style={styles.changeButton}
                    onPress={() => setChanging({ account: a, role: admin ? 'nurse' : 'admin' })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.changeText}>{admin ? 'ถอดสิทธิ์' : 'ตั้งเป็นผู้ดูแล'}</Text>
                  </TouchableOpacity>
                )}
                {!isSelf && (
                  <TouchableOpacity
                    style={styles.changeButton}
                    onPress={() => setDeleting(a)}
                    activeOpacity={0.7}
                    accessibilityLabel={`ลบบัญชี ${a.full_name}`}
                  >
                    <Text style={styles.deleteText}>ลบบัญชี</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })}
        </View>
      )}

      <ConfirmDialog
        visible={!!deleting}
        icon="trash-outline"
        title={deleting ? `ลบบัญชี "${deleting.full_name}"?` : ''}
        message="บัญชีนี้จะเข้าสู่ระบบไม่ได้อีก และเครื่องที่ล็อกอินค้างไว้จะออกจากระบบทันที ประวัติการจ่ายยาที่คนนี้เคยบันทึกยังเก็บไว้ครบพร้อมชื่อ"
        confirmLabel="ลบบัญชี"
        loading={saving}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        visible={!!changing}
        icon="shield-checkmark-outline"
        title={
          changing
            ? `เปลี่ยน "${changing.account.full_name}" เป็น${ROLE_LABELS[changing.role]}?`
            : ''
        }
        confirmLabel="ยืนยัน"
        danger={changing?.role === 'nurse'}
        loading={saving}
        onConfirm={confirmChange}
        onCancel={() => setChanging(null)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.md + 2, paddingTop: 28, paddingBottom: 40 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  card: {
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12, flexWrap: 'wrap' },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowBody: { flex: 1, minWidth: 140, gap: 2 },
  name: { color: colors.ink, fontSize: 14.5, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12.5 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  rolePillAdmin: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  roleText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  roleTextAdmin: { color: colors.accent },
  changeButton: { paddingHorizontal: 10, paddingVertical: 6 },
  changeText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
})
