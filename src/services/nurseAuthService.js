import {
  changeNursePassword,
  loginNurse,
  registerNurse,
  requestPasswordReset,
  resetPassword,
  updateNurseProfile,
} from '../api'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function registerNurseAccount({ fullName, username, email, password }) {
  const normalizedFullName = normalizeValue(fullName)
  const normalizedUsername = normalizeValue(username)
  const normalizedEmail = normalizeValue(email)
  const normalizedPassword = normalizeValue(password)

  if (!normalizedFullName) {
    throw new Error('กรุณากรอกชื่อ-นามสกุล')
  }

  if (!normalizedUsername) {
    throw new Error('กรุณากรอกชื่อผู้ใช้')
  }

  if (!normalizedEmail) {
    throw new Error('กรุณากรอกอีเมล')
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new Error('รูปแบบอีเมลไม่ถูกต้อง')
  }

  if (normalizedPassword.length < 6) {
    throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
  }

  const nurse = await registerNurse({
    fullName: normalizedFullName,
    username: normalizedUsername,
    email: normalizedEmail,
    password: normalizedPassword,
  })

  return {
    authMethod: 'password',
    loginAt: new Date().toISOString(),
    nurse_id: nurse.nurse_id,
    full_name: nurse.full_name,
    username: nurse.username,
    role: nurse.role || 'nurse',
    email: nurse.email,
    qr_code_nurse: nurse.qr_code_nurse,
    profile_photo_url: nurse.profile_photo_url,
    token: nurse.token,
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
    role: nurse.role || 'nurse',
    email: nurse.email,
    qr_code_nurse: nurse.qr_code_nurse,
    profile_photo_url: nurse.profile_photo_url,
    token: nurse.token,
  }
}

// Always resolves (never throws for "email not found") - the backend
// intentionally returns the same generic message either way, and callers
// should just display it as-is.
export async function requestNursePasswordReset({ email }) {
  const normalizedEmail = normalizeValue(email)

  if (!normalizedEmail) {
    throw new Error('กรุณากรอกอีเมล')
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new Error('รูปแบบอีเมลไม่ถูกต้อง')
  }

  const result = await requestPasswordReset({ email: normalizedEmail })
  return result.message
}

export async function resetNursePasswordWithCode({ email, code, newPassword }) {
  const normalizedEmail = normalizeValue(email)
  const normalizedCode = normalizeValue(code)
  const normalizedPassword = normalizeValue(newPassword)

  if (!normalizedEmail) {
    throw new Error('กรุณากรอกอีเมล')
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new Error('รูปแบบอีเมลไม่ถูกต้อง')
  }

  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new Error('กรุณากรอกรหัสยืนยัน 6 หลักที่ได้รับทางอีเมล')
  }

  if (normalizedPassword.length < 6) {
    throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
  }

  const result = await resetPassword({ email: normalizedEmail, code: normalizedCode, newPassword: normalizedPassword })
  return result.message
}

export async function updateNurseProfileDetails({ token, fullName, username, email }) {
  const normalizedFullName = normalizeValue(fullName)
  const normalizedUsername = normalizeValue(username)
  const normalizedEmail = normalizeValue(email)

  if (!normalizedFullName) {
    throw new Error('กรุณากรอกชื่อ-นามสกุล')
  }

  if (!normalizedUsername) {
    throw new Error('กรุณากรอกชื่อผู้ใช้')
  }

  if (!normalizedEmail) {
    throw new Error('กรุณากรอกอีเมล')
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new Error('รูปแบบอีเมลไม่ถูกต้อง')
  }

  const nurse = await updateNurseProfile({
    token,
    fullName: normalizedFullName,
    username: normalizedUsername,
    email: normalizedEmail,
  })

  return {
    full_name: nurse.full_name,
    username: nurse.username,
    role: nurse.role || 'nurse',
    email: nurse.email,
    profile_photo_url: nurse.profile_photo_url,
  }
}

export async function changeNurseOwnPassword({ token, currentPassword, newPassword }) {
  const normalizedCurrent = normalizeValue(currentPassword)
  const normalizedNew = normalizeValue(newPassword)

  if (!normalizedCurrent) {
    throw new Error('กรุณากรอกรหัสผ่านเดิม')
  }

  if (normalizedNew.length < 6) {
    throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
  }

  const result = await changeNursePassword({ token, currentPassword: normalizedCurrent, newPassword: normalizedNew })
  return result.message
}

function normalizeValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}
