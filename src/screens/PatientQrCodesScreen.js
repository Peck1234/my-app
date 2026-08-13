import { useRef } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { Ionicons } from '@expo/vector-icons'
import Button from '../components/Button'
import { downloadQrCode } from '../utils/downloadQrCode'
import { colors, radius } from '../constants/theme'

export default function PatientQrCodesScreen({ patient, medications, onDone, onAssignToSlot }) {
  const patientQrRef = useRef(null)
  const medQrRefs = useRef({})

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconMark}>
          <Ionicons name="qr-code" size={22} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>รหัส QR สำหรับ {patient.full_name}</Text>
        <Text style={styles.subtitle}>
          ถ่ายภาพหน้าจอนี้หรือพิมพ์ออกไปติดที่ป้ายข้อมือผู้ป่วยและตลับยาแต่ละรายการ
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>ป้ายข้อมือผู้ป่วย</Text>
        <View style={styles.qrBox}>
          <QRCode value={patient.qr_code_patient} size={168} getRef={(ref) => (patientQrRef.current = ref)} />
        </View>
        <Text style={styles.qrName}>{patient.full_name}</Text>
        <Text style={styles.qrCode}>{patient.qr_code_patient}</Text>
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() =>
            downloadQrCode(patientQrRef, `patient-${patient.qr_code_patient}.png`)
          }
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={14} color={colors.accent} />
          <Text style={styles.downloadButtonText}>ดาวน์โหลด</Text>
        </TouchableOpacity>
      </View>

      {!!onAssignToSlot && (
        <TouchableOpacity style={styles.assignBanner} onPress={onAssignToSlot} activeOpacity={0.7}>
          <View style={styles.assignBannerIcon}>
            <Ionicons name="grid" size={18} color="#FFFFFF" />
          </View>
          <View style={styles.assignBannerText}>
            <Text style={styles.assignBannerTitle}>ผูกกับช่องยาเลย</Text>
            <Text style={styles.assignBannerSub}>เลือกช่องว่างให้ผู้ป่วยรายนี้ตอนนี้</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.accent} />
        </TouchableOpacity>
      )}

      {medications.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>ตลับยา ({medications.length} รายการ)</Text>
          <View style={styles.medGrid}>
            {medications.map((med) => (
              <View key={med.qr_code_cassette} style={styles.medCard}>
                <View style={styles.qrBoxSmall}>
                  <QRCode
                    value={med.qr_code_cassette}
                    size={110}
                    getRef={(ref) => (medQrRefs.current[med.qr_code_cassette] = ref)}
                  />
                </View>
                <Text style={styles.medName} numberOfLines={2}>
                  {med.drug_name}
                  {med.standard_dose ? ` ${med.standard_dose}` : ''}
                </Text>
                <Text style={styles.qrCodeSmall}>{med.qr_code_cassette}</Text>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() =>
                    downloadQrCode(
                      { current: medQrRefs.current[med.qr_code_cassette] },
                      `cassette-${med.qr_code_cassette}.png`
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons name="download-outline" size={12} color={colors.accent} />
                  <Text style={styles.downloadButtonTextSmall}>ดาวน์โหลด</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}

      <Button label="เสร็จสิ้น" onPress={onDone} variant="primary" style={styles.doneButton} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  iconMark: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginBottom: 6,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 19,
  },
  card: {
    alignItems: 'center',
    gap: 10,
    padding: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  qrBox: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
  },
  qrName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  qrCode: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  downloadButtonText: {
    color: colors.accent,
    fontSize: 12.5,
    fontWeight: '700',
  },
  downloadButtonTextSmall: {
    color: colors.accent,
    fontSize: 10.5,
    fontWeight: '700',
  },
  assignBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  assignBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  assignBannerText: {
    flex: 1,
    gap: 2,
  },
  assignBannerTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  assignBannerSub: {
    color: colors.muted,
    fontSize: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  medGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  medCard: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrBoxSmall: {
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
  },
  medName: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  qrCodeSmall: {
    color: colors.muted,
    fontSize: 10.5,
    fontFamily: 'monospace',
  },
  doneButton: {
    marginTop: 10,
  },
})
