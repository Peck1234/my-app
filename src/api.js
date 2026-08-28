import { Platform } from 'react-native'
import Constants from 'expo-constants'

// เว็บ (browser): ใช้ path สัมพัทธ์ล้วน — metro.config.js พร็อกซี่ /api/* ไปที่ backend ให้แล้ว
//
// แอป native (Expo Go): ไม่มี "origin" ของหน้าเว็บให้อ้างอิง path สัมพัทธ์ใช้ไม่ได้เลย ต้องชี้ URL เต็ม
// ลำดับความสำคัญ:
//  1) backendTunnelUrl จาก app.config.js (Cloudflare tunnel ที่ start-backend.ps1 เปิดให้ทุกครั้ง — และตอนนี้
//     เขียนไฟล์นี้ก็ต่อเมื่อ verify ผ่าน /api/health จริงแล้วเท่านั้น ไม่ใช่แค่ parse URL จาก log ได้) —
//     ใช้ได้ไม่ว่ามือถือจะอยู่ WiFi วงไหน หรือใช้เน็ตมือถือ (4G/5G) ก็ตาม ไม่ต้องอยู่วงเดียวกับคอมอีกต่อไป
//  2) ถ้าไม่มี (เช่น cloudflared รันไม่สำเร็จ) fallback ไปใช้ IP วง LAN ที่ดึงอัตโนมัติจาก Expo dev server
//     เอง (Constants.expoConfig.hostUri) — ใช้ได้เฉพาะตอนมือถือกับคอมอยู่ WiFi วงเดียวกัน
function detectLanBackendHost() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri
  const host = hostUri ? hostUri.split(':')[0] : null
  return host || '127.0.0.1' // fallback เผื่อไม่ได้รันผ่าน Expo dev server (ไม่ควรเกิดในโปรเจกต์นี้)
}

// Guards against more than just "missing" (undefined/null/'') - the dev
// manifest has been observed serving `{}` for this field instead of `null`
// (stale/serialization quirk somewhere between app.config.js and the actual
// manifest response). `{}` is truthy, so a naive `|| null` check lets it
// through, and `${ {} }` template-literal-coerces to the string
// "[object Object]", silently turning API_BASE into a garbage URL that
// fails every request with no useful error. Only a non-empty string counts.
const rawTunnelUrl = Constants.expoConfig?.extra?.backendTunnelUrl
const BACKEND_TUNNEL_URL = typeof rawTunnelUrl === 'string' && rawTunnelUrl.length > 0 ? rawTunnelUrl : null
const LAN_BACKEND_HOST = detectLanBackendHost()

const API_BASE = Platform.OS === 'web'
  ? '/api'
  : BACKEND_TUNNEL_URL
    ? `${BACKEND_TUNNEL_URL}/api`
    : `http://${LAN_BACKEND_HOST}:8000/api`

const REQUEST_TIMEOUT_MS = 12000
const RETRY_DELAYS_MS = [500, 1500] // 3 total attempts when retryable

// Well-known, account-free endpoint used ONLY to tell apart "this device has
// no internet at all" from "this device has internet, but our backend/tunnel
// specifically is unreachable" — the same distinction Android's own captive-
// portal detection uses. Never sent any app data; just a plain GET.
const CONNECTIVITY_PROBE_URL = 'https://clients3.google.com/generate_204'

async function probeHasInternet() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    await fetch(CONNECTIVITY_PROBE_URL, { signal: controller.signal })
    clearTimeout(timer)
    return true
  } catch {
    return false
  }
}

function categorizedNetworkError(hasInternet) {
  const err = new Error(
    hasInternet
      ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — เครื่องนี้มีอินเทอร์เน็ตปกติ แต่ backend/tunnel อาจหลุด ลองให้ผู้ดูแลระบบรัน start-backend.ps1 ใหม่'
      : 'เครื่องนี้ไม่มีอินเทอร์เน็ต กรุณาตรวจสอบการเชื่อมต่อ Wi-Fi/มือถือแล้วลองใหม่'
  )
  err.kind = hasInternet ? 'unreachable' : 'offline'
  return err
}

// Central fetch used by every function below. Adds a timeout (plain fetch()
// has none — a silently-dead tunnel would otherwise hang forever instead of
// failing), retries transient network failures for safe/idempotent requests
// only, and turns "fetch itself threw" into a categorized, Thai-language
// error distinguishing offline vs. unreachable-backend from an HTTP error the
// backend actually returned (which is left as-is — retrying a 401/422/409
// won't fix it, and for write requests could risk acting twice).
async function apiFetch(path, options = {}, { retryable = false } = {}) {
  const attempts = retryable ? RETRY_DELAYS_MS.length + 1 : 1

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { Accept: 'application/json', ...options.headers },
        signal: controller.signal,
      })
      clearTimeout(timer)
      return res
    } catch (err) {
      clearTimeout(timer)
      const isLastAttempt = attempt === attempts - 1
      if (!isLastAttempt) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
        continue
      }
      const hasInternet = await probeHasInternet()
      throw categorizedNetworkError(hasInternet)
    }
  }
}

