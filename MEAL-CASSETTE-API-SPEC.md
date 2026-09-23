# สถาปัตยกรรมตลับยาใหม่ (1 QR = 1 มื้อ) — API Spec

Backend: `C:\backend`. **Breaking change จาก endpoint เดิม** — ไม่ใช่แค่เพิ่ม endpoint ใหม่ ต้องอ่านหัวข้อ "สิ่งที่เปลี่ยนใน endpoint เดิม" ด้วย

> **2026-09-02 update**: มื้อขยายจาก 5 เป็น 9 ค่า (แยกก่อน/หลังอาหารในแต่ละมื้อหลัก) — ดูหัวข้อ "การเปลี่ยนแปลง 2026-09-02" ท้ายไฟล์สำหรับสิ่งที่ backend session ต้องอัปเดตให้ตรงกัน เนื้อหาด้านล่างทั้งหมดอัปเดตเป็นค่าใหม่ 9 ค่าแล้ว

## แนวคิดหลัก

- ผู้ป่วย 1 คน มีตลับยาได้สูงสุด **9 ใบ**: แต่ละมื้อหลัก (เช้า/กลางวัน/เย็น/ก่อนนอน) แยกก่อน/หลังอาหาร บวก `prn` (ตามแพทย์สั่ง/ไม่มีเวลาแน่นอน)
  - `breakfast_before` (เช้า-ก่อนอาหาร), `breakfast_after` (เช้า-หลังอาหาร)
  - `lunch_before` (กลางวัน-ก่อนอาหาร), `lunch_after` (กลางวัน-หลังอาหาร)
  - `dinner_before` (เย็น-ก่อนอาหาร), `dinner_after` (เย็น-หลังอาหาร)
  - `bedtime_before` (ก่อนนอน-ก่อนอาหาร), `bedtime_after` (ก่อนนอน-หลังอาหาร)
  - `prn` (ตามแพทย์สั่ง)
- QR ของตลับ (`qr_code`) **ล็อกถาวร** ตั้งแต่สร้างครั้งแรก รูปแบบ `CASSETTE-{patient_id}-{meal}` เช่น `CASSETTE-3-breakfast_before`
- เพิ่ม/ลบยาในตลับได้เรื่อยๆ โดย QR เดิมไม่เปลี่ยน — แอปต้อง **lookup รายชื่อยาสดจาก backend ทุกครั้งที่สแกน** ห้าม cache/เดาจากที่เคยเห็น

---

## 1. `GET /api/patients/{patient}/meal-cassettes`

รายการตลับยาทั้งหมดของผู้ป่วย (เฉพาะมื้อที่มียาจริง เรียงตาม breakfast_before→breakfast_after→lunch_before→lunch_after→dinner_before→dinner_after→bedtime_before→bedtime_after→prn) — ใช้แสดงหน้า QR (`PatientQrCodesScreen`)

**Response** `200`:
```json
{
  "cassettes": [
    {
      "cassette_id": 1,
      "meal": "breakfast_before",
      "qr_code": "CASSETTE-3-breakfast_before",
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
  "meal": "breakfast_before",    // required: breakfast_before|breakfast_after|lunch_before|lunch_after|dinner_before|dinner_after|bedtime_before|bedtime_after|prn
  "drug_name": "Paracetamol",    // required
  "standard_dose": "500mg",      // optional
  "purpose": "ลดไข้",             // optional
  "dose": "1 เม็ด",               // required
  "instruction": "หลังอาหาร"      // optional
}
```

**Response** `201` — shape เดียวกับ item ใน endpoint 1:
```json
{ "cassette_id": 1, "meal": "breakfast_before", "qr_code": "CASSETTE-3-breakfast_before", "is_new": true, "medications": [...] }
```

**`is_new` คือสัญญาณสำคัญที่สุดสำหรับ UI**:
- `is_new: true` → มื้อนี้เพิ่งมีตลับครั้งแรก (ไม่เคยมียามาก่อน) → **ต้องแสดงหน้า QR ให้พิมพ์/บันทึกรูป** (ใช้ pattern เดียวกับ `PatientQrCodesScreen`/`downloadQrCode.js`)
- `is_new: false` → มื้อนี้มีตลับอยู่แล้ว ยาถูกเพิ่มเข้าตลับเดิม → **แค่ toast แจ้ง** "เพิ่มยาเข้าตลับมื้อ{ชื่อมื้อ}ที่มีอยู่แล้วสำเร็จ" ไม่ต้องโชว์ QR ซ้ำ

