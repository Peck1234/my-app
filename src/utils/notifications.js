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

// Cancels and re-schedules one daily-repeating reminder PER (medication,
// dose time) still ahead today across the whole roster's pending
// medications - each with the specific patient/drug in its content, not a
// generic "check the app" ping. These are real OS-scheduled local
// notifications (AlarmManager under the hood on Android), so unlike the
// old JS-poll-loop approach they still fire while the app is closed.
//
// Safe to call repeatedly — it diffs against the previously scheduled set
// and only touches the OS scheduler when the items actually changed, so
// this doesn't need to run on every 60s poll tick.
let lastScheduledSignature = null

function itemSignature(items) {
  return items
    .map((item) => `${item.order_id}|${item.time}|${item.drug_name}|${item.patient_name}|${item.bed_no}`)
    .sort()
    .join(';')
}

export async function scheduleDailyReminders(items) {
  if (Platform.OS === 'web' || items.length === 0) return

  const signature = itemSignature(items)
  if (signature === lastScheduledSignature) return

  await Notifications.cancelAllScheduledNotificationsAsync()

  for (const item of items) {
    const [hour, minute] = item.time.split(':').map(Number)
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue

    // SchedulableTriggerInputTypes.CALENDAR (what this used before) has no
    // case in expo-notifications' own Android native module - every "calendar"
    // trigger throws InvalidArgumentException("Trigger of type: calendar is
    // not supported on Android"), silently swallowed by the .catch() this is
    // called under. So every reminder ever "scheduled" on Android was
    // actually rejected instantly and never reached the OS scheduler at all.
    // DAILY takes the same hour/minute and is natively supported on both
    // platforms (and is inherently repeating, so no `repeats` flag needed).
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'ถึงเวลาให้ยา',
        body: `${item.patient_name} (เตียง ${item.bed_no || '-'}) — ${item.drug_name} เวลา ${item.time} น.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: Platform.OS === 'android' ? REMINDER_CHANNEL_ID : undefined,
      },
    })
  }

  lastScheduledSignature = signature
}
