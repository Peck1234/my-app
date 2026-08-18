import { useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Button from './Button'
import { colors, radius, shadow, spacing } from '../constants/theme'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const REQUIRED_MESSAGES = {
  fullName: 'กรุณากรอกชื่อ-นามสกุล',
  username: 'กรุณากรอกชื่อผู้ใช้',
  email: 'กรุณากรอกอีเมล',
  password: 'กรุณากรอกรหัสผ่าน',
}

export default function RegisterForm({ error, loading, onSubmit }) {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [secureEntry, setSecureEntry] = useState(true)
  // Per-field warnings shown when the user taps away from an empty/invalid
  // field - separate from `error` (the server/service-level message shown
  // after an actual submit attempt).
  const [fieldErrors, setFieldErrors] = useState({ fullName: null, username: null, email: null, password: null })
  const usernameRef = useRef(null)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  const clearFieldError = (field) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev))
  }

  const handleBlur = (field, value) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setFieldErrors((prev) => ({ ...prev, [field]: REQUIRED_MESSAGES[field] }))
      return
    }
    if (field === 'email' && !EMAIL_PATTERN.test(trimmed)) {
      setFieldErrors((prev) => ({ ...prev, email: 'รูปแบบอีเมลไม่ถูกต้อง' }))
      return
    }
    if (field === 'password' && trimmed.length < 6) {
      setFieldErrors((prev) => ({ ...prev, password: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }))
    }
  }

  const handleSubmit = () => {
    if (!loading) {
      onSubmit({ fullName: fullName.trim(), username: username.trim(), email: email.trim(), password })
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.field}>
        <Text style={styles.label}>ชื่อ-นามสกุล</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={(v) => {
            setFullName(v)
            clearFieldError('fullName')
          }}
          onBlur={() => handleBlur('fullName', fullName)}
          placeholder="เช่น สุดา ใจดี"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          returnKeyType="next"
          editable={!loading}
          onSubmitEditing={() => usernameRef.current?.focus()}
        />
        {!!fieldErrors.fullName && <Text style={styles.fieldError}>{fieldErrors.fullName}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>ชื่อผู้ใช้</Text>
        <TextInput
          ref={usernameRef}
          style={styles.input}
          value={username}
          onChangeText={(v) => {
            setUsername(v)
            clearFieldError('username')
          }}
          onBlur={() => handleBlur('username', username)}
          placeholder="เช่น suda.rn"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          returnKeyType="next"
          editable={!loading}
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        {!!fieldErrors.username && <Text style={styles.fieldError}>{fieldErrors.username}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>อีเมล</Text>
        <TextInput
          ref={emailRef}
          style={styles.input}
          value={email}
          onChangeText={(v) => {
            setEmail(v)
            clearFieldError('email')
          }}
          onBlur={() => handleBlur('email', email)}
          placeholder="เช่น suda@example.com"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          editable={!loading}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        {!!fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>รหัสผ่าน</Text>
        <View style={styles.passwordRow}>
          <TextInput
            ref={passwordRef}
            style={styles.inputInRow}
            value={password}
            onChangeText={(v) => {
              setPassword(v)
              clearFieldError('password')
            }}
            onBlur={() => handleBlur('password', password)}
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
            <Text style={styles.visibilityButtonText}>
              {secureEntry ? 'แสดง' : 'ซ่อน'}
            </Text>
          </TouchableOpacity>
        </View>
        {!!fieldErrors.password && <Text style={styles.fieldError}>{fieldErrors.password}</Text>}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button
        label={loading ? 'กำลังสร้างบัญชี...' : 'สมัครสมาชิก'}
        onPress={handleSubmit}
        loading={loading}
        variant="primary"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.raised,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
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
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  fieldError: {
    color: colors.danger,
    fontSize: 12,
  },
})
