import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import * as XLSX from 'xlsx'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import { bulkImportMedicines, fetchMedicineCatalog } from '../api'
import { colors, radius, spacing } from '../constants/theme'

const ACCEPTED_EXTENSIONS = ['xlsx', 'xls', 'csv', 'txt']

const REQUIRED_HEADERS = { drug_name: 'ชื่อยา', standard_dose: 'ขนาดมาตรฐาน' }
const OPTIONAL_HEADERS = { generic_name: 'ชื่อสามัญ', category: 'หมวดหมู่', purpose: 'สรรพคุณ', contraindication: 'ข้อห้ามใช้' }

// Mirrors the backend's own row-by-row validation (required headers, missing
// name/dose, exact duplicate against the catalog already loaded, duplicate
// within the same file) so the preview shown here matches what the server
// will actually do on confirm - not a guess at what might happen.
function buildPreview(rows2D, existingCatalog) {
  if (!rows2D.length) {
    return { headerError: 'ไฟล์ว่างเปล่า ไม่พบแถวหัวตาราง' }
  }

  const header = rows2D[0].map((cell) => (typeof cell === 'string' ? cell.trim() : cell))
  const allHeaders = { ...REQUIRED_HEADERS, ...OPTIONAL_HEADERS }
  const columnIndex = {}
  for (const [field, label] of Object.entries(allHeaders)) {
    const idx = header.indexOf(label)
    if (idx !== -1) columnIndex[field] = idx
  }

  const missing = Object.entries(REQUIRED_HEADERS)
    .filter(([field]) => !(field in columnIndex))
    .map(([, label]) => label)
  if (missing.length > 0) {
    return { headerError: `ไฟล์ขาดคอลัมน์ที่จำเป็น: ${missing.join(', ')}` }
  }

  const existingNames = new Set(existingCatalog.map((m) => m.drug_name.trim().toLowerCase()))
  const seenInBatch = new Map()
  const validRows = []
  const errorRows = []

  const cellAt = (row, field) => {
    const idx = columnIndex[field]
    if (idx === undefined) return null
    const raw = row[idx]
    if (raw === null || raw === undefined) return null
    const text = (typeof raw === 'string' ? raw : String(raw)).trim()
    return text === '' ? null : text
  }

  for (let i = 1; i < rows2D.length; i++) {
    const row = rows2D[i]
    const rowNumber = i + 1
    const isBlank = Object.keys(columnIndex).every((field) => cellAt(row, field) === null)
    if (isBlank) continue

    const drugName = cellAt(row, 'drug_name')
    const standardDose = cellAt(row, 'standard_dose')

    if (!drugName) {
      errorRows.push({ row: rowNumber, reason: 'ไม่ได้ระบุชื่อยา' })
      continue
    }
    if (!standardDose) {
      errorRows.push({ row: rowNumber, reason: 'ไม่ได้ระบุขนาดมาตรฐาน' })
      continue
    }

    const key = drugName.toLowerCase()
    if (existingNames.has(key)) {
      errorRows.push({ row: rowNumber, reason: `"${drugName}" มีอยู่ในคลังยาแล้ว` })
      continue
    }
    if (seenInBatch.has(key)) {
      errorRows.push({ row: rowNumber, reason: `"${drugName}" ซ้ำกับแถวที่ ${seenInBatch.get(key)} ในไฟล์เดียวกัน` })
      continue
    }
    seenInBatch.set(key, rowNumber)

    validRows.push({ row: rowNumber, drug_name: drugName, standard_dose: standardDose })
  }

  return { validRows, errorRows }
}

