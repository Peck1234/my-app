import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Button from '../components/Button'
import LinkButton from '../components/LinkButton'
import CameraPermissionGate from '../components/CameraPermissionGate'
import QrScanView from '../components/QrScanView'
import { normalizeQrValue } from '../utils/qr'
import { colors, radius } from '../constants/theme'

export default function PatientScanScreen({ patients, onFound, onClose }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleBarcodeScanned = useCallback(
    (event) => {
      if (loading || result) return

      const patientQr = normalizeQrValue(event?.data)
      if (!patientQr) return

      const match = patients.find((p) => p.qr_code_patient === patientQr)

      setResult({
        found: !!match,
        patient: match || null,
      })
    },
    [loading, result, patients]
  )

  const handleRetry = () => {
    setResult(null)
    // กันกล้องจับ QR ใบเดิมที่ยังค้างอยู่ในเฟรมซ้ำทันทีก่อนจะขยับไปเจอใบใหม่
    setLoading(true)
    setTimeout(() => setLoading(false), 800)
  }

  return (
    <View style={styles.shell}>
      <LinkButton label="ยกเลิก" onPress={onClose} />

      <Text style={styles.title}>สแกน QR ยืนยันตัวผู้ป่วย</Text>
      <Text style={styles.subtitle}>ส่องกล้องไปที่ QR บนป้ายข้อมือผู้ป่วย</Text>

      <CameraPermissionGate>
        <QrScanView loading={loading || !!result} onBarcodeScanned={handleBarcodeScanned} />
      </CameraPermissionGate>

      {!!result && (
        <View
          style={[
            styles.resultCard,
            result.found ? styles.resultSuccess : styles.resultError,
          ]}
        >
          <View style={styles.resultTop}>
            <View
              style={[
                styles.resultIcon,
                result.found ? styles.resultIconSuccess : styles.resultIconError,
              ]}
            >
              <Ionicons name={result.found ? 'checkmark' : 'close'} size={18} color="#FFFFFF" />
            </View>
            <View style={styles.resultTopText}>
              <Text style={styles.resultTitle}>
                {result.found ? `พบผู้ป่วย: ${result.patient.full_name}` : 'ไม่พบผู้ป่วยที่ตรงกับ QR นี้'}
              </Text>
              {result.found && (
                <Text style={styles.resultMessage}>
                  {[result.patient.ward, result.patient.bed_no && `เตียง ${result.patient.bed_no}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </View>
          </View>

          <Button
            label={result.found ? 'ไปที่ผู้ป่วยรายนี้' : 'สแกนใหม่'}
            onPress={result.found ? () => onFound(result.patient) : handleRetry}
            variant={result.found ? 'success' : 'outline'}
            icon={result.found ? 'arrow-forward' : 'refresh'}
            fullWidth={false}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    gap: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: 6,
  },
  resultCard: {
    flex: 0,
    gap: 14,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
  },
  resultSuccess: {
    borderLeftColor: colors.success,
  },
  resultError: {
    borderLeftColor: colors.danger,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconSuccess: {
    backgroundColor: colors.success,
  },
  resultIconError: {
    backgroundColor: colors.danger,
  },
  resultTopText: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  resultMessage: {
    color: colors.muted,
    fontSize: 14,
  },
})
