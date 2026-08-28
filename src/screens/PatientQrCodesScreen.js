import { useRef } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import QRCode from 'react-native-qrcode-svg'
import { Ionicons } from '@expo/vector-icons'
import Button from '../components/Button'
import { downloadQrCode } from '../utils/downloadQrCode'
import { MEALS, MEAL_LABELS } from '../constants/meals'
import { colors, gradients, radius } from '../constants/theme'

// One QR per meal cassette now (not per drug) - `cassettes` is the shape
// GET /patients/{id}/meal-cassettes returns: [{ cassette_id, meal, qr_code,
// medications: [...] }]. A cassette's QR is permanent, so this screen is
// purely a "here's what to print" view, not a one-time generation step -
// re-opening it later for the same patient shows the exact same QR codes.
export default function PatientQrCodesScreen({ patient, cassettes, onDone, onAssignToSlot, onOpenCassette, onCreateMeal }) {
  const patientQrRef = useRef(null)
  const cassetteQrRefs = useRef({})
  // A patient rarely starts with all 5 meals in use - lets a nurse add the
  // ones missing (e.g. only breakfast/dinner so far) right from this screen,
  // instead of having to go find that meal from the medicine catalog flow.
  const missingMeals = MEALS.filter((meal) => !cassettes.some((c) => c.meal === meal))

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {/* Gradient promoted from flat accent - this is the page's one hero
            identity mark (same role as the login icon / dashboard avatar),
            so it gets the same brand treatment for consistency. */}
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconMark}>
          <Ionicons name="qr-code" size={22} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.title}>รหัส QR สำหรับ {patient.full_name}</Text>
        <Text style={styles.subtitle}>
          ถ่ายภาพหน้าจอนี้หรือพิมพ์ออกไปติดที่ป้ายข้อมือผู้ป่วยและตลับยาแต่ละมื้อ — QR ตลับล็อกถาวร ไม่ต้องพิมพ์ใหม่แม้จะเพิ่ม/ลดยาข้างในทีหลัง
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

      {cassettes.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>ตลับยา ({cassettes.length} มื้อ)</Text>
          <View style={styles.medGrid}>
            {cassettes.map((cassette) => (
              <TouchableOpacity
                key={cassette.cassette_id}
                style={styles.medCard}
                onPress={() => onOpenCassette?.(cassette)}
                activeOpacity={onOpenCassette ? 0.7 : 1}
                disabled={!onOpenCassette}
              >
                <View style={styles.qrBoxSmall}>
                  <QRCode
                    value={cassette.qr_code}
                    size={110}
                    getRef={(ref) => (cassetteQrRefs.current[cassette.cassette_id] = ref)}
                  />
                </View>
                <Text style={styles.mealLabel}>มื้อ{MEAL_LABELS[cassette.meal]}</Text>
                <Text style={styles.medNames} numberOfLines={3}>
                  {cassette.medications.map((m) => m.drug_name).join(', ')}
                </Text>
                <Text style={styles.qrCodeSmall}>{cassette.qr_code}</Text>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() =>
                    downloadQrCode(
                      { current: cassetteQrRefs.current[cassette.cassette_id] },
                      `${cassette.qr_code}.png`
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons name="download-outline" size={12} color={colors.accent} />
                  <Text style={styles.downloadButtonTextSmall}>ดาวน์โหลด</Text>
                </TouchableOpacity>
                {!!onOpenCassette && (
                  <View style={styles.openHint}>
                    <Ionicons name="create-outline" size={11} color={colors.muted} />
                    <Text style={styles.openHintText}>แตะเพื่อดู/แก้ไข</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {!!onCreateMeal && missingMeals.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>เพิ่มมื้อใหม่</Text>
          <View style={styles.missingMealRow}>
            {missingMeals.map((meal) => (
              <TouchableOpacity
                key={meal}
                style={styles.missingMealPill}
                onPress={() => onCreateMeal(meal)}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={15} color={colors.accent} />
                <Text style={styles.missingMealPillText}>มื้อ{MEAL_LABELS[meal]}</Text>
              </TouchableOpacity>
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
  missingMealRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  missingMealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    backgroundColor: colors.accentSoft,
  },
  missingMealPillText: {
    color: colors.accent,
    fontSize: 13.5,
    fontWeight: '700',
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
  mealLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  medNames: {
    color: colors.ink,
    fontSize: 12,
    textAlign: 'center',
  },
  qrCodeSmall: {
    color: colors.muted,
    fontSize: 10.5,
    fontFamily: 'monospace',
  },
  openHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  openHintText: {
    color: colors.muted,
    fontSize: 10,
  },
  doneButton: {
    marginTop: 10,
  },
})
