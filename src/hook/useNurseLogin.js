import { useCallback, useEffect, useRef, useState } from 'react'
import { loginNurseWithPassword, registerNurseAccount } from '../services/nurseAuthService'
import { clearSession, loadSession, saveSession } from '../services/sessionStorage'
import { checkSessionToken } from '../api'

export const SESSION_EXPIRED_MESSAGE = 'การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่'

export function useNurseLogin() {
  const [session, setSession] = useState(null)
  // True until the saved login (if any) has been read on startup - lets the
  // screen show a spinner instead of flashing the login form.
  const [restoring, setRestoring] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const loginLockedRef = useRef(false)
  // Whether the current session should be kept on the device ("stay logged in").
  const rememberRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const saved = await loadSession()
      if (cancelled) return
      if (saved) {
        rememberRef.current = true
        loginLockedRef.current = true
        setSession(saved)
      }
      setRestoring(false)
      if (!saved) return

      // Checked after showing the app, so opening it stays instant and works
      // offline; only a token the server actually rejects logs the nurse out.
      const status = await checkSessionToken(saved.token)
      if (cancelled || status !== 'invalid') return
      rememberRef.current = false
      loginLockedRef.current = false
      await clearSession()
      setSession(null)
      setError(SESSION_EXPIRED_MESSAGE)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Keep the saved copy in step with the session (login, profile edits).
  useEffect(() => {
    if (session && rememberRef.current) {
      saveSession(session).catch(() => {})
    }
  }, [session])

  const startSession = useCallback(async (nextSession, remember) => {
    rememberRef.current = remember
    if (!remember) await clearSession()
    setSession(nextSession)
  }, [])

  const handlePasswordLogin = useCallback(async ({ remember = true, ...credentials }) => {
    if (loginLockedRef.current) return

    loginLockedRef.current = true
    setLoading(true)
    setError(null)

    try {
      const nextSession = await loginNurseWithPassword(credentials)
      await startSession(nextSession, remember)
    } catch (err) {
      setError(err.message)
      loginLockedRef.current = false
    } finally {
      setLoading(false)
    }
  }, [startSession])

  const handleRegister = useCallback(async (details) => {
    if (loginLockedRef.current) return

    loginLockedRef.current = true
    setLoading(true)
    setError(null)

    try {
      const nextSession = await registerNurseAccount(details)
      await startSession(nextSession, true)
    } catch (err) {
      setError(err.message)
      loginLockedRef.current = false
    } finally {
      setLoading(false)
    }
  }, [startSession])

  const resetLogin = useCallback(() => {
    rememberRef.current = false
    clearSession()
    setSession(null)
    setLoading(false)
    setError(null)
    loginLockedRef.current = false
  }, [])

  // Merges fields (e.g. full_name/username/email after an AccountSettingsScreen
  // save) into the current session without touching auth state (token,
  // loginAt, ...) - a no-op if called with no active session.
  const updateSession = useCallback((patch) => {
    setSession((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  return {
    error,
    handlePasswordLogin,
    handleRegister,
    loading,
    resetLogin,
    restoring,
    session,
    updateSession,
  }
}