---

## 3. `POST /api/verify-cassette`

สแกน QR ตลับ 1 ครั้ง → คืนยาทั้งหมดในมื้อนั้น (ไม่ dispense อะไรทั้งสิ้น แค่ verify + อ่านข้อมูล)

**Request**:
```json
{ "nurse_qr": "NURSE-001", "patient_qr": "PATIENT-0001", "cassette_qr": "CASSETTE-3-breakfast_before" }
```

**Response** `200` (ถูกต้อง):
```json
{
  "result": "correct",
  "message": "ตลับยาถูกต้อง",
  "cassette_id": 1,
  "meal": "breakfast_before",
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
  "cassette_qr": "CASSETTE-3-breakfast_before",
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
      "time_slot": "07:30",
      "meal": "breakfast_before",                          // ← ใหม่
      "qr_code_cassette": "CASSETTE-3-breakfast_before",    // ← ค่าเปลี่ยนความหมาย: ตอนนี้คือ QR ของ "มื้อ" ไม่ใช่ของยาตัวนี้โดยเฉพาะ (ยาหลายตัวในมื้อเดียวกันจะมีค่านี้ซ้ำกัน)
      "dispensed_at": "...", "is_dispensed_today": false, "is_due": true
    }
  ]
}
```

### `POST /api/patients` และ `PUT /api/patients/{patient}` — **breaking change ที่ payload**
ฟิลด์ `medications[].qr_code_cassette` (พิมพ์เอง) **ถูกลบ** เปลี่ยนเป็น `medications[].meal` (required, เลือกจาก 9 ค่า) แทน — backend get-or-create cassette ให้อัตโนมัติเหมือน endpoint 2

```json
{
  "full_name": "...", "qr_code_patient": "...",
  "medications": [
    { "id": null, "drug_name": "Paracetamol", "standard_dose": "500mg", "purpose": "ลดไข้", "dose": "1 เม็ด", "instruction": "...", "meal": "breakfast_before" }
  ]
}
```
- ถ้าส่ง `id` ของยาเดิมมาพร้อม `meal` ที่ต่างจากเดิม → **ย้ายยาไปตลับมื้อใหม่ได้เลย** (แก้ meal ของยาที่มีอยู่แล้ว = เปลี่ยน cassette ที่ผูกอยู่ทันที)
- `time_slot` ไม่ต้องส่งมาแล้ว ระบบ derive อัตโนมัติจาก `meal`:

| meal | time_slot |
|---|---|
| `breakfast_before` | `07:30` |
| `breakfast_after` | `08:30` |
| `lunch_before` | `11:30` |
| `lunch_after` | `12:30` |
| `dinner_before` | `17:30` |
| `dinner_after` | `18:30` |
| `bedtime_before` | `20:30` |
| `bedtime_after` | `21:30` |
| `prn` | `null` |

---

## ข้อมูลเก่าที่ migrate ไปแล้ว (สำหรับอ้างอิง ไม่ต้องทำอะไรเพิ่ม)

รันแล้วบน dev database (2026-08-27) — ยาที่เคยมีหลายเวลาใน `time_slot` (เช่น `"08:00,12:00,18:00"`) ถูกแยกเป็นหลายแถว หนึ่งแถวต่อหนึ่งมื้อ ยาที่ไม่มีเวลาแน่นอน/PRN ถูกใส่ไว้ใน cassette มื้อ `prn`

---

## การเปลี่ยนแปลง 2026-09-02: มื้อขยายจาก 5 เป็น 9 ค่า

**สถานะข้อมูล ณ ตอนแก้**: ยังเป็นข้อมูลทดลองทั้งหมด ไม่มีผู้ป่วยจริงในระบบ — **ไม่ต้อง migrate ข้อมูลเดิม** เปลี่ยน enum ตรงๆ ได้เลย (ยืนยันแล้วจากผู้ใช้)

