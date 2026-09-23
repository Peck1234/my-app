// One-off script to generate a sample Excel file for manually testing the
// "นำเข้ายาจาก Excel/CSV" (bulk medicine import) feature. Not part of the
// app itself - run with `node scripts/generate-test-medicine-import.js`.
const XLSX = require('xlsx')
const path = require('path')

const headers = ['ชื่อยา', 'ขนาดมาตรฐาน', 'ชื่อสามัญ', 'หมวดหมู่', 'สรรพคุณ', 'ข้อห้ามใช้']

const rows = [
  headers,
  ['พาราเซตามอล 500 มก.', '1 เม็ด ทุก 6 ชม.', 'Paracetamol', 'ยาแก้ปวดลดไข้', 'บรรเทาปวด ลดไข้', 'โรคตับรุนแรง'],
  ['อะม็อกซีซิลลิน 500 มก.', '1 แคปซูล ทุก 8 ชม.', 'Amoxicillin', 'ยาปฏิชีวนะ', 'รักษาการติดเชื้อแบคทีเรีย', 'แพ้ยากลุ่มเพนิซิลลิน'],
  ['ไอบูโพรเฟน 400 มก.', '1 เม็ด ทุก 8 ชม. หลังอาหาร', '', '', '', ''],
  ['เมทฟอร์มิน 500 มก.', '1 เม็ด วันละ 2 ครั้ง', 'Metformin', 'ยาเบาหวาน', 'ควบคุมระดับน้ำตาลในเลือด', 'โรคไตรุนแรง'],
  ['โลซาร์แทน 50 มก.', '', 'Losartan', 'ยาลดความดัน', '', ''], // error row: missing required dose
  ['', '1 เม็ด ก่อนนอน', '', '', '', ''], // error row: missing required name
  ['พาราเซตามอล 500 มก.', '1 เม็ด ทุก 4 ชม.', '', '', '', ''], // error row: duplicate name within file
  ['', '', '', '', '', ''], // blank row - should just be skipped, not an error
  ['เซทิริซีน 10 มก.', '1 เม็ด วันละครั้ง ก่อนนอน', 'Cetirizine', 'ยาแก้แพ้', 'บรรเทาอาการแพ้ ลมพิษ', 'ง่วงซึม'],
]

const sheet = XLSX.utils.aoa_to_sheet(rows)
const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(workbook, sheet, 'คลังยา')

const outPath = path.join(__dirname, '..', 'ทดสอบ-นำเข้ายา.xlsx')
XLSX.writeFile(workbook, outPath)
console.log('Written to', outPath)
