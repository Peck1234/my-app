# ลบผู้ป่วย / ลบยาจากคลังยากลาง — API Spec

Backend: `C:\backend`. ทั้ง 2 endpoint นี้ **ต้อง login ก่อน (Sanctum token)** — endpoint อื่นๆ ในแอปตอนนี้ส่วนใหญ่ไม่บังคับ auth แต่สองตัวนี้บังคับตามที่ระบุมา ใช้ pattern เดียวกับ `updateNurseProfile`/`uploadNurseProfilePhoto`/`changeNursePassword` ที่มีอยู่แล้วใน `src/api.js` — ส่ง header `Authorization: Bearer <token>` (ค่า `token` มาจาก response ของ `/api/login`, เก็บไว้ใน nurse session object อยู่แล้ว)

---

## 1. `DELETE /api/patients/{id}` — ลบผู้ป่วย (soft delete)

**ต้องมี header**: `Authorization: Bearer <token>`

**Request**: ไม่มี body

**Response** `200`:
```json
{ "ok": true, "slot_cleared": true }
```
- `slot_cleared: true` = ผู้ป่วยรายนี้กำลังครองช่องยาอยู่ตอนที่ลบ ระบบเคลียร์ช่องให้อัตโนมัติแล้ว
- `slot_cleared: false` = ผู้ป่วยไม่ได้ครองช่องอยู่ ไม่มีอะไรต้องเคลียร์

**Response** `401` (ไม่ได้ login / token หมดอายุ):
```json
{ "message": "Unauthenticated." }
```

**Response** `404` (ไม่พบผู้ป่วย หรือถูกลบไปแล้ว):
```json
{ "message": "..." }
```

### พฤติกรรมสำคัญที่ frontend ควรรู้
- **เป็น soft delete** — ผู้ป่วยจะหายจาก `GET /api/patients` และทุก endpoint ที่ list/ค้นหาผู้ป่วยทันที แต่ข้อมูลจริงยังอยู่ในฐานข้อมูล
- **ประวัติยา/รายการยาเดิมของผู้ป่วยไม่หายไปไหน** — `GET /api/patients/{id}/medications`, `GET /api/patients/{id}/meal-cassettes`, และ dispense logs เดิมยังอยู่ครบ (แต่ route เหล่านี้จะ 404 ทันทีที่ผู้ป่วยถูกลบ เพราะ implicit route binding มองไม่เห็นผู้ป่วยที่ลบแล้ว — ถ้าต้องการฟีเจอร์ "ดูประวัติผู้ป่วยที่ถูกลบ" ในอนาคตต้องเพิ่ม endpoint ใหม่ที่ query แบบ `withTrashed()` เอง ยังไม่มีตอนนี้)
- ถ้าผู้ป่วยกำลังครองช่องยาอยู่ ระบบเคลียร์ช่องให้เอง — **frontend ไม่ต้องเรียก `/api/slots/{slot}/clear` เองก่อน** และไม่ต้องรู้ `base_version` ของช่องด้วย (endpoint นี้เคลียร์แบบ system-triggered ไม่เช็ค version conflict เหมือน endpoint clear ปกติ)
- ไม่มี endpoint กู้คืนผู้ป่วยที่ถูกลบ (undelete) ในตอนนี้ — ถ้าต้องการ flag ไว้ให้เพิ่มทีหลัง

---

## 2. `DELETE /api/medicine-catalog/{id}` — ลบยาจากคลังยากลาง

**ต้องมี header**: `Authorization: Bearer <token>`

**Request**: query param หรือ body ก็ได้ (endpoint รับทั้งคู่เหมือนกัน)
```
DELETE /api/medicine-catalog/5?force=1
```
หรือ
```json
{ "force": true }
```
ไม่ส่ง `force` เลย = เท่ากับ `force=false` (ค่า default)

**Response** `200` (ลบสำเร็จ — ไม่มีใครใช้อยู่ หรือส่ง `force=true`):
```json
{ "ok": true }
```

