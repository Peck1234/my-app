import { useState } from 'react'
import { Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import { requestNursePasswordReset } from '../services/nurseAuthService'
import { colors, radius, shadow, spacing } from '../constants/theme'

export default function ForgotPasswordScreen({ onBack, onCodeSent }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sentMessage, setSentMessage] = useState(null)

  const handleSubmit = async () => {
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const message = await requestNursePasswordReset({ email })
      setSentMessage(message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    /* Web-only: Keyboard.dismiss() is shimmed on react-native-web as "blur
       the focused element", and a web click on a nested TextInput still
       bubbles up here, so wiring this on web blurred every field the
       instant it was clicked. No real keyboard to dismiss on web anyway. */
    <TouchableWithoutFeedback onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss} accessible={false}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <LinkButton label="เข้าสู่ระบบ" onPress={onBack} />

      <Text style={styles.title}>ลืมรหัสผ่าน</Text>
      <Text style={styles.subtitle}>
        กรอกอีเมลที่ใช้สมัครสมาชิกไว้ ระบบจะส่งรหัสยืนยัน 6 หลักไปให้ทางอีเมล
      </Text>

      {sentMessage ? (
        <View style={styles.sentCard}>
          <View style={styles.sentIcon}>
            <Ionicons name="mail-outline" size={26} color={colors.success} />
          </View>
          <Text style={styles.sentText}>{sentMessage}</Text>
          <Button
            label="กรอกรหัสยืนยัน"
            onPress={() => onCodeSent(email.trim())}
            variant="primary"
            icon="arrow-forward"
          />
        </View>
      ) : (
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
              returnKeyType="done"
              editable={!loading}
              onSubmitEditing={handleSubmit}
            />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button
            label={loading ? 'กำลังส่ง...' : 'ส่งรหัสยืนยัน'}
            onPress={handleSubmit}
            loading={loading}
            variant="primary"
          />
        </View>
      )}
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
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  sentCard: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.raised,
  },
  sentIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successBg,
  },
  sentText: {
    color: colors.ink,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },
})
