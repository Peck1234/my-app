# คลังยากลาง (Medicine Catalog) — API Spec

Backend: `C:\backend`. ทุก endpoint ไม่ต้องแนบ auth token (ตาม pattern เดิมของ `/patients`, `/slots` ฯลฯ — ระบบนี้ยังไม่บังคับ auth บน route กลุ่มนี้)

Error response ทุก endpoint ที่เป็น error ที่แอปตั้งใจโยนเอง (เช่นชื่อยาซ้ำ, ไฟล์ผิดรูปแบบ) จะอยู่ในรูป:
```json
{ "detail": "ข้อความภาษาไทยที่แสดงให้ผู้ใช้เห็นได้ตรงๆ" }
```
Error จาก Laravel validation ปกติ (เช่นไม่ได้แนบไฟล์) จะเป็นรูปแบบ default ของ Laravel:
```json
{ "message": "The given data was invalid.", "errors": { "field": ["ข้อความ"] } }
```
`src/api.js` (`apiFetchJson`) ฝั่ง frontend รองรับทั้งสองแบบอยู่แล้ว (`data.detail || firstValidationError`) ไม่ต้องแก้อะไรเพิ่ม

---

## 1. GET `/api/medicine-catalog?search=...`

ค้นหายาในคลังกลาง — `search` เป็น optional, ค้นแบบ **contains** (ไม่ใช่ starts-with) กับทั้ง `drug_name` และ `generic_name`, ไม่สนตัวพิมพ์เล็ก/ใหญ่ ผลลัพธ์เรียง `is_favorite` (ติดดาว) ขึ้นก่อนเสมอ แล้วตามด้วยชื่อยา (ก-ฮ/A-Z)

**Request**: `GET /api/medicine-catalog?search=para`

**Response** `200`:
```json
{
  "medicines": [
    {
      "id": 1,
      "drug_name": "Paracetamol 500mg",
      "generic_name": "Paracetamol",
      "standard_dose": "500mg",
      "category": "แก้ปวดลดไข้",
      "purpose": "ลดไข้ บรรเทาปวด",
      "contraindication": "แพ้ยา Paracetamol",
      "is_favorite": true,
      "created_at": "2026-08-26T08:18:54.000000Z",
      "updated_at": "2026-08-26T08:19:29.000000Z"
    }
  ]
}
```
ไม่ส่ง `search` หรือส่งค่าว่าง = คืนยาทั้งหมดในคลัง (เรียงแบบเดียวกัน)

---

## 2. POST `/api/medicine-catalog`

เพิ่มยาใหม่ 1 รายการเข้าคลังกลาง

**Request**:
```json
{
  "drug_name": "Amoxicillin 250mg",
  "generic_name": "Amoxicillin",
  "standard_dose": "250mg",
  "category": "ยาปฏิชีวนะ",
  "purpose": "รักษาการติดเชื้อแบคทีเรีย",
  "contraindication": "แพ้ยากลุ่มเพนิซิลลิน"
}
```
- `drug_name` — **required**, ต้องไม่ซ้ำกับที่มีอยู่แล้ว (เทียบเป๊ะๆ)
- `standard_dose`, `generic_name`, `category`, `purpose`, `contraindication` — optional ทั้งหมด

**Response** `201`: ยาที่เพิ่งสร้าง (shape เดียวกับ item ใน `medicines` ของ endpoint ที่ 1)

**Response** `422` (ชื่อซ้ำ):
```json
{ "detail": "มียาชื่อนี้อยู่ในคลังยาแล้ว" }
```
(กรณีนี้จริงๆ Laravel validation จะจับเป็น `errors.drug_name` ก่อน — หน้าตาต่างจาก `detail` แต่ `apiFetchJson` ฝั่ง frontend หยิบข้อความถูกทั้งคู่)

---

## 3. PUT `/api/medicine-catalog/{id}/favorite`

Toggle สถานะติดดาว (favorite ↔ ไม่ favorite) ของยา — ไม่ต้องส่ง body, backend สลับค่าเดิมให้อัตโนมัติ

**Request**: `PUT /api/medicine-catalog/5/favorite` (body ว่าง)

**Response** `200`: ยาตัวนั้นพร้อมค่า `is_favorite` ใหม่

**Response** `404`: ถ้าไม่พบ id (Laravel route-model-binding default 404 page — ไม่ใช่ `{detail: ...}`)

---

## 4. POST `/api/medicine-catalog/bulk-import`

นำเข้ายาจากไฟล์ Excel (`.xlsx`, `.xls`) หรือ CSV (`.csv`, `.txt`) ครั้งละหลายรายการ — ใช้ `multipart/form-data`, field name ต้องชื่อ `file`

**Request** (multipart form):
```
POST /api/medicine-catalog/bulk-import
Content-Type: multipart/form-data

file: <ไฟล์ .xlsx/.xls/.csv, ไม่เกิน 5MB>
```

ตัวอย่าง React Native (ต้องใช้ `expo-document-picker` หรือเทียบเท่าเพื่อได้ไฟล์มาก่อน):
```js
const form = new FormData()
form.append('file', { uri: pickedFile.uri, name: pickedFile.name, type: pickedFile.mimeType })
await fetch(`${API_BASE}/medicine-catalog/bulk-import`, {
  method: 'POST',
  headers: { Accept: 'application/json' }, // อย่าตั้ง Content-Type เอง — ให้ fetch ใส่ multipart boundary ให้
  body: form,
})
```

