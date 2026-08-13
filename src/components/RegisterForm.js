import { useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Button from './Button'
import { colors, radius, shadow, spacing } from '../constants/theme'

export default function RegisterForm({ error, loading, onSubmit }) {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [secureEntry, setSecureEntry] = useState(true)
  const usernameRef = useRef(null)
  const passwordRef = useRef(null)

  const handleSubmit = () => {
    if (!loading) {
      onSubmit({ fullName: fullName.trim(), username: username.trim(), password })
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.field}>
        <Text style={styles.label}>ชื่อ-นามสกุล</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="เช่น สุดา ใจดี"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          returnKeyType="next"
          editable={!loading}
          onSubmitEditing={() => usernameRef.current?.focus()}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>ชื่อผู้ใช้</Text>
        <TextInput
          ref={usernameRef}
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="เช่น suda.rn"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          returnKeyType="next"
          editable={!loading}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>รหัสผ่าน</Text>
        <View style={styles.passwordRow}>
          <TextInput
            ref={passwordRef}
            style={styles.inputInRow}
            value={password}
            onChangeText={setPassword}
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
})
