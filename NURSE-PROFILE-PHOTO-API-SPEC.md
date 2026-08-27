# อัปโหลดรูปโปรไฟล์พยาบาล — API Spec

Backend: `C:\backend`. Endpoint ใหม่ต้อง auth เหมือน `/api/profile` เดิมทุกประการ (Sanctum Bearer token — `Authorization: Bearer <token>`)

---

## 1. POST `/api/profile/photo`

อัปโหลด/เปลี่ยนรูปโปรไฟล์ของพยาบาลที่ล็อกอินอยู่ (รูปเก่าจะถูกลบทิ้งอัตโนมัติหลังรูปใหม่บันทึกสำเร็จ)

**Request**: `multipart/form-data`, field name ต้องชื่อ `photo`
```
POST /api/profile/photo
Authorization: Bearer <token>
Content-Type: multipart/form-data

photo: <ไฟล์ .jpg/.jpeg/.png, ไม่เกิน 5MB>
```

ตัวอย่าง React Native:
```js
const form = new FormData()
form.append('photo', { uri: pickedImage.uri, name: 'photo.jpg', type: 'image/jpeg' })
await fetch(`${API_BASE}/profile/photo`, {
  method: 'POST',
  headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  body: form, // อย่าตั้ง Content-Type เอง ให้ fetch ใส่ multipart boundary ให้
})
```

**Response** `200`:
```json
{
  "nurse_id": 1,
  "full_name": "ทดสอบ ระบบ",
  "username": "testnurse",
  "email": "testnurse@example.com",
  "qr_code_nurse": "NURSE-001",
  "profile_photo_url": "http://192.168.1.103:8000/storage/profile-photos/nurse-1-1787817885-Pbvrwu.png"
}
```
`profile_photo_url` เป็น **URL เต็ม พร้อมใช้แสดงรูปได้ทันที** (เช่นใส่ตรงใน `<Image source={{ uri: ... }} />`) — backend สร้าง URL จาก host ของ request ที่เข้ามาจริง (ไม่ hardcode `localhost`) เพื่อให้ใช้ได้ไม่ว่าจะต่อผ่าน LAN IP หรือ tunnel

**Response** `422` (ไฟล์ไม่ผ่าน validate):
```json
{ "message": "The given data was invalid.", "errors": { "photo": ["ไฟล์ที่แนบไม่ใช่รูปภาพที่ถูกต้อง", "รองรับเฉพาะไฟล์ .jpg, .jpeg, .png"] } }
```
เหตุผลที่เป็นไปได้: ไม่ได้แนบไฟล์ / ไฟล์ไม่ใช่รูปภาพจริง (เช็คเนื้อไฟล์จริงผ่าน GD ไม่ใช่แค่ดูนามสกุล) / ไม่ใช่ jpg-jpeg-png / ไฟล์เกิน 5MB

**Response** `401`: ไม่ได้แนบ token หรือ token ไม่ถูกต้อง (เหมือน `/api/profile` เดิม)

---

## 2. `profile_photo_url` ใน endpoint เดิม

**ไม่มี breaking change** — `/api/register`, `/api/login`, `PUT /api/profile` ยังคืนค่าฟิลด์เดิมครบทุกตัว แค่เพิ่ม `profile_photo_url` เข้าไปด้วยเสมอ:
- ยังไม่เคยอัปโหลดรูป → `"profile_photo_url": null`
- เคยอัปโหลดแล้ว → URL เต็มเหมือนด้านบน

ตัวอย่าง response `POST /api/login` ตอนนี้ (ฟิลด์ใหม่ตัวหนา):
```json
{
  "nurse_id": 1,
  "full_name": "ทดสอบ ระบบ",
  "username": "testnurse",
  "email": "testnurse@example.com",
  "qr_code_nurse": "NURSE-001",
  "profile_photo_url": null,
  "token": "1|abc..."
}
```

**แนะนำฝั่ง UI**: หน้า `AccountSettingsScreen` แสดง avatar วงกลม — ถ้า `nurse.profile_photo_url` มีค่า ใช้แสดงรูปจริง ถ้าเป็น `null` ใช้ fallback ตัวอักษรย่อชื่อแบบเดิม (pattern เดียวกับที่ `PatientDashboardScreen.js` ทำอยู่แล้วตอนนี้กับ `initial`)

---

## หมายเหตุ setup ฝั่ง backend (ทำให้แล้ว ไม่ต้องทำซ้ำ)

รันครั้งเดียวไปแล้ว ไม่เกี่ยวกับ frontend แต่บันทึกไว้เผื่อ deploy ใหม่:
- `php artisan migrate` (เพิ่มคอลัมน์ `profile_photo_path` ในตาราง `nurses`)
- `php artisan storage:link` (สร้าง symlink `public/storage` → `storage/app/public` ถ้าไม่มีขั้นตอนนี้ ไฟล์ที่อัปโหลดจะเข้าถึงผ่าน URL ไม่ได้ แม้จะบันทึกลงดิสก์สำเร็จก็ตาม)