async function apiFetchJson(path, options, { retryable = false, fallback = {}, fallbackMessage } = {}) {
  const res = await apiFetch(path, options, { retryable })
  const data = await res.json().catch(() => fallback)

  if (!res.ok) {
    // Laravel's default validation-failure body has no `detail` field — it's
    // { message, errors: { field: [msg, ...] } }. Surface the first field
    // error when present so e.g. "username already taken" isn't swallowed
    // into the generic fallback message.
    const firstValidationError = data.errors && Object.values(data.errors)[0]?.[0]
    const err = new Error(data.detail || firstValidationError || fallbackMessage)
    err.kind = 'server'
    err.status = res.status
    err.serverState = data.server_state
    // Carried through for the medicine-catalog delete flow's "in use, needs a
    // second confirmation" 409 - the message itself already has the count
    // baked into its Thai text, this is just for callers that want the raw
    // number too (e.g. to decide UI, not just display text).
    err.needsConfirmation = data.needs_confirmation
    err.patientsUsingCount = data.patients_using_count
    throw err
  }

  return data
}

// Step 1 of the two-step dispense flow: resolves a scanned cassette QR to
// every medication currently in that meal (never a decode of the QR itself -
// the meal-cassette architecture deliberately keeps the QR a bare reference
// so drugs can be added/removed later without reprinting it).
export async function verifyCassette({ nurseQr, patientQr, cassetteQr }) {
  return apiFetchJson(
    '/verify-cassette',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nurse_qr: nurseQr, patient_qr: patientQr, cassette_qr: cassetteQr }),
    },
    { fallbackMessage: 'ตรวจสอบไม่สำเร็จ กรุณาลองใหม่' }
  )
}

// Step 2: confirm one or more drugs from that same cassette. Each id in
// medicationIds resolves independently server-side (one can succeed while
// another fails, e.g. already dispensed by someone else in between) - always
// read `results` per-id rather than treating the call as all-or-nothing.
export async function dispenseMedications({ nurseQr, patientQr, cassetteQr, medicationIds }) {
  return apiFetchJson(
    '/dispense-medications',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nurse_qr: nurseQr,
        patient_qr: patientQr,
        cassette_qr: cassetteQr,
        medication_ids: medicationIds,
      }),
    },
    { fallbackMessage: 'จ่ายยาไม่สำเร็จ กรุณาลองใหม่' }
  )
}

export async function fetchPatientMealCassettes(patientId) {
  const data = await apiFetchJson(`/patients/${patientId}/meal-cassettes`, undefined, {
    retryable: true,
    fallback: { cassettes: [] },
    fallbackMessage: 'ไม่สามารถโหลดตลับยาได้',
  })
  return data.cassettes
}

// Single-cassette detail - what CassetteDetailScreen opens with when a nurse
// taps one QR card, and re-fetches after every edit/remove so the drug list
// shown always reflects the server, never a locally-patched guess.
export async function fetchCassetteDetail(patientId, cassetteId) {
  return apiFetchJson(`/patients/${patientId}/meal-cassettes/${cassetteId}`, undefined, {
    retryable: true,
    fallbackMessage: 'ไม่สามารถโหลดข้อมูลตลับยาได้',
  })
}

