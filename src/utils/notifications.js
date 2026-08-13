import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

// Local notifications only — no push server involved, so this keeps working
// in Expo Go (remote push is what got disabled there, not local scheduling).
const REMINDER_CHANNEL_ID = 'medication-reminders'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

let permissionRequested = false

export async function ensureNotificationPermission() {
  if (Platform.OS === 'web') return false
  if (permissionRequested) {
    const { status } = await Notifications.getPermissionsAsync()
    return status === 'granted'
  }

  permissionRequested = true

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'แจ้งเตือนรอบจ่ายยา',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true

  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function presentDueMedicationNotification(item) {
  if (Platform.OS === 'web') return

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'ถึงเวลาให้ยา',
      body: `${item.patient_name} (เตียง ${item.bed_no || '-'}) — ${item.drug_name} เวลา ${item.matched_time} น.`,
    },
    trigger: null,
  })
}

// Cancels and re-schedules one daily-repeating reminder per unique HH:MM time
// still ahead today across the whole roster's pending medications. Safe to
// call repeatedly — it diffs against the previously scheduled set and only
// touches the OS scheduler when the set of times actually changed, so this
// doesn't need to run on every 60s poll tick.
let lastScheduledSignature = null

export async function scheduleDailyReminders(times) {
  if (Platform.OS === 'web' || times.length === 0) return

  const signature = times.join(',')
  if (signature === lastScheduledSignature) return

  await Notifications.cancelAllScheduledNotificationsAsync()

  for (const time of times) {
    const [hour, minute] = time.split(':').map(Number)
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `ถึงเวลาให้ยารอบ ${time} น.`,
        body: 'ตรวจสอบรายการยาที่ต้องจ่ายในแอป',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
        channelId: Platform.OS === 'android' ? REMINDER_CHANNEL_ID : undefined,
      },
    })
  }

  lastScheduledSignature = signature
}