**Frontend (`c:\my-app`, ทำเสร็จแล้ว)**:
- [src/constants/meals.js](src/constants/meals.js) — `MEALS`/`MEAL_LABELS`/`MEAL_TIMES` เปลี่ยนจาก 5 → 9 ค่าตามตารางด้านบน เพิ่ม `MAIN_MEALS`/`BEFORE_AFTER_LABELS` (ตัวช่วย UI-only สำหรับจัดกลุ่มแสดงผล ไม่ส่งขึ้น backend)
- [src/components/MealPicker.js](src/components/MealPicker.js) — component ใหม่ ใช้เลือกมื้อแบบจัดกลุ่ม (การ์ดมื้อหลัก 4 การ์ด × ปุ่มก่อน/หลังอาหาร + PRN แยกท้ายสุด) แทน pill แบนราบ 9 ปุ่ม ใช้ร่วมกันใน `MedicineAssignScreen.js` และ `PatientFormScreen.js`
- `MedicineAssignScreen.js`, `PatientFormScreen.js` — เปลี่ยนมาใช้ `<MealPicker>` แล้ว, ลบ style `mealGrid`/`mealPill*` เดิมที่ไม่ใช้แล้ว
- `PatientQrCodesScreen.js`, `CassetteDetailScreen.js`, `MedicationLocatorScreen.js` — ใช้ `MEAL_LABELS[x]` lookup เฉยๆ ไม่มี logic ผูกกับจำนวนมื้อตายตัว ทำงานถูกต้องกับ 9 ค่าใหม่โดยไม่ต้องแก้โค้ด (ตรวจสอบแล้ว)
- `src/api.js` — ไม่ต้องแก้ ส่งค่า `meal` ตรงๆ ไม่มี validation/whitelist ฝั่ง frontend อยู่แล้ว
- เทสต์: รันครบ 91/91 ผ่าน ไม่มีเทสต์ไหนอ้างอิงจำนวนมื้อตายตัว

**Backend (`C:\backend`, ทำเสร็จแล้ว — 2026-09-02)**:
1. `PatientMealCassette::MEALS`/`MEAL_TIMES` → เปลี่ยนเป็น 9 ค่าตามรายการบนสุดของไฟล์นี้แล้ว ตรงกับ frontend เป๊ะ ทุกจุดที่ validate/derive `meal` (`PatientController`, `PatientMealCassetteController`) อ้างอิง constant นี้อยู่แล้ว ไม่มีจุด hardcode แยกต่างหาก เลยอัปเดตอัตโนมัติ ไม่ต้องแก้เพิ่ม
2. คอลัมน์ `meal` เป็น DB-level `enum(...)` จริง — เพิ่ม migration [`2026_09_02_120000_expand_patient_meal_cassette_meal_enum.php`](C:/backend/database/migrations/2026_09_02_120000_expand_patient_meal_cassette_meal_enum.php) แก้ enum เป็น 9 ค่าใหม่ (แยก MySQL raw `ALTER ... MODIFY` กับ SQLite drop+recreate column เพราะ SQLite ไม่รองรับ syntax เดียวกัน — phpunit ใช้ SQLite in-memory)
3. ล้างข้อมูลทดลองเก่าแล้ว (migration เดียวกัน `DB::table('patient_meal_cassettes')->delete()` ก่อนเปลี่ยน enum, cascade ลบ medications ไปด้วย) — ยืนยันบนฐานข้อมูล dev จริง: cassettes 16→0, medications 53→0, patients ยังอยู่ครบ 6 (ไม่แตะ patients เอง)
4. รัน `php artisan test` ผ่านครบ 135/135 (แก้ literal มื้อเก่าใน 6 ไฟล์เทสต์ที่ยังอ้าง `'breakfast'`/`'lunch'`/ฯลฯ ตรงๆ ให้เป็นค่าใหม่)
5. ทดสอบจริงผ่าน HTTP ครบทั้ง 4 endpoint ในสเปกนี้ (สร้างผู้ป่วยด้วย `meal: breakfast_before` → get-or-create ซ้ำที่มื้อเดิม `is_new:false` → มื้อใหม่ `is_new:true` → `verify-cassette` → `dispense-medications` สำเร็จทั้งคู่) แล้วล้าง fixture ที่ใช้ทดสอบออกจาก DB dev เรียบร้อย
