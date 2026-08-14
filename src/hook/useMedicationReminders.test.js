import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { fetchDueMedications, fetchReminderTimes } from '../api'
import {
  ensureNotificationPermission,
  presentDueMedicationNotification,
} from '../utils/notifications'
import { useMedicationReminders } from './useMedicationReminders'

jest.mock('../api', () => ({
  fetchDueMedications: jest.fn(),
  fetchReminderTimes: jest.fn(),
}))

jest.mock('../utils/notifications', () => ({
  ensureNotificationPermission: jest.fn(),
  presentDueMedicationNotification: jest.fn(),
  scheduleDailyReminders: jest.fn(),
}))

const ITEM_A = {
  order_id: 1,
  patient_name: 'สมชาย ใจงาม',
  bed_no: '12',
  drug_name: 'Paracetamol',
  matched_time: '08:00',
}

describe('useMedicationReminders', () => {
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    jest.useFakeTimers()
    fetchDueMedications.mockResolvedValue([])
    fetchReminderTimes.mockResolvedValue(['08:00', '12:00'])
    ensureNotificationPermission.mockResolvedValue(true)
  })

  afterEach(async () => {
    Platform.OS = originalPlatformOS
    // Flush once more before switching back to real timers - otherwise a
    // dangling continuation from this test's fake-timer-driven interval can
    // resolve during the NEXT test's render, leaving its result.current null.
    await act(async () => {
      await Promise.resolve()
    })
    jest.useRealTimers()
  })

  it('polls due medications and requests notification permission once on mount (native)', async () => {
    Platform.OS = 'ios'
    const { unmount } = await renderHook(() => useMedicationReminders())

    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchDueMedications).toHaveBeenCalledTimes(1)
    expect(fetchReminderTimes).toHaveBeenCalledTimes(1)
    expect(ensureNotificationPermission).toHaveBeenCalledTimes(1)
    await unmount()
  })

  it('reflects the fetched list size as dueCount', async () => {
    Platform.OS = 'ios'
    fetchDueMedications.mockResolvedValue([ITEM_A, { ...ITEM_A, order_id: 2 }])
    const { result, unmount } = await renderHook(() => useMedicationReminders())

    await waitFor(() => expect(result.current.dueCount).toBe(2))
    await unmount()
  })

  it('surfaces a newly-seen due item as an alert and sends a native notification for it', async () => {
    Platform.OS = 'ios'
    fetchDueMedications.mockResolvedValue([ITEM_A])
    const { result, unmount } = await renderHook(() => useMedicationReminders())

    await waitFor(() => expect(result.current.alertItems).toEqual([ITEM_A]))
    expect(presentDueMedicationNotification).toHaveBeenCalledWith(ITEM_A)
    await unmount()
  })

  it('does not re-raise an alert for an item already seen in a previous poll', async () => {
    Platform.OS = 'ios'
    fetchDueMedications.mockResolvedValue([ITEM_A])
    const { result, unmount } = await renderHook(() => useMedicationReminders())

    await waitFor(() => expect(result.current.alertItems).toEqual([ITEM_A]))
    await act(async () => {
      result.current.dismissAlert()
      await Promise.resolve()
    })
    expect(result.current.alertItems).toEqual([])
    presentDueMedicationNotification.mockClear()

    // Same still-due item comes back on the next poll tick - it's already in
    // seenRef, so it must not be pushed into alertItems (or notified) again.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60000)
    })

    expect(result.current.alertItems).toEqual([])
    expect(presentDueMedicationNotification).not.toHaveBeenCalled()
    expect(result.current.dueCount).toBe(1) // dueCount itself still tracks the live list
    await unmount()
  })

  it('re-polls fetchDueMedications every 60 seconds', async () => {
    Platform.OS = 'ios'
    const { unmount } = await renderHook(() => useMedicationReminders())
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchDueMedications).toHaveBeenCalledTimes(1)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60000)
    })
    expect(fetchDueMedications).toHaveBeenCalledTimes(2)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60000)
    })
    expect(fetchDueMedications).toHaveBeenCalledTimes(3)
    await unmount()
  })

  it('reschedules daily reminder times every 10 minutes (native only)', async () => {
    Platform.OS = 'ios'
    const { unmount } = await renderHook(() => useMedicationReminders())
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchReminderTimes).toHaveBeenCalledTimes(1)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10 * 60000)
    })
    expect(fetchReminderTimes).toHaveBeenCalledTimes(2)
    await unmount()
  })

  it('stops polling once unmounted', async () => {
    Platform.OS = 'ios'
    const { unmount } = await renderHook(() => useMedicationReminders())
    await act(async () => {
      await Promise.resolve()
    })
    await unmount()
    fetchDueMedications.mockClear()

    await act(async () => {
      await jest.advanceTimersByTimeAsync(120000)
    })

    expect(fetchDueMedications).not.toHaveBeenCalled()
  })

  it('skips native notification permission and reminder scheduling on web', async () => {
    Platform.OS = 'web'
    const { unmount } = await renderHook(() => useMedicationReminders())
    await act(async () => {
      await Promise.resolve()
    })

    expect(ensureNotificationPermission).not.toHaveBeenCalled()
    expect(fetchReminderTimes).not.toHaveBeenCalled() // reschedule() bails out early on web
    await unmount()
  })

  it('does not crash and leaves state unchanged when the API call fails', async () => {
    Platform.OS = 'ios'
    fetchDueMedications.mockRejectedValue(new Error('network error'))
    const { result, unmount } = await renderHook(() => useMedicationReminders())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.dueCount).toBe(0)
    expect(result.current.alertItems).toEqual([])
    await unmount()
  })

  it('dismissAlert clears the current alert list', async () => {
    Platform.OS = 'ios'
    fetchDueMedications.mockResolvedValue([ITEM_A])
    const { result, unmount } = await renderHook(() => useMedicationReminders())

    await waitFor(() => expect(result.current.alertItems).toEqual([ITEM_A]))
    await act(async () => {
      result.current.dismissAlert()
      await Promise.resolve()
    })
    expect(result.current.alertItems).toEqual([])
    await unmount()
  })
})
