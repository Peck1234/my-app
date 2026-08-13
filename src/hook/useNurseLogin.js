import { useCallback, useRef, useState } from 'react'
import { loginNurseWithPassword, registerNurseAccount } from '../services/nurseAuthService'

export function useNurseLogin() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const loginLockedRef = useRef(false)

  const handlePasswordLogin = useCallback(async (credentials) => {
    if (loginLockedRef.current) return

    loginLockedRef.current = true
    setLoading(true)
    setError(null)

    try {
      const nextSession = await loginNurseWithPassword(credentials)
      setSession(nextSession)
    } catch (err) {
      setError(err.message)
      loginLockedRef.current = false
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRegister = useCallback(async (details) => {
    if (loginLockedRef.current) return

    loginLockedRef.current = true
    setLoading(true)
    setError(null)

    try {
      const nextSession = await registerNurseAccount(details)
      setSession(nextSession)
    } catch (err) {
      setError(err.message)
      loginLockedRef.current = false
    } finally {
      setLoading(false)
    }
  }, [])

  const resetLogin = useCallback(() => {
    setSession(null)
    setLoading(false)
    setError(null)
    loginLockedRef.current = false
  }, [])

  return {
    error,
    handlePasswordLogin,
    handleRegister,
    loading,
    resetLogin,
    session,
  }
}
