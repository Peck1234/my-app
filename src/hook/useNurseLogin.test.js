import { act, renderHook, waitFor } from '@testing-library/react-native'
import { loginNurseWithPassword, registerNurseAccount } from '../services/nurseAuthService'
import { clearSession, loadSession, saveSession } from '../services/sessionStorage'
import { checkSessionToken } from '../api'
import { SESSION_EXPIRED_MESSAGE, useNurseLogin } from './useNurseLogin'

jest.mock('../services/nurseAuthService', () => ({
  loginNurseWithPassword: jest.fn(),
  registerNurseAccount: jest.fn(),
}))

jest.mock('../services/sessionStorage', () => ({
  saveSession: jest.fn(() => Promise.resolve()),
  loadSession: jest.fn(() => Promise.resolve(null)),
  clearSession: jest.fn(() => Promise.resolve()),
}))

jest.mock('../api', () => ({
  checkSessionToken: jest.fn(() => Promise.resolve({ status: 'valid' })),
}))

// Renders the hook and waits for its startup check for a saved login to finish.
async function renderReady() {
  const rendered = await renderHook(() => useNurseLogin())
  await waitFor(() => expect(rendered.result.current.restoring).toBe(false))
  return rendered
}

const SESSION = {
  authMethod: 'password',
  loginAt: '2026-08-14T00:00:00.000Z',
  nurse_id: 1,
  full_name: 'สุดา ใจดี',
  username: 'suda.rn',
  qr_code_nurse: 'NURSE-001',
}

