import { useRef, useState } from 'react'
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import { resetNursePasswordWithCode } from '../services/nurseAuthService'
import { colors, radius, shadow, spacing } from '../constants/theme'

export default function ResetPasswordScreen({ email: initialEmail, onBack, onSuccess }) {
  const [email, setEmail] = useState(initialEmail || '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [secureEntry, setSecureEntry] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const codeRef = useRef(null)
  const passwordRef = useRef(null)

  const handleSubmit = async () => {
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const message = await resetNursePasswordWithCode({ email, code, newPassword })
      onSuccess(message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <LinkButton label="เข้าสู่ระบบ" onPress={onBack} />

      <Text style={styles.title}>ตั้งรหัสผ่านใหม่</Text>
      <Text style={styles.subtitle}>
        กรอกรหัสยืนยัน 6 หลักที่ได้รับทางอีเมล พร้อมรหัสผ่านใหม่ที่ต้องการใช้ (รหัสมีอายุ 15 นาที ใช้ได้ครั้งเดียว)
      </Text>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>อีเมล</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="เช่น suda@example.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            editable={!loading}
            onSubmitEditing={() => codeRef.current?.focus()}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>รหัสยืนยัน 6 หลัก</Text>
          <TextInput
            ref={codeRef}
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            returnKeyType="next"
            editable={!loading}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>รหัสผ่านใหม่</Text>
          <View style={styles.passwordRow}>
            <TextInput
              ref={passwordRef}
              style={styles.inputInRow}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              placeholderTextColor={colors.muted}
              secureTextEntry={secureEntry}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              returnKeyType="done"
              editable={!loading}
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              style={styles.visibilityButton}
              onPress={() => setSecureEntry((v) => !v)}
              disabled={loading}
              activeOpacity={0.6}
            >
              <Text style={styles.visibilityButtonText}>{secureEntry ? 'แสดง' : 'ซ่อน'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          label={loading ? 'กำลังตั้งรหัสผ่าน...' : 'ตั้งรหัสผ่านใหม่'}
          onPress={handleSubmit}
          loading={loading}
          variant="primary"
        />
      </View>
    </ScrollView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: 40 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 19 },
  card: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.raised,
  },
  field: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    color: colors.ink,
    fontSize: 16,
  },
  codeInput: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  inputInRow: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
  visibilityButton: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  visibilityButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
})
