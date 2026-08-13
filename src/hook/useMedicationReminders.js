import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { fetchDueMedications, fetchReminderTimes } from '../api'
import {
  ensureNotificationPermission,
  presentDueMedicationNotification,
  scheduleDailyReminders,
} from '../utils/notifications'

const POLL_INTERVAL_MS = 60000
// Today's dose times rarely change (only when meds are added/edited), so this
// doesn't need to run every poll tick — scheduleDailyReminders also no-ops
// internally if the set of times is unchanged since the last call.
const RESCHEDULE_INTERVAL_MS = 10 * 60000

export function useMedicationReminders() {
  const seenRef = useRef(new Set())
  const [dueCount, setDueCount] = useState(0)
  const [alertItems, setAlertItems] = useState([])

  useEffect(() => {
    const canNotifyWeb = Platform.OS === 'web' && typeof Notification !== 'undefined'

    if (canNotifyWeb && Notification.permission === 'default') {
      Notification.requestPermission()
    } else if (Platform.OS !== 'web') {
      ensureNotificationPermission()
    }

    const checkDueMedications = () => {
      fetchDueMedications()
        .then((items) => {
          setDueCount(items.length)

          const newItems = items.filter((item) => !seenRef.current.has(item.order_id))
          if (newItems.length === 0) return

          newItems.forEach((item) => seenRef.current.add(item.order_id))
          setAlertItems(newItems)

          if (canNotifyWeb && Notification.permission === 'granted') {
            newItems.forEach((item) => {
              new Notification('ถึงเวลาให้ยา', {
                body: `${item.patient_name} (เตียง ${item.bed_no}) — ${item.drug_name} เวลา ${item.matched_time} น.`,
                tag: `med-${item.order_id}`,
              })
            })
          } else if (Platform.OS !== 'web') {
            newItems.forEach((item) => presentDueMedicationNotification(item))
          }
        })
        .catch(() => {})
    }

    const reschedule = () => {
      if (Platform.OS === 'web') return
      fetchReminderTimes()
        .then(scheduleDailyReminders)
        .catch(() => {})
    }

    checkDueMedications()
    reschedule()
    const pollId = setInterval(checkDueMedications, POLL_INTERVAL_MS)
    const rescheduleId = setInterval(reschedule, RESCHEDULE_INTERVAL_MS)

    return () => {
      clearInterval(pollId)
      clearInterval(rescheduleId)
    }
  }, [])

  const dismissAlert = () => setAlertItems([])

  return { dueCount, alertItems, dismissAlert }
}
