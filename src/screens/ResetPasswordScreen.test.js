import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import ResetPasswordScreen from './ResetPasswordScreen'
import { resetNursePasswordWithCode } from '../services/nurseAuthService'

// @testing-library/react-native v14 made render()/fireEvent.*() async (they
// wrap React's act() internally) - every call below is awaited for that
// reason, not out of caution.
jest.mock('../services/nurseAuthService', () => ({
  resetNursePasswordWithCode: jest.fn(),
}))

// The screen title ("ตั้งรหัสผ่านใหม่") and the submit button's label are the
// exact same string, so a plain getByText() is ambiguous - the button is
// always the last matching node in the tree (title renders before the card).
const submitButton = (getAllByText) => getAllByText('ตั้งรหัสผ่านใหม่').at(-1)

describe('ResetPasswordScreen', () => {
  const onBack = jest.fn()
  const onSuccess = jest.fn()

  beforeEach(() => {
    onBack.mockClear()
    onSuccess.mockClear()
    resetNursePasswordWithCode.mockReset()
  })

  it('prefills the email carried over from the forgot-password step', async () => {
    const { getByDisplayValue } = await render(
      <ResetPasswordScreen email="suda@example.com" onBack={onBack} onSuccess={onSuccess} />
    )

    expect(getByDisplayValue('suda@example.com')).toBeTruthy()
  })

  it('calls onBack when the "เข้าสู่ระบบ" link is pressed', async () => {
    const { getByText } = await render(
      <ResetPasswordScreen email="" onBack={onBack} onSuccess={onSuccess} />
    )

    await fireEvent.press(getByText('เข้าสู่ระบบ'))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('strips non-digit characters and caps the verification code at 6 digits', async () => {
    const { getByPlaceholderText } = await render(
      <ResetPasswordScreen email="suda@example.com" onBack={onBack} onSuccess={onSuccess} />
    )

    const codeInput = getByPlaceholderText('000000')
    await fireEvent.changeText(codeInput, 'a1b2c3d4e5f6')

    expect(codeInput.props.value).toBe('123456')
  })

  it('toggles the new-password visibility when "แสดง/ซ่อน" is pressed', async () => {
    const { getByText, getByPlaceholderText } = await render(
      <ResetPasswordScreen email="suda@example.com" onBack={onBack} onSuccess={onSuccess} />
    )

    const passwordInput = getByPlaceholderText('อย่างน้อย 6 ตัวอักษร')
    expect(passwordInput.props.secureTextEntry).toBe(true)

    await fireEvent.press(getByText('แสดง'))
    expect(passwordInput.props.secureTextEntry).toBe(false)

    await fireEvent.press(getByText('ซ่อน'))
    expect(passwordInput.props.secureTextEntry).toBe(true)
  })

  it('submits email/code/newPassword and calls onSuccess with the server message', async () => {
    resetNursePasswordWithCode.mockResolvedValueOnce('ตั้งรหัสผ่านใหม่สำเร็จ')

    const { getAllByText, getByPlaceholderText } = await render(
      <ResetPasswordScreen email="suda@example.com" onBack={onBack} onSuccess={onSuccess} />
    )

    await fireEvent.changeText(getByPlaceholderText('000000'), '123456')
    await fireEvent.changeText(getByPlaceholderText('อย่างน้อย 6 ตัวอักษร'), 'newpass1')
    await fireEvent.press(submitButton(getAllByText))

    expect(resetNursePasswordWithCode).toHaveBeenCalledWith({
      email: 'suda@example.com',
      code: '123456',
      newPassword: 'newpass1',
    })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('ตั้งรหัสผ่านใหม่สำเร็จ'))
  })

  it('shows a loading state on the submit button while the request is in flight', async () => {
    // handleSubmit is async and fireEvent.press awaits the pressed handler's
    // own returned promise, so awaiting the press here would deadlock against
    // a mock that never resolves. Fire it without awaiting, and use waitFor
    // (which polls + flushes on its own) to observe the intermediate state.
    let resolveRequest
    resetNursePasswordWithCode.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )

    const { getByText, getAllByText, getByPlaceholderText } = await render(
      <ResetPasswordScreen email="suda@example.com" onBack={onBack} onSuccess={onSuccess} />
    )

    await fireEvent.changeText(getByPlaceholderText('000000'), '123456')
    await fireEvent.changeText(getByPlaceholderText('อย่างน้อย 6 ตัวอักษร'), 'newpass1')
    const pressPromise = fireEvent.press(submitButton(getAllByText))

    await waitFor(() => expect(getByText('กำลังตั้งรหัสผ่าน...')).toBeTruthy())

    // The promise resolves outside of any event fireEvent triggered, so its
    // continuation (onSuccess/setLoading) needs its own act() scope.
    await act(async () => {
      resolveRequest('ตั้งรหัสผ่านใหม่สำเร็จ')
      await pressPromise
    })

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('shows the server error (e.g. wrong/expired code) without calling onSuccess', async () => {
    resetNursePasswordWithCode.mockRejectedValueOnce(new Error('รหัสยืนยันไม่ถูกต้องหรือหมดอายุ'))

    const { getByText, getAllByText, getByPlaceholderText } = await render(
      <ResetPasswordScreen email="suda@example.com" onBack={onBack} onSuccess={onSuccess} />
    )

    await fireEvent.changeText(getByPlaceholderText('000000'), '999999')
    await fireEvent.changeText(getByPlaceholderText('อย่างน้อย 6 ตัวอักษร'), 'newpass1')
    await fireEvent.press(submitButton(getAllByText))

    await waitFor(() => expect(getByText('รหัสยืนยันไม่ถูกต้องหรือหมดอายุ')).toBeTruthy())
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('does not call the service a second time if the button is pressed again while loading', async () => {
    let resolveRequest
    resetNursePasswordWithCode.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )

    const { getByText, getAllByText } = await render(
      <ResetPasswordScreen email="suda@example.com" onBack={onBack} onSuccess={onSuccess} />
    )

    const firstPress = fireEvent.press(submitButton(getAllByText))
    await waitFor(() => expect(getByText('กำลังตั้งรหัสผ่าน...')).toBeTruthy())
    await fireEvent.press(getByText('กำลังตั้งรหัสผ่าน...'))

    expect(resetNursePasswordWithCode).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveRequest('ok')
      await firstPress
    })
  })
})
