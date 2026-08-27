import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import ForgotPasswordScreen from './ForgotPasswordScreen'
import { requestNursePasswordReset } from '../services/nurseAuthService'

// @testing-library/react-native v14 made render()/fireEvent.*() async (they
// wrap React's act() internally) - every call below is awaited for that
// reason, not out of caution.
jest.mock('../services/nurseAuthService', () => ({
  requestNursePasswordReset: jest.fn(),
}))

describe('ForgotPasswordScreen', () => {
  const onBack = jest.fn()
  const onCodeSent = jest.fn()

  beforeEach(() => {
    onBack.mockClear()
    onCodeSent.mockClear()
    requestNursePasswordReset.mockReset()
  })

  it('renders the email form with the back link', async () => {
    const { getByText, getByPlaceholderText } = await render(
      <ForgotPasswordScreen onBack={onBack} onCodeSent={onCodeSent} />
    )

    expect(getByText('ลืมรหัสผ่าน')).toBeTruthy()
    expect(getByPlaceholderText('เช่น suda@example.com')).toBeTruthy()
    expect(getByText('ส่งรหัสยืนยัน')).toBeTruthy()
  })

  it('calls onBack when the "เข้าสู่ระบบ" link is pressed', async () => {
    const { getByText } = await render(<ForgotPasswordScreen onBack={onBack} onCodeSent={onCodeSent} />)

    await fireEvent.press(getByText('เข้าสู่ระบบ'))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows the validation error from the service and stays on the form', async () => {
    requestNursePasswordReset.mockRejectedValueOnce(new Error('กรุณากรอกอีเมล'))

    const { getByText, queryByText } = await render(
      <ForgotPasswordScreen onBack={onBack} onCodeSent={onCodeSent} />
    )

    await fireEvent.press(getByText('ส่งรหัสยืนยัน'))

    await waitFor(() => expect(getByText('กรุณากรอกอีเมล')).toBeTruthy())
    // Still on the input form, not the "sent" confirmation card.
    expect(queryByText('กรอกรหัสยืนยัน')).toBeNull()
  })

  it('shows a loading state while the request is in flight, then the success card', async () => {
    // handleSubmit is async and fireEvent.press awaits the pressed handler's
    // own returned promise, so awaiting the press here would deadlock against
    // a mock that never resolves. Fire it without awaiting, and use waitFor
    // (which polls + flushes on its own) to observe the intermediate state.
    let resolveRequest
    requestNursePasswordReset.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )

    const { getByText, getByPlaceholderText, queryByText } = await render(
      <ForgotPasswordScreen onBack={onBack} onCodeSent={onCodeSent} />
    )

    await fireEvent.changeText(getByPlaceholderText('เช่น suda@example.com'), 'suda@example.com')
    const pressPromise = fireEvent.press(getByText('ส่งรหัสยืนยัน'))

    await waitFor(() => expect(getByText('กำลังส่ง...')).toBeTruthy())

    // The promise resolves outside of any event fireEvent triggered, so its
    // continuation (setSentMessage/setLoading) needs its own act() scope.
    await act(async () => {
      resolveRequest('หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งรหัสยืนยันไปให้แล้ว')
      await pressPromise
    })

    await waitFor(() =>
      expect(getByText('หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งรหัสยืนยันไปให้แล้ว')).toBeTruthy()
    )
    expect(queryByText('ส่งรหัสยืนยัน')).toBeNull()
  })

  it('does not call the service a second time if the button is pressed again while loading', async () => {
    let resolveRequest
    requestNursePasswordReset.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )

    const { getByText } = await render(<ForgotPasswordScreen onBack={onBack} onCodeSent={onCodeSent} />)

    const firstPress = fireEvent.press(getByText('ส่งรหัสยืนยัน'))
    await waitFor(() => expect(getByText('กำลังส่ง...')).toBeTruthy())
    await fireEvent.press(getByText('กำลังส่ง...'))

    expect(requestNursePasswordReset).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveRequest('ok')
      await firstPress
    })
  })

  it('sends the trimmed email forward to the code-entry step on success', async () => {
    requestNursePasswordReset.mockResolvedValueOnce('ส่งรหัสสำเร็จ')

    const { getByText, getByPlaceholderText } = await render(
      <ForgotPasswordScreen onBack={onBack} onCodeSent={onCodeSent} />
    )

    await fireEvent.changeText(getByPlaceholderText('เช่น suda@example.com'), '  suda@example.com  ')
    await fireEvent.press(getByText('ส่งรหัสยืนยัน'))

    await waitFor(() => expect(getByText('กรอกรหัสยืนยัน')).toBeTruthy())
    await fireEvent.press(getByText('กรอกรหัสยืนยัน'))

    expect(onCodeSent).toHaveBeenCalledWith('suda@example.com')
  })
})
