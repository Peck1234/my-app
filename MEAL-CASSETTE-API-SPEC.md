# สถาปัตยกรรมตลับยาใหม่ (1 QR = 1 มื้อ) — API Spec

Backend: `C:\backend`. **Breaking change จาก endpoint เดิม** — ไม่ใช่แค่เพิ่ม endpoint ใหม่ ต้องอ่านหัวข้อ "สิ่งที่เปลี่ยนใน endpoint เดิม" ด้วย

## แนวคิดหลัก

- ผู้ป่วย 1 คน มีตลับยาได้สูงสุด 5 ใบ: `breakfast` (เช้า), `lunch` (กลางวัน), `dinner` (เย็น), `bedtime` (ก่อนนอน), `prn` (ตามแพทย์สั่ง/ไม่มีเวลาแน่นอน)
- QR ของตลับ (`qr_code`) **ล็อกถาวร** ตั้งแต่สร้างครั้งแรก รูปแบบ `CASSETTE-{patient_id}-{meal}` เช่น `CASSETTE-3-breakfast`
- เพิ่ม/ลบยาในตลับได้เรื่อยๆ โดย QR เดิมไม่เปลี่ยน — แอปต้อง **lookup รายชื่อยาสดจาก backend ทุกครั้งที่สแกน** ห้าม cache/เดาจากที่เคยเห็น

---

## 1. `GET /api/patients/{patient}/meal-cassettes`

รายการตลับยาทั้งหมดของผู้ป่วย (เฉพาะมื้อที่มียาจริง เรียงตาม breakfast→lunch→dinner→bedtime→prn) — ใช้แสดงหน้า QR (`PatientQrCodesScreen`)

**Response** `200`:
```json
{
  "cassettes": [
    {
      "cassette_id": 1,
      "meal": "breakfast",
      "qr_code": "CASSETTE-3-breakfast",
      "is_new": false,
      "medications": [
        { "order_id": 3, "drug_name": "Paracetamol", "standard_dose": "500mg", "purpose": "ลดไข้", "dose": "1 เม็ด", "instruction": "...", "is_dispensed_today": false }
      ]
    }
  ]
}
```

---

## 2. `POST /api/patients/{patient}/meal-cassettes/assign-medicine`

**Endpoint หลักของ flow ใหม่**: กดยาจากคลังยากลาง → เลือกผู้ป่วย → เลือกมื้อ → เรียก endpoint นี้ทีเดียว (get-or-create ตลับ + เพิ่มยาเข้าไป ในคำขอเดียว)

**Request**:
```json
{
  "meal": "breakfast",           // required: breakfast|lunch|dinner|bedtime|prn
  "drug_name": "Paracetamol",    // required
  "standard_dose": "500mg",      // optional
  "purpose": "ลดไข้",             // optional
  "dose": "1 เม็ด",               // required
  "instruction": "หลังอาหาร"      // optional
}
```

**Response** `201` — shape เดียวกับ item ใน endpoint 1:
```json
{ "cassette_id": 1, "meal": "breakfast", "qr_code": "CASSETTE-3-breakfast", "is_new": true, "medications": [...] }
```

**`is_new` คือสัญญาณสำคัญที่สุดสำหรับ UI**:
- `is_new: true` → มื้อนี้เพิ่งมีตลับครั้งแรก (ไม่เคยมียามาก่อน) → **ต้องแสดงหน้า QR ให้พิมพ์/บันทึกรูป** (ใช้ pattern เดียวกับ `PatientQrCodesScreen`/`downloadQrCode.js`)
- `is_new: false` → มื้อนี้มีตลับอยู่แล้ว ยาถูกเพิ่มเข้าตลับเดิม → **แค่ toast แจ้ง** "เพิ่มยาเข้าตลับมื้อ{ชื่อมื้อ}ที่มีอยู่แล้วสำเร็จ" ไม่ต้องโชว์ QR ซ้ำ

---

## 3. `POST /api/verify-cassette`

สแกน QR ตลับ 1 ครั้ง → คืนยาทั้งหมดในมื้อนั้น (ไม่ dispense อะไรทั้งสิ้น แค่ verify + อ่านข้อมูล)

**Request**:
```json
{ "nurse_qr": "NURSE-001", "patient_qr": "PATIENT-0001", "cassette_qr": "CASSETTE-3-breakfast" }
```

**Response** `200` (ถูกต้อง):
```json
{
  "result": "correct",
  "message": "ตลับยาถูกต้อง",
  "cassette_id": 1,
  "meal": "breakfast",
  "medications": [
    { "order_id": 3, "drug_name": "Paracetamol", "standard_dose": "500mg", "purpose": "ลดไข้", "dose": "1 เม็ด", "instruction": "...", "is_dispensed_today": false },
    { "order_id": 4, "drug_name": "Amoxicillin", "...": "...", "is_dispensed_today": false }
  ]
}
```

**Response** `200` (ผิด — ไม่ throw error, แค่ `result: "incorrect"`):
```json
{ "result": "incorrect", "message": "ตลับยานี้ไม่ใช่ของผู้ป่วยรายนี้" }
```
ข้อความอื่นที่เป็นไปได้: `"ไม่พบข้อมูลพยาบาลจาก QR นี้"`, `"ไม่พบข้อมูลผู้ป่วยจาก QR นี้"`, `"QR code ไม่ถูกต้อง"`

