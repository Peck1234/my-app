import { useEffect, useState } from 'react'
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, spacing } from '../constants/theme'

const SEEN_KEY = 'backgroundReminderPromptSeen'

// Android only. Medication reminders are scheduled as real OS-level alarms
// (survive the app being closed), but several Android OEM skins (ColorOS/
// Oppo confirmed firsthand, MIUI/Xiaomi and Vivo's FuntouchOS are the same
// story) ship an extra battery-management layer on top of stock Android that
// kills the app's ability to actually post the notification when that alarm
// fires, unless the nurse has separately allowed "background activity" and
// "auto-start" for this app - a setting stock Android doesn't have, so there
// is no API to request it the way notification permission can be requested.
// Shown once after first login (nothing else in this app persists anything
// locally today, hence AsyncStorage rather than reusing existing state) -
// Linking.openSettings() is the only navigation target guaranteed to exist
// on every OEM; the exact next tap (Battery -> allow background activity)
// still has to be written out as instructions since the destination screen
// name and toggle wording vary by brand.
export default function BackgroundReminderPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'android') return

    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (!seen) setVisible(true)
      })
      .catch(() => {})
  }, [])

  const dismiss = () => {
    setVisible(false)
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {})
  }

  const openSettings = () => {
    Linking.openSettings().catch(() => {})
    dismiss()
  }

  if (Platform.OS !== 'android') return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconMark}>
            <Ionicons name="notifications-outline" size={22} color={colors.accent} />
          </View>
          <Text style={styles.title}>ตั้งค่าอีกนิดเพื่อให้แจ้งเตือนยาทำงานแน่นอน</Text>
          <Text style={styles.message}>
            มือถือบางยี่ห้อ (เช่น Oppo, Xiaomi, Vivo) จะปิดกั้นแอปไม่ให้แจ้งเตือนตอนปิดแอปอยู่ โดยค่าเริ่มต้น
          </Text>
          <Text style={styles.stepsTitle}>วิธีแก้ (ทำครั้งเดียว):</Text>
          <View style={styles.steps}>
            <Text style={styles.step}>1. กด "ไปตั้งค่า" ด้านล่าง</Text>
            <Text style={styles.step}>2. หาเมนู "แบตเตอรี่" ของแอปนี้</Text>
            <Text style={styles.step}>3. เปิด "อนุญาตกิจกรรมพื้นหลัง" และ "อนุญาตให้เริ่มต้นอัตโนมัติ"</Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.laterButton} onPress={dismiss}>
              <Text style={styles.laterButtonText}>ไว้ทีหลัง</Text>
            </Pressable>
            <Pressable style={styles.settingsButton} onPress={openSettings}>
              <Text style={styles.settingsButtonText}>ไปตั้งค่า</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,17,21,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  iconMark: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  title: {
    color: colors.ink,
    fontSize: 16.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  stepsTitle: {
    alignSelf: 'flex-start',
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  steps: {
    alignSelf: 'stretch',
    gap: spacing.xs + 2,
  },
  step: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    width: '100%',
    marginTop: spacing.xs,
  },
  laterButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  laterButtonText: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: '700',
  },
  settingsButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
})
