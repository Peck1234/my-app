import {
  changeNursePassword,
  loginNurse,
  registerNurse,
  requestPasswordReset,
  resetPassword,
  updateNurseProfile,
} from '../api'
import {
  changeNurseOwnPassword,
  loginNurseWithPassword,
  registerNurseAccount,
  requestNursePasswordReset,
  resetNursePasswordWithCode,
  updateNurseProfileDetails,
} from './nurseAuthService'

jest.mock('../api', () => ({
  registerNurse: jest.fn(),
  loginNurse: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  updateNurseProfile: jest.fn(),
  changeNursePassword: jest.fn(),
}))

describe('registerNurseAccount', () => {
  const validInput = { fullName: 'สุดา ใจดี', username: 'suda.rn', email: 'suda@example.com', password: '123456' }

  it('rejects an empty full name without calling the API', async () => {
    await expect(registerNurseAccount({ ...validInput, fullName: '  ' })).rejects.toThrow(
      'กรุณากรอกชื่อ-นามสกุล'
    )
    expect(registerNurse).not.toHaveBeenCalled()
  })

  it('rejects an empty username without calling the API', async () => {
    await expect(registerNurseAccount({ ...validInput, username: '  ' })).rejects.toThrow(
      'กรุณากรอกชื่อผู้ใช้'
    )
    expect(registerNurse).not.toHaveBeenCalled()
  })

  it('rejects an empty email without calling the API', async () => {
    await expect(registerNurseAccount({ ...validInput, email: '  ' })).rejects.toThrow(
      'กรุณากรอกอีเมล'
    )
    expect(registerNurse).not.toHaveBeenCalled()
  })

  it('rejects a malformed email without calling the API', async () => {
    await expect(registerNurseAccount({ ...validInput, email: 'not-an-email' })).rejects.toThrow(
      'รูปแบบอีเมลไม่ถูกต้อง'
    )
    expect(registerNurse).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 6 characters without calling the API', async () => {
    await expect(registerNurseAccount({ ...validInput, password: '123' })).rejects.toThrow(
      'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
    )
    expect(registerNurse).not.toHaveBeenCalled()
  })

  it('checks full name and username before email and password', async () => {
    // Blank name AND short password given together - the name error should
    // surface first, matching the validation order in the source.
    await expect(
      registerNurseAccount({ fullName: '', username: 'suda.rn', email: 'suda@example.com', password: '123' })
    ).rejects.toThrow('กรุณากรอกชื่อ-นามสกุล')
  })

  it('trims whitespace and calls the API with normalized values on success', async () => {
    registerNurse.mockResolvedValue({
      nurse_id: 1,
      full_name: 'สุดา ใจดี',
      username: 'suda.rn',
      email: 'suda@example.com',
      qr_code_nurse: 'NURSE-001',
      token: 'abc123',
    })

    const result = await registerNurseAccount({
      fullName: '  สุดา ใจดี  ',
      username: '  suda.rn  ',
      email: '  suda@example.com  ',
      password: '123456',
    })

    expect(registerNurse).toHaveBeenCalledWith({
      fullName: 'สุดา ใจดี',
      username: 'suda.rn',
      email: 'suda@example.com',
      password: '123456',
    })
    expect(result).toEqual({
      authMethod: 'password',
      loginAt: expect.any(String),
      nurse_id: 1,
      full_name: 'สุดา ใจดี',
      username: 'suda.rn',
      role: 'nurse',
      email: 'suda@example.com',
      qr_code_nurse: 'NURSE-001',
      token: 'abc123',
    })
  })

  it('propagates the API error (e.g. duplicate username) unchanged', async () => {
    registerNurse.mockRejectedValue(new Error('The username has already been taken.'))

    await expect(registerNurseAccount(validInput)).rejects.toThrow(
      'The username has already been taken.'
    )
  })
})