**สแกนซ้ำได้ปกติ** แม้บางยาในตลับถูกจ่ายไปแล้ววันนี้ — `verify-cassette` ไม่เคย reject เพราะเหตุนี้ (ต่างจาก endpoint เดิม) แค่ flag `is_dispensed_today` ต่อยารายตัว ให้ UI ใช้ตัดสินใจว่าจะให้ติ๊กซ้ำได้ไหม

---

## 4. `POST /api/dispense-medications`

ยืนยันจ่ายยา 1 ตัวขึ้นไปจากตลับที่เพิ่งสแกน — เรียกได้ทั้งแบบทีละตัว (checklist) หรือส่ง id ทั้งหมดพร้อมกัน (ปุ่ม "ยืนยันทั้งหมด")

**Request**:
```json
{
  "nurse_qr": "NURSE-001",
  "patient_qr": "PATIENT-0001",
  "cassette_qr": "CASSETTE-3-breakfast",
  "medication_ids": [3, 4]
}
```
ระบบ verify nurse+patient+cassette ซ้ำอีกครั้งภายใน call นี้เอง (ไม่เชื่อ state ที่ frontend จำมาจาก verify-cassette เฉยๆ)

**Response** `200`:
```json
{
  "results": [
    { "order_id": 3, "result": "correct", "message": "จ่ายยาสำเร็จ", "drug_name": "Paracetamol" },
    { "order_id": 4, "result": "incorrect", "message": "ยานี้ถูกจ่ายไปแล้ววันนี้", "drug_name": "Amoxicillin" }
  ]
}
```
**สำคัญ**: แต่ละ id ใน `medication_ids` ได้ผลลัพธ์อิสระต่อกัน — ตัวหนึ่งสำเร็จ ตัวหนึ่งพลาด (เช่นถูกพยาบาลอีกคนจ่ายไปแล้วระหว่างนั้น) ได้ในการเรียกครั้งเดียวกัน UI ต้อง loop ผล `results` แสดงทีละตัว ไม่ใช่ทั้งก้อนสำเร็จ/ล้มเหลวพร้อมกัน

**Response** `422` (nurse/patient/cassette ไม่ตรงกันทั้งชุด — ไม่มี `results` เลย):
```json
{ "detail": "ตลับยานี้ไม่ใช่ของผู้ป่วยรายนี้" }
```

---

## สิ่งที่เปลี่ยนใน endpoint เดิม

### `POST /verify-dispense` → **ถูกลบ** ใช้ `/api/verify-cassette` + `/api/dispense-medications` แทน (ดูข้อ 3-4)

### `GET /api/patients/{patient}/medications`
รูปแบบ response เพิ่ม field ใหม่ 2 ตัว, field เดิมยังอยู่ครบ:
```json
{
  "medications": [
    {
      "order_id": 3, "drug_name": "Paracetamol", "standard_dose": "500mg",
      "purpose": "ลดไข้", "dose": "1 เม็ด", "instruction": "...",
      "time_slot": "08:00",
      "meal": "breakfast",                          // ← ใหม่
      "qr_code_cassette": "CASSETTE-3-breakfast",    // ← ค่าเปลี่ยนความหมาย: ตอนนี้คือ QR ของ "มื้อ" ไม่ใช่ของยาตัวนี้โดยเฉพาะ (ยาหลายตัวในมื้อเดียวกันจะมีค่านี้ซ้ำกัน)
      "dispensed_at": "...", "is_dispensed_today": false, "is_due": true
    }
  ]
}
```

### `POST /api/patients` และ `PUT /api/patients/{patient}` — **breaking change ที่ payload**
ฟิลด์ `medications[].qr_code_cassette` (พิมพ์เอง) **ถูกลบ** เปลี่ยนเป็น `medications[].meal` (required, เลือกจาก 5 ค่า) แทน — backend get-or-create cassette ให้อัตโนมัติเหมือน endpoint 2

```json
{
  "full_name": "...", "qr_code_patient": "...",
  "medications": [
    { "id": null, "drug_name": "Paracetamol", "standard_dose": "500mg", "purpose": "ลดไข้", "dose": "1 เม็ด", "instruction": "...", "meal": "breakfast" }
  ]
}
```
- ถ้าส่ง `id` ของยาเดิมมาพร้อม `meal` ที่ต่างจากเดิม → **ย้ายยาไปตลับมื้อใหม่ได้เลย** (แก้ meal ของยาที่มีอยู่แล้ว = เปลี่ยน cassette ที่ผูกอยู่ทันที)
- `time_slot` ไม่ต้องส่งมาแล้ว ระบบ derive อัตโนมัติจาก `meal` (breakfast=08:00, lunch=12:00, dinner=18:00, bedtime=21:00, prn=null)

---

## ข้อมูลเก่าที่ migrate ไปแล้ว (สำหรับอ้างอิง ไม่ต้องทำอะไรเพิ่ม)

รันแล้วบน dev database — ยาที่เคยมีหลายเวลาใน `time_slot` (เช่น `"08:00,12:00,18:00"`) ถูกแยกเป็นหลายแถว หนึ่งแถวต่อหนึ่งมื้อ ยาที่ไม่มีเวลาแน่นอน/PRN ถูกใส่ไว้ใน cassette มื้อ `prn`
