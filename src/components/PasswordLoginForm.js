import { useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Button from './Button'
import { colors, radius, shadow, spacing } from '../constants/theme'

export default function PasswordLoginForm({ error, loading, onSubmit }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [secureEntry, setSecureEntry] = useState(true)
  const passwordRef = useRef(null)

  const handleSubmit = () => {
    if (!loading) {
      onSubmit({ username: username.trim(), password })
    }
  }

  return (
    <View style={styles.card}>
      {/* ช่องชื่อผู้ใช้ */}
      <View style={styles.field}>
        <Text style={styles.label}>ชื่อผู้ใช้</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="กรอกชื่อผู้ใช้"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          returnKeyType="next"
          editable={!loading}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      </View>

      {/* ช่องรหัสผ่าน */}
      <View style={styles.field}>
        <Text style={styles.label}>รหัสผ่าน</Text>
        <View style={styles.passwordRow}>
          <TextInput
            ref={passwordRef}
            style={styles.inputInRow}
            value={password}
            onChangeText={setPassword}
            placeholder="กรอกรหัสผ่าน"
            placeholderTextColor={colors.muted}
            secureTextEntry={secureEntry}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
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
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button
        label={loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
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
})