export default function MedicineImportScreen({ existingCatalog, onImported, onCancel }) {
  const [stage, setStage] = useState('pick') // pick | preview | result
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)
  const [pickedFile, setPickedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  // Re-fetched fresh on mount instead of trusting `existingCatalog` as-is -
  // that prop is a snapshot from whenever the parent list screen last
  // loaded, which can be stale (another nurse added a drug since, or this
  // screen was opened right as the parent's own fetch was still in flight)
  // and would make the "already in catalog" duplicate check in the preview
  // miss a real duplicate. The actual import is still validated
  // authoritatively by the backend regardless, but the preview should match
  // what confirming will really do.
  const [catalog, setCatalog] = useState(existingCatalog)
  const [catalogLoading, setCatalogLoading] = useState(true)

  useEffect(() => {
    fetchMedicineCatalog()
      .then(setCatalog)
      .catch(() => {}) // fall back to the possibly-stale prop already in state
      .finally(() => setCatalogLoading(false))
  }, [])

  const reset = () => {
    setStage('pick')
    setError(null)
    setPickedFile(null)
    setPreview(null)
    setResult(null)
  }

  const pickFile = async () => {
    setError(null)
    let picked
    try {
      picked = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, base64: true })
    } catch (err) {
      setError('เปิดตัวเลือกไฟล์ไม่สำเร็จ กรุณาลองใหม่')
      return
    }
    if (picked.canceled) return

    const asset = picked.assets[0]
    const ext = (asset.name.split('.').pop() || '').toLowerCase()
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError('รองรับเฉพาะไฟล์ .xlsx, .xls หรือ .csv')
      return
    }

    setParsing(true)
    try {
      let base64
      if (Platform.OS === 'web') {
        // On web, expo-document-picker reads the file via FileReader.readAsDataURL,
        // so asset.base64 is a full "data:<mime>;base64,<payload>" string, not a
        // bare base64 payload - strip the prefix before handing it to XLSX.read.
        base64 = asset.base64.replace(/^data:.*;base64,/, '')
      } else {
        base64 = await new File(asset.uri).base64()
      }

      // codepage 65001 (UTF-8) is required here - without it SheetJS's CSV
      // reader defaults to a single-byte codepage and mangles every Thai
      // (multi-byte) header/cell into mojibake, which then fails to match
      // the expected Thai column headers below even though the file is fine.
      const workbook = XLSX.read(base64, { type: 'base64', codepage: 65001 })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows2D = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

      const parsed = buildPreview(rows2D, catalog)
      if (parsed.headerError) {
        setError(parsed.headerError)
        return
      }

      setPickedFile(asset)
      setPreview(parsed)
      setStage('preview')
    } catch (err) {
      setError('ไม่สามารถอ่านไฟล์นี้ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel/CSV ที่ถูกต้อง')
    } finally {
      setParsing(false)
    }
  }

  const handleConfirm = async () => {
    setImporting(true)
    setError(null)
    try {
      const data = await bulkImportMedicines(pickedFile)
      setResult(data)
      setStage('result')
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  if (stage === 'result' && result) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.resultHeader}>
          <View style={styles.resultIcon}>
            <Ionicons name="checkmark" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>นำเข้าเสร็จสิ้น</Text>
          <Text style={styles.subtitle}>
            สำเร็จ {result.imported_count} รายการ{result.failed_count > 0 ? ` · มีปัญหา ${result.failed_count} รายการ` : ''}
          </Text>
        </View>

        {result.errors?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>รายการที่ไม่ถูกนำเข้า</Text>
            {result.errors.map((e, idx) => (
              <View key={idx} style={styles.errorRow}>
                <Text style={styles.errorRowLabel}>แถวที่ {e.row}</Text>
                <Text style={styles.errorRowReason}>{e.reason}</Text>
              </View>
            ))}
          </View>
        )}

        <Button label="เสร็จสิ้น" onPress={onImported} variant="primary" />
      </ScrollView>
    )
  }

  if (stage === 'preview' && preview) {
    const { validRows, errorRows } = preview
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <LinkButton label="เลือกไฟล์ใหม่" onPress={reset} />
        <Text style={styles.title}>ตรวจสอบก่อนนำเข้า</Text>
        <Text style={styles.subtitle}>{pickedFile?.name}</Text>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, styles.summaryPillOk]}>
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <Text style={[styles.summaryText, { color: colors.success }]}>จะนำเข้า {validRows.length} รายการ</Text>
          </View>
          {errorRows.length > 0 && (
            <View style={[styles.summaryPill, styles.summaryPillError]}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={[styles.summaryText, { color: colors.danger }]}>มีปัญหา {errorRows.length} รายการ</Text>
            </View>
          )}
        </View>

        {errorRows.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>แถวที่จะถูกข้าม</Text>
            {errorRows.map((e, idx) => (
              <View key={idx} style={styles.errorRow}>
                <Text style={styles.errorRowLabel}>แถวที่ {e.row}</Text>
                <Text style={styles.errorRowReason}>{e.reason}</Text>
              </View>
            ))}
          </View>
        )}

        {validRows.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>รายการที่จะนำเข้า</Text>
            {validRows.map((r) => (
              <View key={r.row} style={styles.validRow}>
                <Text style={styles.validRowName} numberOfLines={1}>{r.drug_name}</Text>
                <Text style={styles.validRowDose}>{r.standard_dose}</Text>
              </View>
            ))}
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          label={importing ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า ${validRows.length} รายการ`}
          onPress={handleConfirm}
          loading={importing}
          disabled={validRows.length === 0}
          variant="primary"
        />
      </ScrollView>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <LinkButton label="คลังยา" onPress={onCancel} />
      <Text style={styles.title}>นำเข้ายาจาก Excel/CSV</Text>
      <Text style={styles.subtitle}>
        ไฟล์ต้องมีแถวหัวตารางเป็น "ชื่อยา" และ "ขนาดมาตรฐาน" อย่างน้อย (คอลัมน์เสริม: ชื่อสามัญ, หมวดหมู่, สรรพคุณ,
        ข้อห้ามใช้) รองรับไฟล์ .xlsx, .xls, .csv
      </Text>

      <View style={styles.card}>
        <Ionicons name="document-attach-outline" size={28} color={colors.accent} />
        <Text style={styles.pickHint}>เลือกไฟล์จากเครื่องเพื่อดูตัวอย่างข้อมูลก่อนนำเข้าจริง</Text>
        <Button
          label={parsing ? 'กำลังอ่านไฟล์...' : catalogLoading ? 'กำลังโหลดคลังยา...' : 'เลือกไฟล์'}
          onPress={pickFile}
          loading={parsing || catalogLoading}
          disabled={catalogLoading}
          variant="outline"
          icon="folder-open-outline"
        />
      </View>

      {parsing && (
        <View style={styles.centerStage}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.md + 2, paddingBottom: 40 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: {
    gap: spacing.sm + 2,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickHint: { color: colors.muted, fontSize: 13 },
  centerStage: { alignItems: 'center', paddingVertical: 12 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  summaryPillOk: { backgroundColor: colors.successBg },
  summaryPillError: { backgroundColor: colors.dangerBg },
  summaryText: { fontSize: 13, fontWeight: '800' },
  sectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  errorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  errorRowLabel: { color: colors.muted, fontSize: 12.5, fontWeight: '700' },
  errorRowReason: { color: colors.danger, fontSize: 12.5, flex: 1, textAlign: 'right' },
  validRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  validRowName: { color: colors.ink, fontSize: 13, fontWeight: '700', flex: 1 },
  validRowDose: { color: colors.muted, fontSize: 12.5 },
  resultHeader: { alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    marginBottom: 6,
  },
})
