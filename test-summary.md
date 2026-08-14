# สรุปผลการทดสอบหน่วย (Unit Testing) — สำหรับบทที่ 4

## 1. เครื่องมือและการตั้งค่า

| รายการ | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| Jest (ผ่าน `jest-expo` preset) | jest-expo 54.0.17 (jest 29.7.0) | เลือกเวอร์ชันให้ตรงกับ Expo SDK 54 ที่โปรเจกต์ใช้จริง |
| @testing-library/react-native | 14.0.1 | ใช้ `renderHook` ทดสอบ custom hooks โดยไม่ต้อง render หน้าจอเต็ม |
| babel-preset-expo | 54.0.12 | ตั้งค่าผ่าน `babel.config.js` (ไฟล์ที่ไม่เคยมีมาก่อน — Jest ต้องการไฟล์นี้แยกจาก Metro) |

**ไฟล์ที่เพิ่ม**: `jest.config.js`, `babel.config.js`
**คำสั่งรันเทส**: `npm test` (หรือ `npm test -- --coverage` เพื่อดู coverage)

## 2. ภาพรวมผลการทดสอบ

| รายการ | ผลลัพธ์ |
|---|---|
| จำนวนไฟล์ทดสอบ | 6 ไฟล์ |
| จำนวน test case ทั้งหมด | **60 รายการ** |
| ผ่าน | **60 / 60 (100%)** |
| ล้มเหลว | 0 |
| เวลารันทั้งหมด | ~3 วินาที |

## 3. สรุป Code Coverage (เฉพาะโมดูลที่อยู่ในขอบเขตการทดสอบ)

| ไฟล์ | % Statements | % Branch | % Functions | % Lines |
|---|---|---|---|---|
| `src/hook/useNurseLogin.js` | 100 | 100 | 100 | 100 |
| `src/hook/useMedicationReminders.js` | 92.68 | 72.22 | 84.61 | 91.42 |
| `src/services/nurseAuthService.js` | 100 | 91.66 | 100 | 100 |
| `src/utils/qr.js` | 100 | 100 | 100 | 100 |
| `src/utils/downloadQrCode.js` | 100 | 100 | 100 | 100 |
| `src/utils/medicationLocatorLogic.js` | 100 | 94.11 | 100 | 100 |
| **รวมเฉลี่ย** | **97.77** | **88.52** | **93.54** | **97.56** |

*หมายเหตุ: บรรทัดที่ยังไม่ครอบคลุมใน `useMedicationReminders.js` เป็นสาขาของการแจ้งเตือนผ่าน Web Notification API (`Notification.permission === 'granted'`) ซึ่งต้องจำลอง browser API เพิ่มเติมนอกเหนือขอบเขตที่กำหนด*

## 4. รายละเอียดการทดสอบแต่ละโมดูล

### 4.1 ตรรกะ AR/QR (หัวใจของระบบ) — `medicationLocatorLogic.test.js` (16 test case)

ก่อนทดสอบได้ ต้อง **refactor** แยกฟังก์ชัน pure ออกจาก `MedicationLocatorScreen.js` มาไว้ที่ไฟล์ใหม่ `src/utils/medicationLocatorLogic.js` (`getBoxRect`, `matchesSlot`, `matchesCassette`, `isTargetMedication`) เพื่อให้ทดสอบได้โดยไม่ต้อง mock กล้องหรือ render component — **พฤติกรรมเดิมของแอปไม่เปลี่ยนแปลง** (ตรวจสอบด้วยการ build จริงผ่าน Metro สำเร็จ 665 modules หลัง refactor)

| ฟังก์ชัน | สิ่งที่ทดสอบ |
|---|---|
| `getBoxRect` | คำนวณกรอบจาก `cornerPoints` (Android), fallback ไปที่ `bounds` (iOS), fallback ไปที่กรอบกลางจอเมื่อไม่มีข้อมูลเรขาคณิตที่ใช้ได้, ลำดับความสำคัญเมื่อมีทั้งสองแบบ |
| `matchesSlot` | เทียบ QR ลิ้นชักที่สแกนกับ QR ของผู้ป่วยตรง/ไม่ตรง/ไม่มีข้อมูล |
| `matchesCassette` | ค้นหายาจาก QR ตลับที่สแกน กรณีพบ/ไม่พบ/แผนที่ว่าง |
| `isTargetMedication` | ตัดสินว่ายาที่สแกนคือเป้าหมายปัจจุบันหรือไม่ ครอบคลุมกรณีไม่มีเป้าหมาย (จ่ายครบแล้ว) |

### 4.2 Utility functions