**Response** `409` (มีคนใช้อยู่ และไม่ได้ส่ง `force` — **ยังไม่ลบจริง**):
```json
{
  "detail": "ยา \"Paracetamol\" กำลังถูกใช้งานอยู่โดยผู้ป่วย 3 ราย ยืนยันการลบหรือไม่?",
  "needs_confirmation": true,
  "patients_using_count": 3
}
```

**Response** `401` (ไม่ได้ login):
```json
{ "message": "Unauthenticated." }
```

### วิธีใช้ฝั่ง frontend (flow ที่ตั้งใจไว้)
1. เรียก `DELETE /api/medicine-catalog/{id}` เฉยๆ ก่อน (ไม่ส่ง force)
2. ถ้าได้ `200` → ลบเสร็จแล้ว จบ
3. ถ้าได้ `409` → โชว์ dialog ยืนยัน โดยใช้ข้อความจาก `detail` (มีจำนวนผู้ป่วยที่ใช้อยู่ต่อท้ายให้แล้ว) ถ้านางพยาบาลกดยืนยัน → เรียกซ้ำอีกครั้งพร้อม `?force=1`

### ข้อจำกัดที่ frontend ต้องรู้ (สำคัญ)
- **`medications` ไม่มี foreign key ไปที่ `medicine_catalog` เลย** — ตอนนางพยาบาลเพิ่มยาเข้ามื้อ (ผ่าน autocomplete จากคลังยา) ระบบแค่ **copy** ชื่อยา/ขนาดมาตรฐาน/สรรพคุณ เป็น string ธรรมดาใส่ลงในแถวยาของผู้ป่วยตอนนั้นเลย ไม่ได้ผูกไว้ถาวร
- เพราะงั้น "มีคนใช้อยู่กี่ราย" เช็คจาก **`drug_name` ตรงกันเป๊ะ** เท่านั้น (ชื่อยาใน `medicine_catalog` unique อยู่แล้ว เลยแม่นระดับหนึ่ง แต่ในทางทฤษฎีถ้านางพยาบาลพิมพ์ชื่อยาเองตรงเป๊ะโดยไม่เคยกดเลือกจากคลังเลย ก็จะถูกนับว่า "กำลังใช้อยู่" เหมือนกัน)
- **การลบยาออกจากคลังไม่กระทบข้อมูลผู้ป่วยที่ใช้อยู่แล้วเลย** — แถวยาเดิมของผู้ป่วย (`medications` table) ยังอยู่ครบ ชื่อยา/ขนาด/วิธีใช้เดิมอ่านได้ปกติทุกอย่าง แค่ยาตัวนั้นจะหายจาก autocomplete/ค้นหาสำหรับผู้ป่วยรายใหม่เท่านั้น
- ผู้ป่วยที่ถูกลบไปแล้ว (soft-deleted) **ไม่ถูกนับ** เป็น "กำลังใช้อยู่" — ถ้ายาตัวนั้นมีแต่ผู้ป่วยที่ถูกลบใช้ ระบบจะลบยาได้เลยโดยไม่ถาม
- เป็น **hard delete** จริงๆ (ไม่ใช่ soft delete) — เพราะ `medicine_catalog` ไม่มี dispense history ผูกอยู่โดยตรงเหมือนผู้ป่วย ลบแล้วลบเลย ชื่อยานี้สามารถเพิ่มกลับเข้าคลังใหม่ได้ในอนาคต (unique constraint จะไม่ติด)

---

## ทดสอบแล้ว
- Unit test: 14 เคสใหม่ (`PatientControllerTest`, `MedicineCatalogControllerTest`) — รวมทั้งหมด 135/135 ผ่าน
- ทดสอบจริงผ่าน backend ที่รันอยู่ (curl): login จริง → ลบผู้ป่วยจริง (ยืนยันหายจาก index) → ลบยาที่ไม่มีคนใช้ (200) → ลบยาที่มีคนใช้อยู่โดยไม่ force (409 + จำนวนถูกต้อง) → ลบซ้ำด้วย force=1 (200)
