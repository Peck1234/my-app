import { loginNurse, registerNurse } from '../api'

export async function registerNurseAccount({ fullName, username, password }) {
  const normalizedFullName = normalizeValue(fullName)
  const normalizedUsername = normalizeValue(username)
  const normalizedPassword = normalizeValue(password)

  if (!normalizedFullName) {
    throw new Error('กรุณากรอกชื่อ-นามสกุล')
  }

  if (!normalizedUsername) {
    throw new Error('กรุณากรอกชื่อผู้ใช้')
  }

  if (normalizedPassword.length < 6) {
    throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
  }

  const nurse = await registerNurse({
    fullName: normalizedFullName,
    username: normalizedUsername,
    password: normalizedPassword,
  })

  return {
    authMethod: 'password',
    loginAt: new Date().toISOString(),
    nurse_id: nurse.nurse_id,
    full_name: nurse.full_name,
    username: nurse.username,
    qr_code_nurse: nurse.qr_code_nurse,
  }
}

export async function loginNurseWithPassword({ username, password }) {
  const normalizedUsername = normalizeValue(username)
  const normalizedPassword = normalizeValue(password)

  if (!normalizedUsername) {
    throw new Error('กรุณากรอกชื่อผู้ใช้')
  }

  if (!normalizedPassword) {
    throw new Error('กรุณากรอกรหัสผ่านพยาบาล')
  }

  const nurse = await loginNurse({
    username: normalizedUsername,
    password: normalizedPassword,
  })

  return {
    authMethod: 'password',
    loginAt: new Date().toISOString(),
    nurse_id: nurse.nurse_id,
    full_name: nurse.full_name,
    username: nurse.username,
    qr_code_nurse: nurse.qr_code_nurse,
  }
}

function normalizeValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}
