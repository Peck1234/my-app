import { registerNurse, loginNurse } from '../api'
import { registerNurseAccount, loginNurseWithPassword } from './nurseAuthService'

jest.mock('../api', () => ({
  registerNurse: jest.fn(),
  loginNurse: jest.fn(),
}))

describe('registerNurseAccount', () => {
  const validInput = { fullName: 'สุดา ใจดี', username: 'suda.rn', password: '123456' }

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

  it('rejects a password shorter than 6 characters without calling the API', async () => {
    await expect(registerNurseAccount({ ...validInput, password: '123' })).rejects.toThrow(
      'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
    )
    expect(registerNurse).not.toHaveBeenCalled()
  })

  it('checks full name and username before password length', async () => {
    // Blank name AND short password given together - the name error should
    // surface first, matching the validation order in the source.
    await expect(
      registerNurseAccount({ fullName: '', username: 'suda.rn', password: '123' })
    ).rejects.toThrow('กรุณากรอกชื่อ-นามสกุล')
  })

  it('trims whitespace and calls the API with normalized values on success', async () => {
    registerNurse.mockResolvedValue({
      nurse_id: 1,
      full_name: 'สุดา ใจดี',
      username: 'suda.rn',
      qr_code_nurse: 'NURSE-001',
    })

    const result = await registerNurseAccount({
      fullName: '  สุดา ใจดี  ',
      username: '  suda.rn  ',
      password: '123456',
    })

    expect(registerNurse).toHaveBeenCalledWith({
      fullName: 'สุดา ใจดี',
      username: 'suda.rn',
      password: '123456',
    })
    expect(result).toEqual({
      authMethod: 'password',
      loginAt: expect.any(String),
      nurse_id: 1,
      full_name: 'สุดา ใจดี',
      username: 'suda.rn',
      qr_code_nurse: 'NURSE-001',
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
      qr_code_nurse: 'NURSE-001',
    })

    await expect(loginNurseWithPassword({ username: 'suda.rn', password: '123' })).resolves.toBeDefined()
    expect(loginNurse).toHaveBeenCalledWith({ username: 'suda.rn', password: '123' })
  })

  it('trims the username and returns a normalized session on success', async () => {
    loginNurse.mockResolvedValue({
      nurse_id: 2,
      full_name: 'เนส นะจ๊ะ',
      username: 'nes123',
      qr_code_nurse: 'NURSE-002',
    })

    const result = await loginNurseWithPassword({ username: '  nes123  ', password: 'secret1' })

    expect(loginNurse).toHaveBeenCalledWith({ username: 'nes123', password: 'secret1' })
    expect(result.authMethod).toBe('password')
    expect(result.nurse_id).toBe(2)
    expect(result.username).toBe('nes123')
  })

  it('propagates the API error (e.g. wrong credentials) unchanged', async () => {
    loginNurse.mockRejectedValue(new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'))

    await expect(loginNurseWithPassword({ username: 'suda.rn', password: 'wrong' })).rejects.toThrow(
      'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
    )
  })
})