describe('loginNurseWithPassword', () => {
  it('rejects an empty username without calling the API', async () => {
    await expect(loginNurseWithPassword({ username: '  ', password: '123456' })).rejects.toThrow(
      'กรุณากรอกชื่อผู้ใช้'
    )
    expect(loginNurse).not.toHaveBeenCalled()
  })

  it('rejects an empty password without calling the API', async () => {
    await expect(loginNurseWithPassword({ username: 'suda.rn', password: '' })).rejects.toThrow(
      'กรุณากรอกรหัสผ่านพยาบาล'
    )
    expect(loginNurse).not.toHaveBeenCalled()
  })

  it('does not enforce a minimum length on login password (only on registration)', async () => {
    loginNurse.mockResolvedValue({
      nurse_id: 1,
      full_name: 'สุดา ใจดี',
      username: 'suda.rn',
      email: 'suda@example.com',
      qr_code_nurse: 'NURSE-001',
      token: 'abc123',
    })

    await expect(loginNurseWithPassword({ username: 'suda.rn', password: '123' })).resolves.toBeDefined()
    expect(loginNurse).toHaveBeenCalledWith({ username: 'suda.rn', password: '123' })
  })

  it('trims the username and returns a normalized session (with token) on success', async () => {
    loginNurse.mockResolvedValue({
      nurse_id: 2,
      full_name: 'เนส นะจ๊ะ',
      username: 'nes123',
      email: 'nes@example.com',
      qr_code_nurse: 'NURSE-002',
      token: 'xyz789',
    })

    const result = await loginNurseWithPassword({ username: '  nes123  ', password: 'secret1' })

    expect(loginNurse).toHaveBeenCalledWith({ username: 'nes123', password: 'secret1' })
    expect(result.authMethod).toBe('password')
    expect(result.nurse_id).toBe(2)
    expect(result.username).toBe('nes123')
    expect(result.token).toBe('xyz789')
  })

  it('propagates the API error (e.g. wrong credentials) unchanged', async () => {
    loginNurse.mockRejectedValue(new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'))

    await expect(loginNurseWithPassword({ username: 'suda.rn', password: 'wrong' })).rejects.toThrow(
      'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
    )
  })
})

describe('requestNursePasswordReset', () => {
  it('rejects an empty email without calling the API', async () => {
    await expect(requestNursePasswordReset({ email: '  ' })).rejects.toThrow('กรุณากรอกอีเมล')
    expect(requestPasswordReset).not.toHaveBeenCalled()
  })

  it('rejects a malformed email without calling the API', async () => {
    await expect(requestNursePasswordReset({ email: 'not-an-email' })).rejects.toThrow(
      'รูปแบบอีเมลไม่ถูกต้อง'
    )
    expect(requestPasswordReset).not.toHaveBeenCalled()
  })

  it('returns the generic message from the API unchanged on success', async () => {
    requestPasswordReset.mockResolvedValue({ message: 'หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งรหัสยืนยันไปให้แล้ว' })

    const message = await requestNursePasswordReset({ email: '  suda@example.com  ' })

    expect(requestPasswordReset).toHaveBeenCalledWith({ email: 'suda@example.com' })
    expect(message).toBe('หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งรหัสยืนยันไปให้แล้ว')
  })
})

describe('resetNursePasswordWithCode', () => {
  const validInput = { email: 'suda@example.com', code: '123456', newPassword: 'newpass1' }

  it('rejects a malformed email without calling the API', async () => {
    await expect(resetNursePasswordWithCode({ ...validInput, email: 'nope' })).rejects.toThrow(
      'รูปแบบอีเมลไม่ถูกต้อง'
    )
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('rejects a code that is not exactly 6 digits', async () => {
    await expect(resetNursePasswordWithCode({ ...validInput, code: '123' })).rejects.toThrow(
      'กรุณากรอกรหัสยืนยัน 6 หลักที่ได้รับทางอีเมล'
    )
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('rejects a new password shorter than 6 characters', async () => {
    await expect(resetNursePasswordWithCode({ ...validInput, newPassword: '123' })).rejects.toThrow(
      'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'
    )
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('calls the API with normalized values and returns the success message', async () => {
    resetPassword.mockResolvedValue({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ' })

    const message = await resetNursePasswordWithCode(validInput)

    expect(resetPassword).toHaveBeenCalledWith({
      email: 'suda@example.com', code: '123456', newPassword: 'newpass1',
    })
    expect(message).toBe('ตั้งรหัสผ่านใหม่สำเร็จ')
  })

  it('propagates the API error (e.g. wrong/expired code) unchanged', async () => {
    resetPassword.mockRejectedValue(new Error('รหัสยืนยันไม่ถูกต้องหรือหมดอายุ'))

    await expect(resetNursePasswordWithCode(validInput)).rejects.toThrow(
      'รหัสยืนยันไม่ถูกต้องหรือหมดอายุ'
    )
  })
})

describe('updateNurseProfileDetails', () => {
  const validInput = { token: 'tok', fullName: 'สุดา ใจดี', username: 'suda.rn', email: 'suda@example.com' }

  it('rejects a malformed email without calling the API', async () => {
    await expect(updateNurseProfileDetails({ ...validInput, email: 'nope' })).rejects.toThrow(
      'รูปแบบอีเมลไม่ถูกต้อง'
    )
    expect(updateNurseProfile).not.toHaveBeenCalled()
  })

  it('sends the bearer token through to the API', async () => {
    updateNurseProfile.mockResolvedValue({ full_name: 'สุดา ใจดี', username: 'suda.rn', email: 'suda@example.com' })

    await updateNurseProfileDetails(validInput)

    expect(updateNurseProfile).toHaveBeenCalledWith({
      token: 'tok', fullName: 'สุดา ใจดี', username: 'suda.rn', email: 'suda@example.com',
    })
  })
})

describe('changeNurseOwnPassword', () => {
  it('rejects an empty current password without calling the API', async () => {
    await expect(
      changeNurseOwnPassword({ token: 'tok', currentPassword: '  ', newPassword: 'newpass1' })
    ).rejects.toThrow('กรุณากรอกรหัสผ่านเดิม')
    expect(changeNursePassword).not.toHaveBeenCalled()
  })

  it('rejects a new password shorter than 6 characters', async () => {
    await expect(
      changeNurseOwnPassword({ token: 'tok', currentPassword: 'old12345', newPassword: '123' })
    ).rejects.toThrow('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
    expect(changeNursePassword).not.toHaveBeenCalled()
  })

  it('propagates the API error (e.g. wrong current password) unchanged', async () => {
    changeNursePassword.mockRejectedValue(new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง'))

    await expect(
      changeNurseOwnPassword({ token: 'tok', currentPassword: 'wrong', newPassword: 'newpass1' })
    ).rejects.toThrow('รหัสผ่านปัจจุบันไม่ถูกต้อง')
  })
})
