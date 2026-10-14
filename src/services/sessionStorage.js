import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

// "Stay logged in": the session the backend returned at login (nurse fields +
// API token - never the password) is kept on the device. Native apps use the
// OS keystore (expo-secure-store); the web build has no keystore, so it falls
// back to the browser's own storage for this origin.
const KEY = 'careUruSession'

export async function saveSession(session) {
  const value = JSON.stringify(session)
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(KEY, value)
  } else {
    await SecureStore.setItemAsync(KEY, value)
  }
}

// Returns null when nothing is saved or the saved value is unreadable/incomplete.
export async function loadSession() {
  try {
    const raw = Platform.OS === 'web' ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    return session && typeof session.token === 'string' && session.token ? session : null
  } catch {
    return null
  }
}

export async function clearSession() {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(KEY)
    } else {
      await SecureStore.deleteItemAsync(KEY)
    }
  } catch {
    // Nothing saved, or storage unavailable - either way there's nothing left to clear.
  }
}
