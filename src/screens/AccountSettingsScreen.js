import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import { uploadNurseProfilePhoto } from '../api'
import { changeNurseOwnPassword, updateNurseProfileDetails } from '../services/nurseAuthService'
import { colors, gradients, radius, shadow, spacing } from '../constants/theme'

export default function AccountSettingsScreen({ nurse, onBack, onProfileUpdated }) {
  const [fullName, setFullName] = useState(nurse.full_name || '')
  const [username, setUsername] = useState(nurse.username || '')
  const [email, setEmail] = useState(nurse.email || '')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState(null)
  const [profileSaved, setProfileSaved] = useState(false)

  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState(null)
  const initial = nurse.full_name?.trim()?.charAt(0) || 'N'

  const handlePickPhoto = async () => {
    if (photoUploading) return
    setPhotoError(null)

    let result
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        // 0.7 (not the 1.0 default) - the picker's own compression is enough
        // to keep uploads small without a separate resize step, matching the
        // 5MB limit the backend enforces.
        quality: 0.7,
      })
    } catch (err) {
      setPhotoError('เปิดคลังภาพไม่สำเร็จ กรุณาลองใหม่')
      return
    }

    if (result.canceled || !result.assets?.[0]) return

    setPhotoUploading(true)
    try {
      const updated = await uploadNurseProfilePhoto({ token: nurse.token, imageUri: result.assets[0].uri })
      onProfileUpdated({ profile_photo_url: updated.profile_photo_url })
    } catch (err) {
      setPhotoError(err.message)
    } finally {
      setPhotoUploading(false)
    }
  }

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [secureEntry, setSecureEntry] = useState(true)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState(null)
  const [passwordSaved, setPasswordSaved] = useState(false)

  const handleSaveProfile = async () => {
    if (profileLoading) return
    setProfileError(null)
    setProfileSaved(false)
    setProfileLoading(true)
    try {
      const updated = await updateNurseProfileDetails({ token: nurse.token, fullName, username, email })
      onProfileUpdated(updated)
      setProfileSaved(true)
    } catch (err) {
      setProfileError(err.message)
    } finally {
      setProfileLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordLoading) return
    setPasswordError(null)
    setPasswordSaved(false)
    setPasswordLoading(true)
    try {
      await changeNurseOwnPassword({ token: nurse.token, currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setPasswordSaved(true)
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <LinkButton label="กลับ" onPress={onBack} />

      <Text style={styles.title}>บัญชีผู้ใช้</Text>
      <Text style={styles.subtitle}>แก้ไขข้อมูลบัญชีของคุณเอง — แก้ไขได้เฉพาะบัญชีนี้เท่านั้น</Text>

      <View style={styles.photoSection}>
        <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8} disabled={photoUploading}>
          <View style={styles.photoWrap}>
            {nurse.profile_photo_url ? (
              <Image source={{ uri: nurse.profile_photo_url }} style={styles.photo} />
            ) : (
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.photo}
              >
                <Text style={styles.photoInitial}>{initial}</Text>
              </LinearGradient>
            )}
            <View style={styles.photoBadge}>
              {photoUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              )}
            </View>
          </View>
        </TouchableOpacity>
        {!!photoError && <Text style={styles.error}>{photoError}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>ข้อมูลส่วนตัว</Text>

        <View style={styles.field}>
          <Text style={styles.label}>ชื่อ-นามสกุล</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            editable={!profileLoading}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>ชื่อผู้ใช้</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            editable={!profileLoading}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>อีเมล</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!profileLoading}
          />
        </View>

        {!!profileError && <Text style={styles.error}>{profileError}</Text>}
        {!!profileSaved && !profileError && <Text style={styles.success}>บันทึกข้อมูลสำเร็จ</Text>}

        <Button
          label={profileLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          onPress={handleSaveProfile}
          loading={profileLoading}
          variant="primary"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>เปลี่ยนรหัสผ่าน</Text>

        <View style={styles.field}>
          <Text style={styles.label}>รหัสผ่านเดิม</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="กรอกรหัสผ่านปัจจุบัน"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!passwordLoading}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>รหัสผ่านใหม่</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.inputInRow}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              placeholderTextColor={colors.muted}
              secureTextEntry={secureEntry}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              editable={!passwordLoading}
              onSubmitEditing={handleChangePassword}
            />
            <TouchableOpacity
              style={styles.visibilityButton}
              onPress={() => setSecureEntry((v) => !v)}
              disabled={passwordLoading}
              activeOpacity={0.6}
            >
              <Text style={styles.visibilityButtonText}>{secureEntry ? 'แสดง' : 'ซ่อน'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!!passwordError && <Text style={styles.error}>{passwordError}</Text>}
        {!!passwordSaved && !passwordError && <Text style={styles.success}>เปลี่ยนรหัสผ่านสำเร็จ</Text>}

        <Button
          label={passwordLoading ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'เปลี่ยนรหัสผ่าน'}
          onPress={handleChangePassword}
          loading={passwordLoading}
          variant="outline"
          icon="key-outline"
        />
      </View>
    </ScrollView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: 40 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  photoSection: { alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  photoWrap: { width: 96, height: 96 },
  photo: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    ...shadow.raised,
  },
  photoInitial: { color: '#FFFFFF', fontSize: 34, fontWeight: '800' },
  photoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.bg,
  },
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
  cardTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  success: { color: colors.success, fontSize: 13, textAlign: 'center', fontWeight: '700' },
})