describe('useNurseLogin', () => {
  it('starts with no session, not loading, and no error', async () => {
    const { result } = await renderReady()

    expect(result.current.session).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  describe('handlePasswordLogin', () => {
    it('sets the session on success', async () => {
      loginNurseWithPassword.mockResolvedValue(SESSION)
      const { result } = await renderReady()

      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456' })
      })

      expect(result.current.session).toEqual(SESSION)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('sets loading true while the request is in flight', async () => {
      let resolveLogin
      loginNurseWithPassword.mockReturnValue(
        new Promise((resolve) => {
          resolveLogin = resolve
        })
      )
      const { result } = await renderReady()

      let pendingCall
      await act(async () => {
        pendingCall = result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456' })
        await Promise.resolve() // let the synchronous setLoading(true) commit before we inspect it
      })
      expect(result.current.loading).toBe(true)

      await act(async () => {
        resolveLogin(SESSION)
        await pendingCall
      })
      expect(result.current.loading).toBe(false)
    })

    it('sets the error message and clears loading on failure, without setting a session', async () => {
      loginNurseWithPassword.mockRejectedValue(new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'))
      const { result } = await renderReady()

      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: 'wrong' })
      })

      expect(result.current.error).toBe('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      expect(result.current.loading).toBe(false)
      expect(result.current.session).toBeNull()
    })

    it('ignores a second call while a login is already in flight (double-submit guard)', async () => {
      let resolveLogin
      loginNurseWithPassword.mockReturnValue(
        new Promise((resolve) => {
          resolveLogin = resolve
        })
      )
      const { result } = await renderReady()

      let call1, call2
      await act(async () => {
        call1 = result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456' })
        call2 = result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456' })
        await Promise.resolve()
      })

      expect(loginNurseWithPassword).toHaveBeenCalledTimes(1)

      await act(async () => {
        resolveLogin(SESSION)
        await call1
        await call2
      })
    })

    it('releases the double-submit guard after a failure, allowing a retry', async () => {
      loginNurseWithPassword.mockRejectedValueOnce(new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'))
      loginNurseWithPassword.mockResolvedValueOnce(SESSION)
      const { result } = await renderReady()

      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: 'wrong' })
      })
      expect(result.current.error).toBe('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')

      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456' })
      })

      expect(loginNurseWithPassword).toHaveBeenCalledTimes(2)
      expect(result.current.session).toEqual(SESSION)
      expect(result.current.error).toBeNull()
    })

    it('does not allow a second login attempt after a successful one (lock stays held)', async () => {
      loginNurseWithPassword.mockResolvedValue(SESSION)
      const { result } = await renderReady()

      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456' })
      })
      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456' })
      })

      expect(loginNurseWithPassword).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleRegister', () => {
    it('sets the session on successful registration', async () => {
      registerNurseAccount.mockResolvedValue(SESSION)
      const { result } = await renderReady()

      await act(async () => {
        await result.current.handleRegister({ fullName: 'สุดา ใจดี', username: 'suda.rn', password: '123456' })
      })

      expect(result.current.session).toEqual(SESSION)
      expect(result.current.error).toBeNull()
    })

    it('sets the error message on failed registration (e.g. duplicate username)', async () => {
      registerNurseAccount.mockRejectedValue(new Error('The username has already been taken.'))
      const { result } = await renderReady()

      await act(async () => {
        await result.current.handleRegister({ fullName: 'สุดา ใจดี', username: 'suda.rn', password: '123456' })
      })

      expect(result.current.error).toBe('The username has already been taken.')
      expect(result.current.session).toBeNull()
    })

    it('is also blocked by the same double-submit guard as login', async () => {
      let resolveRegister
      registerNurseAccount.mockReturnValue(
        new Promise((resolve) => {
          resolveRegister = resolve
        })
      )
      const { result } = await renderReady()

      let call1, call2
      await act(async () => {
        call1 = result.current.handleRegister({ fullName: 'สุดา ใจดี', username: 'suda.rn', password: '123456' })
        call2 = result.current.handleRegister({ fullName: 'สุดา ใจดี', username: 'suda.rn', password: '123456' })
        await Promise.resolve()
      })

      expect(registerNurseAccount).toHaveBeenCalledTimes(1)

      await act(async () => {
        resolveRegister(SESSION)
        await call1
        await call2
      })
    })
  })

  describe('resetLogin', () => {
    it('clears session, loading, and error back to their initial values', async () => {
      loginNurseWithPassword.mockRejectedValue(new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'))
      const { result } = await renderReady()

      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: 'wrong' })
      })
      expect(result.current.error).not.toBeNull()

      await act(async () => {
        result.current.resetLogin()
        await Promise.resolve()
      })

      expect(result.current.session).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('releases the double-submit guard, allowing login again after a successful session is reset', async () => {
      loginNurseWithPassword.mockResolvedValue(SESSION)
      const { result } = await renderReady()

      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456' })
      })
      await act(async () => {
        result.current.resetLogin()
        await Promise.resolve()
      })
      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456' })
      })

      expect(loginNurseWithPassword).toHaveBeenCalledTimes(2)
    })
  })

  describe('stay logged in', () => {
    const SAVED = { ...SESSION, token: '12|savedtoken' }

    beforeEach(() => {
      loadSession.mockResolvedValue(null)
      checkSessionToken.mockResolvedValue({ status: 'valid' })
    })

    it('restores a saved login on startup and keeps it when the server accepts the token', async () => {
      loadSession.mockResolvedValue(SAVED)
      const { result } = await renderReady()

      expect(result.current.session).toEqual(SAVED)
      await waitFor(() => expect(checkSessionToken).toHaveBeenCalledWith('12|savedtoken'))
      expect(result.current.session).toEqual(SAVED)
      expect(clearSession).not.toHaveBeenCalled()
    })

    it('refreshes the role from the server when restoring a saved login', async () => {
      loadSession.mockResolvedValue({ ...SAVED, role: 'nurse' })
      checkSessionToken.mockResolvedValue({ status: 'valid', user: { role: 'admin' } })
      const { result } = await renderReady()

      await waitFor(() => expect(result.current.session.role).toBe('admin'))
      expect(result.current.session.token).toBe('12|savedtoken')
    })

    it('logs out with a message when the server rejects the saved token', async () => {
      loadSession.mockResolvedValue(SAVED)
      checkSessionToken.mockResolvedValue({ status: 'invalid' })
      const { result } = await renderReady()

      await waitFor(() => expect(result.current.session).toBeNull())
      expect(clearSession).toHaveBeenCalled()
      expect(result.current.error).toBe(SESSION_EXPIRED_MESSAGE)
    })

    it('stays logged in when the server cannot be reached (offline)', async () => {
      loadSession.mockResolvedValue(SAVED)
      checkSessionToken.mockResolvedValue({ status: 'unknown' })
      const { result } = await renderReady()

      await waitFor(() => expect(checkSessionToken).toHaveBeenCalled())
      expect(result.current.session).toEqual(SAVED)
      expect(clearSession).not.toHaveBeenCalled()
    })

    it('saves the session after login by default, without passing the checkbox to the service', async () => {
      loginNurseWithPassword.mockResolvedValue(SAVED)
      const { result } = await renderReady()

      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456' })
      })

      expect(loginNurseWithPassword).toHaveBeenCalledWith({ username: 'suda.rn', password: '123456' })
      await waitFor(() => expect(saveSession).toHaveBeenCalledWith(SAVED))
    })

    it('does not save the session when "remember" is unticked, and clears any older one', async () => {
      loginNurseWithPassword.mockResolvedValue(SAVED)
      const { result } = await renderReady()

      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456', remember: false })
      })

      expect(result.current.session).toEqual(SAVED)
      expect(saveSession).not.toHaveBeenCalled()
      expect(clearSession).toHaveBeenCalled()
    })

    it('updates the saved copy when the profile changes', async () => {
      loginNurseWithPassword.mockResolvedValue(SAVED)
      const { result } = await renderReady()

      await act(async () => {
        await result.current.handlePasswordLogin({ username: 'suda.rn', password: '123456' })
      })
      await act(async () => {
        result.current.updateSession({ full_name: 'สุดา ใหม่' })
      })

      await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith({ ...SAVED, full_name: 'สุดา ใหม่' }))
    })

    it('forgets the saved login on logout', async () => {
      loadSession.mockResolvedValue(SAVED)
      const { result } = await renderReady()

      await act(async () => {
        result.current.resetLogin()
        await Promise.resolve()
      })

      expect(result.current.session).toBeNull()
      expect(clearSession).toHaveBeenCalled()
    })
  })
})