### รูปแบบคอลัมน์ที่ไฟล์ต้องมี (แถวหัวตาราง แถวแรกของไฟล์)

ต้องเป็น**ข้อความไทยตรงตัว**ตามนี้เท่านั้น (ไม่รองรับชื่อคอลัมน์ภาษาอังกฤษ/คำพ้องอื่น) ลำดับคอลัมน์สลับได้ไม่เป็นไร ระบบจับคู่ตามชื่อหัวตาราง ไม่ใช่ตำแหน่ง:

| หัวตาราง (ต้องตรงตัว) | Field | จำเป็นไหม |
|---|---|---|
| `ชื่อยา` | `drug_name` | **required** |
| `ขนาดมาตรฐาน` | `standard_dose` | **required** |
| `ชื่อสามัญ` | `generic_name` | optional |
| `หมวดหมู่` | `category` | optional |
| `สรรพคุณ` | `purpose` | optional |
| `ข้อห้ามใช้` | `contraindication` | optional |

ตัวอย่างไฟล์ CSV:
```csv
ชื่อยา,ชื่อสามัญ,ขนาดมาตรฐาน,หมวดหมู่,สรรพคุณ,ข้อห้ามใช้
Cetirizine 10mg,Cetirizine,10mg,ยาแก้แพ้,ลดอาการแพ้ คัดจมูก,ง่วงซึม
Omeprazole 20mg,Omeprazole,20mg,ยาลดกรด,รักษาโรคกระเพาะ,
```
แถวที่ทุกคอลัมน์ว่างเปล่าจะถูกข้ามเงียบๆ (ไม่นับเป็นทั้งสำเร็จหรือ error) — ใช้เผื่อกรณีมีแถวว่างท้ายไฟล์

### Response `200` — สรุปผล import
```json
{
  "imported_count": 2,
  "failed_count": 3,
  "errors": [
    { "row": 3, "reason": "ไม่ได้ระบุชื่อยา" },
    { "row": 4, "reason": "ไม่ได้ระบุขนาดมาตรฐาน" },
    { "row": 6, "reason": "\"Paracetamol 500mg\" มีอยู่ในคลังยาแล้ว" }
  ]
}
```
- `row` คือเลขบรรทัดจริงในไฟล์ (แถวหัวตาราง = แถวที่ 1 เสมอ ดังนั้นข้อมูลแถวแรกสุดคือแถวที่ 2) ใช้ขึ้นข้อความแบบ "แถวที่ {row}: {reason}" ได้เลย
- เหตุผลที่เป็นไปได้: ไม่ได้ระบุชื่อยา / ไม่ได้ระบุขนาดมาตรฐาน / ชื่อนี้มีอยู่ในคลังแล้ว / ชื่อซ้ำกับแถวอื่นในไฟล์เดียวกัน
- แถวที่ผ่าน validation จะถูก insert เข้าคลังจริงเสมอ แม้บางแถวในไฟล์เดียวกันจะ error — import เป็น all-or-nothing แค่ตอน insert (ถ้า insert ล้มเหลวกลางทางจริงๆ เช่น DB ล่ม จะ rollback ทั้งหมดที่ผ่าน validation), **ไม่ใช่**ทั้งไฟล์ fail เพราะมีแค่บางแถวผิด

### Response `422` — ไฟล์มีปัญหาระดับโครงสร้าง (validate ก่อน insert ใดๆ ทั้งสิ้น)
```json
{ "detail": "ไฟล์ขาดคอลัมน์ที่จำเป็น: ชื่อยา, ขนาดมาตรฐาน" }
```
เกิดเมื่อไฟล์ไม่มีคอลัมน์ `ชื่อยา` และ/หรือ `ขนาดมาตรฐาน` เลย — กรณีนี้จะไม่ insert อะไรเลยแม้แต่แถวเดียว

### Response `422` — ไฟล์ผิดชนิด / ไม่ได้แนบไฟล์
```json
{ "message": "The given data was invalid.", "errors": { "file": ["รองรับเฉพาะไฟล์ .xlsx, .xls หรือ .csv"] } }
```

---

## หมายเหตุสำหรับหน้าบันทึกรายการยาผู้ป่วยเดิม (`PatientFormScreen` / `POST-PUT /api/patients`)

**ไม่มีการเปลี่ยน endpoint เดิมเลย** — `medications[].drug_name` ยังเป็น string ธรรมดา ไม่ได้บังคับว่าต้องมาจากคลังยากลาง จะพิมพ์เองหรือเลือกจาก autocomplete ที่ query `GET /api/medicine-catalog?search=...` ก็ได้ทั้งคู่ (ทดสอบแล้วว่า endpoint เดิมยังรับ free-text ปกติ ไม่ breaking change)

แนะนำ flow ฝั่ง UI: ช่องกรอกชื่อยาใน `PatientFormScreen` เป็น autocomplete ที่ debounce แล้วยิง `GET /api/medicine-catalog?search=...` โชว์ผลเป็น dropdown — เลือกจาก dropdown ก็ set `drug_name` (และอาจ auto-fill `standard_dose`/`purpose` ไปด้วย) หรือพิมพ์เองแล้ว submit ตรงๆ ก็ยังได้เหมือนเดิม