| ไฟล์ | Test case | สิ่งที่ทดสอบ |
|---|---|---|
| `qr.test.js` | 6 | ตัด whitespace, ค่า non-string (`undefined`/`null`/number), ค่าว่างล้วน |
| `downloadQrCode.test.js` | 8 | เว็บ: สร้าง `<a>` link ดาวน์โหลดถูกต้อง / native: เขียนไฟล์ผ่าน `expo-file-system`, ลบไฟล์เดิมก่อนถ้ามี, แชร์ผ่าน `expo-sharing` เมื่อใช้งานได้ และไม่แชร์เมื่อใช้งานไม่ได้ (mock ครบทั้งสอง platform, ไม่มีการเขียนไฟล์จริง) |

### 4.3 Services — `nurseAuthService.test.js` (11 test case)

ทดสอบทุก validation branch ของการสมัคร/เข้าสู่ระบบ (mock `../api` ทั้งหมด ไม่มีการยิง request จริง):

- สมัครสมาชิก: ชื่อว่าง, username ว่าง, รหัสผ่านสั้นกว่า 6 ตัว, ลำดับการตรวจสอบ, ตัดช่องว่างและเรียก API ถูกต้องเมื่อสำเร็จ, ส่งต่อ error จาก API (เช่น username ซ้ำ) โดยไม่เปลี่ยนข้อความ
- เข้าสู่ระบบ: username/รหัสผ่านว่าง, ไม่มีการจำกัดความยาวรหัสผ่านขั้นต่ำ (ต่างจากสมัคร), ส่งต่อ error จาก API (เช่น รหัสผ่านผิด)

### 4.4 Hooks

**`useNurseLogin.test.js` (12 test case)** — mock `nurseAuthService`, ใช้ `renderHook`:
- state เริ่มต้น (ไม่มี session, ไม่ loading, ไม่มี error)
- login/สมัครสมาชิกสำเร็จ → ตั้งค่า session, ล้าง error
- login/สมัครสมาชิกล้มเหลว → ตั้งค่า error, ไม่ตั้งค่า session
- `loading` เป็น `true` ระหว่างรอผลจริง
- **กันกดซ้ำ (double-submit guard)**: กด 2 ครั้งพร้อมกันขณะกำลังโหลด → เรียก API แค่ครั้งเดียว, ปลดล็อกอัตโนมัติหลังล้มเหลว (ลองใหม่ได้), ค้างล็อกไว้หลังสำเร็จจนกว่าจะ `resetLogin()`
- `resetLogin()` คืนค่าทุก state กลับเป็นค่าเริ่มต้นและปลดล็อกให้ login ใหม่ได้

**`useMedicationReminders.test.js` (10 test case)** — mock `../api` และ `../utils/notifications`, ใช้ Jest fake timers:
- ดึงข้อมูลยาที่ค้างจ่าย + ขอสิทธิ์แจ้งเตือนทันทีตอน mount (เฉพาะ native)
- `dueCount` ตรงกับจำนวนรายการที่ดึงมาได้จริง
- แจ้งเตือนเฉพาะรายการที่ "ยังไม่เคยเห็น" (`seenRef`) เท่านั้น — รายการเดิมที่เคยแจ้งแล้วจะไม่แจ้งซ้ำแม้ API จะส่งกลับมาอีก
- ดึงข้อมูลซ้ำทุก 60 วินาที, ตั้งเวลาแจ้งเตือนใหม่ทุก 10 นาที (เฉพาะ native)
- หยุดทำงานทั้งหมดหลัง unmount (ไม่มีการเรียก API ค้างอยู่เบื้องหลัง)
- บนเว็บ: ไม่ขอสิทธิ์แจ้งเตือนและไม่ตั้งเวลาแจ้งเตือนแบบ native
- เมื่อ API ล้มเหลว: ไม่ทำให้แอป crash, state คงค่าเดิม
- `dismissAlert()` ล้างรายการแจ้งเตือนปัจจุบัน

## 5. ข้อจำกัดที่พบระหว่างทำ (คุ้มค่าแก่การบันทึกไว้)

- Jest ในเวอร์ชันที่ใช้รัน `import()` แบบ dynamic (ที่ `downloadQrCode.js` ใช้โหลด `expo-file-system`/`expo-sharing`) ไม่ได้โดยตรง ต้องเพิ่ม `babel-plugin-dynamic-import-node` เฉพาะ environment ทดสอบ (ไม่กระทบ Metro/แอปจริง)
- `@testing-library/react-native` เวอร์ชันที่ใช้ (v14) เปลี่ยน `renderHook`/`unmount` ให้เป็นแบบ asynchronous (คืนค่า Promise) ต่างจากเอกสารเก่าที่พบทั่วไป จึงต้อง `await` ทุกครั้งที่เรียกใช้ ไม่เช่นนั้น state ของ hook จะไม่อัปเดตให้ตรวจสอบได้ทัน