// Edits one drug already inside a cassette - scoped to just that medication,
// unlike updatePatient() which replaces the patient's entire medication list.
export async function updateCassetteMedicine(patientId, cassetteId, medicationId, { drugName, standardDose, purpose, dose, instruction }) {
  return apiFetchJson(
    `/patients/${patientId}/meal-cassettes/${cassetteId}/medications/${medicationId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drug_name: drugName,
        standard_dose: standardDose || null,
        purpose: purpose || null,
        dose,
        instruction: instruction || null,
      }),
    },
    { fallbackMessage: 'ไม่สามารถแก้ไขยาได้' }
  )
}

export async function removeCassetteMedicine(patientId, cassetteId, medicationId) {
  return apiFetchJson(
    `/patients/${patientId}/meal-cassettes/${cassetteId}/medications/${medicationId}`,
    { method: 'DELETE' },
    { fallbackMessage: 'ไม่สามารถลบยาได้' }
  )
}

// The core new "add a drug from the catalog to a patient's meal" flow.
// Get-or-creates the (patient, meal) cassette server-side - `is_new` in the
// response tells the caller whether a brand-new QR was just minted (show the
// print/save screen) or an existing one was reused (just toast success).
export async function assignMedicineToMeal(patientId, { meal, drugName, standardDose, purpose, dose, instruction }) {
  return apiFetchJson(
    `/patients/${patientId}/meal-cassettes/assign-medicine`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal,
        drug_name: drugName,
        standard_dose: standardDose || null,
        purpose: purpose || null,
        dose,
        instruction: instruction || null,
      }),
    },
    { fallbackMessage: 'ไม่สามารถเพิ่มยาเข้าตลับได้' }
  )
}

export async function registerNurse({ fullName, username, email, password }) {
  return apiFetchJson(
    '/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, username, email, password }),
    },
    { fallbackMessage: 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่' }
  )
}

export async function loginNurse({ username, password }) {
  return apiFetchJson(
    '/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
    { fallbackMessage: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่' }
  )
}

// Always resolves with the same generic { message } shape the backend
// returns whether or not the email is actually registered - see
// AUTH-API-SPEC.md. Callers should show that message as-is, never branch on
// "was this email found" (the backend deliberately doesn't tell us).
export async function requestPasswordReset({ email }) {
  return apiFetchJson(
    '/forgot-password',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    },
    { fallbackMessage: 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่' }
  )
}

export async function resetPassword({ email, code, newPassword }) {
  return apiFetchJson(
    '/reset-password',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, new_password: newPassword }),
    },
    { fallbackMessage: 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองใหม่' }
  )
}

export async function updateNurseProfile({ token, fullName, username, email }) {
  return apiFetchJson(
    '/profile',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ full_name: fullName, username, email }),
    },
    { fallbackMessage: 'บันทึกข้อมูลบัญชีไม่สำเร็จ กรุณาลองใหม่' }
  )
}

// `imageUri` is an expo-image-picker asset's `.uri` - on native that's a
// file:// path RN's fetch/FormData accepts directly as { uri, name, type };
// on web it's a blob: object URL (matching expo-document-picker's own web
// pattern) which has to be re-fetched into a real Blob first since FormData
// can't attach a bare URL string as file content.
export async function uploadNurseProfilePhoto({ token, imageUri }) {
  const form = new FormData()
  if (Platform.OS === 'web') {
    const blob = await fetch(imageUri).then((res) => res.blob())
    form.append('photo', blob, 'profile-photo.jpg')
  } else {
    form.append('photo', { uri: imageUri, name: 'profile-photo.jpg', type: 'image/jpeg' })
  }

  // No Content-Type header here on purpose, same reason as bulkImportMedicines -
  // fetch/RN sets the multipart boundary itself from the FormData body.
  return apiFetchJson(
    '/profile/photo',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
    { fallbackMessage: 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่' }
  )
}

export async function changeNursePassword({ token, currentPassword, newPassword }) {
  return apiFetchJson(
    '/change-password',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    },
    { fallbackMessage: 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่' }
  )
}

export async function fetchPatients() {
  return apiFetchJson('/patients', undefined, {
    retryable: true,
    fallback: [],
    fallbackMessage: 'ไม่สามารถโหลดรายชื่อผู้ป่วยได้',
  })
}

export async function createPatient(payload) {
  return apiFetchJson(
    '/patients',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    { fallbackMessage: 'ไม่สามารถเพิ่มผู้ป่วยได้' }
  )
}

// Soft delete - requires a login token (same Bearer-token pattern as
// updateNurseProfile/changeNursePassword below). If the patient currently
// holds a cart slot, the backend clears it automatically first; nothing
// extra to do here for that. Response: { ok: true, slot_cleared: boolean }.
export async function deletePatient(patientId, { token }) {
  return apiFetchJson(
    `/patients/${patientId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    { fallbackMessage: 'ไม่สามารถลบผู้ป่วยได้' }
  )
}

export async function updatePatient(patientId, payload) {
  return apiFetchJson(
    `/patients/${patientId}`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    { fallbackMessage: 'ไม่สามารถแก้ไขข้อมูลผู้ป่วยได้' }
  )
}

export async function fetchPatientMedications(patientId) {
  return apiFetchJson(`/patients/${patientId}/medications`, undefined, {
    retryable: true,
    fallbackMessage: 'ไม่สามารถโหลดรายการยาได้',
  })
}

export async function fetchDueMedications() {
  return apiFetchJson('/due-medications', undefined, {
    retryable: true,
    fallback: [],
    fallbackMessage: 'ไม่สามารถโหลดรายการยาที่ถึงเวลาได้',
  })
}

export async function fetchReminderTimes() {
  const data = await apiFetchJson('/reminder-times', undefined, {
    retryable: true,
    fallback: { times: [] },
    fallbackMessage: 'ไม่สามารถโหลดเวลาแจ้งเตือนได้',
  })
  return data.times
}

export async function fetchDispenseStats() {
  return apiFetchJson('/dispense-stats', undefined, {
    retryable: true,
    fallbackMessage: 'ไม่สามารถโหลดสถิติการจ่ายยาได้',
  })
}

export async function fetchDispenseLogs() {
  return apiFetchJson('/dispense-logs', undefined, {
    retryable: true,
    fallback: [],
    fallbackMessage: 'ไม่สามารถโหลดประวัติการจ่ายยาได้',
  })
}

export async function fetchSlots() {
  return apiFetchJson('/slots', undefined, {
    retryable: true,
    fallback: [],
    fallbackMessage: 'ไม่สามารถโหลดรายการช่องยาได้',
  })
}

export async function createSlot(payload) {
  return apiFetchJson(
    '/slots',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    { fallbackMessage: 'ไม่สามารถสร้างช่องยาได้' }
  )
}

export async function assignPatientToSlot(slotId, payload) {
  return apiFetchJson(
    `/slots/${slotId}/assign`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    { fallbackMessage: 'ไม่สามารถผูกผู้ป่วยกับช่องนี้ได้' }
  )
}

export async function clearSlot(slotId, payload) {
  return apiFetchJson(
    `/slots/${slotId}/clear`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    { fallbackMessage: 'ไม่สามารถเคลียร์ช่องนี้ได้' }
  )
}

export async function fetchSlotHistory(slotId) {
  return apiFetchJson(`/slots/${slotId}/history`, undefined, {
    retryable: true,
    fallback: [],
    fallbackMessage: 'ไม่สามารถโหลดประวัติช่องนี้ได้',
  })
}

export async function fetchMedicineCatalog() {
  const data = await apiFetchJson('/medicine-catalog', undefined, {
    retryable: true,
    fallback: { medicines: [] },
    fallbackMessage: 'ไม่สามารถโหลดคลังยาได้',
  })
  return data.medicines
}

export async function searchMedicineCatalog(query) {
  const data = await apiFetchJson(`/medicine-catalog?search=${encodeURIComponent(query || '')}`, undefined, {
    fallback: { medicines: [] },
    fallbackMessage: 'ไม่สามารถค้นหายาได้',
  })
  return data.medicines
}

export async function createMedicineCatalogEntry(payload) {
  return apiFetchJson(
    '/medicine-catalog',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    { fallbackMessage: 'ไม่สามารถเพิ่มยาเข้าคลังได้' }
  )
}

export async function toggleMedicineFavorite(medicineId) {
  return apiFetchJson(
    `/medicine-catalog/${medicineId}/favorite`,
    { method: 'PUT' },
    { fallbackMessage: 'ไม่สามารถอัปเดตสถานะติดดาวได้' }
  )
}

// Hard delete - requires a login token. Call without `force` first: if no
// patient is currently using this drug it deletes immediately (200); if one
// or more are, the backend refuses with 409 and a count instead of deleting
// (err.status === 409, err.message already has the Thai count baked in,
// err.patientsUsingCount has the raw number too) - re-call with
// `force: true` only after the caller has confirmed that warning to actually
// delete it anyway. Never touches any patient's own medication records
// either way - see DELETE-PATIENT-MEDICINE-API-SPEC.md for why.
export async function deleteMedicineCatalogEntry(medicineId, { token, force = false } = {}) {
  const query = force ? '?force=1' : ''
  return apiFetchJson(
    `/medicine-catalog/${medicineId}${query}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    { fallbackMessage: 'ไม่สามารถลบยาออกจากคลังได้' }
  )
}

// `fileAsset` is an expo-document-picker asset ({ uri, name, mimeType } on
// native, plus a real browser `file` on web) - branch on Platform because RN's
// fetch/FormData only accepts the { uri, name, type } shape on native, while
// web needs the actual File object appended directly.
export async function bulkImportMedicines(fileAsset) {
  const form = new FormData()
  if (Platform.OS === 'web' && fileAsset.file) {
    form.append('file', fileAsset.file)
  } else {
    form.append('file', {
      uri: fileAsset.uri,
      name: fileAsset.name || 'medicines.csv',
      type: fileAsset.mimeType || 'text/csv',
    })
  }

  // No Content-Type header here on purpose - fetch/RN sets the multipart
  // boundary itself only when it's the one building the body from a raw
  // FormData; setting it manually strips the boundary and breaks the upload.
  return apiFetchJson(
    '/medicine-catalog/bulk-import',
    { method: 'POST', body: form },
    { fallbackMessage: 'นำเข้าไฟล์ไม่สำเร็จ' }
  )
}
