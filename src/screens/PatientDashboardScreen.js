import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import FadeInView from '../components/FadeInView'
import DispenseSummaryCard from '../components/DispenseSummaryCard'
import DueMedicationAlert from '../components/DueMedicationAlert'
import PatientListScreen from './PatientListScreen'
import PatientMedicationScreen from './PatientMedicationScreen'
import MissedMedicationsScreen from './MissedMedicationsScreen'
import StatsDashboardScreen from './StatsDashboardScreen'
import DispenseLogScreen from './DispenseLogScreen'
import SlotManagementScreen from './SlotManagementScreen'
import { useMedicationReminders } from '../hook/useMedicationReminders'
import { colors, gradients, radius, shadow, spacing } from '../constants/theme'

const TAB_EYEBROWS = {
  patients: 'รายชื่อผู้ป่วย',
  missed: 'ยาที่ค้างจ่าย',
  slots: 'จัดการช่องยา',
  stats: 'สถิติการจ่ายยา',
  logs: 'ประวัติการจ่ายยา',
}

const TAB_ICONS = {
  patients: 'people',
  missed: 'alert-circle',
  slots: 'grid',
  stats: 'bar-chart',
}

export default function PatientDashboardScreen({ nurse, onLogout }) {
  const { dueCount, alertItems, dismissAlert } = useMedicationReminders()

  const [selectedPatient, setSelectedPatient] = useState(null)
  const [activeTab, setActiveTab] = useState('patients')
  const [patientSubScreenActive, setPatientSubScreenActive] = useState(false)
  const [slotSubScreenActive, setSlotSubScreenActive] = useState(false)
  const [pendingAssignPatient, setPendingAssignPatient] = useState(null)
  const initial = nurse.full_name?.trim()?.charAt(0) || 'N'

  const goAssignNewPatientToSlot = (patient) => {
    setPendingAssignPatient(patient)
    setSelectedPatient(null)
    setActiveTab('slots')
  }

  const showHeader =
    !selectedPatient &&
    activeTab !== 'stats' &&
    activeTab !== 'logs' &&
    !(activeTab === 'patients' && patientSubScreenActive) &&
    !(activeTab === 'slots' && slotSubScreenActive)

  return (
    <View style={styles.shell}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.identity}>
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
              <View>
                <Text style={styles.eyebrow}>{TAB_EYEBROWS[activeTab]}</Text>
                <Text style={styles.nurseName}>พยาบาล {nurse.full_name}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={onLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={14} color={colors.danger} />
              <Text style={styles.logoutButtonText}>ออกจากระบบ</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            {[
              { key: 'patients', label: 'รายชื่อผู้ป่วย' },
              { key: 'missed', label: 'ยาที่ค้างจ่าย', badge: dueCount },
              { key: 'slots', label: 'จัดการช่องยา' },
            ].map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={styles.tab}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                >
                  {isActive && (
                    <LinearGradient
                      colors={gradients.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  )}
                  <View style={styles.tabContent}>
                    <Ionicons
                      name={TAB_ICONS[tab.key]}
                      size={14}
                      color={isActive ? '#FFFFFF' : colors.muted}
                    />
                    <Text
                      style={[styles.tabText, isActive && styles.tabTextActive]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Text>
                    {!!tab.badge && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      )}

      <FadeInView key={selectedPatient ? `patient-${selectedPatient.patient_id}` : activeTab}>
        {selectedPatient ? (
          <PatientMedicationScreen
            nurse={nurse}
            patient={selectedPatient}
            onBack={() => setSelectedPatient(null)}
          />
        ) : activeTab === 'missed' ? (
          <MissedMedicationsScreen onSelectPatient={setSelectedPatient} />
        ) : activeTab === 'slots' ? (
          <SlotManagementScreen
            nurse={nurse}
            onSubScreenChange={setSlotSubScreenActive}
            presetAssignPatient={pendingAssignPatient}
            onConsumedPresetAssign={() => setPendingAssignPatient(null)}
          />
        ) : activeTab === 'stats' ? (
          <StatsDashboardScreen
            onBack={() => setActiveTab('patients')}
            onViewLogs={() => setActiveTab('logs')}
          />
        ) : activeTab === 'logs' ? (
          <DispenseLogScreen onBack={() => setActiveTab('stats')} />
        ) : (
          <PatientListScreen
            onSelectPatient={setSelectedPatient}
            onSubScreenChange={setPatientSubScreenActive}
            onAssignNewPatient={goAssignNewPatientToSlot}
          />
        )}
      </FadeInView>

      {!selectedPatient && activeTab === 'patients' && !patientSubScreenActive && (
        <DispenseSummaryCard onPress={() => setActiveTab('stats')} />
      )}

      <DueMedicationAlert
        items={alertItems}
        onViewMissed={() => {
          dismissAlert()
          setSelectedPatient(null)
          setActiveTab('missed')
        }}
        onDismiss={dismissAlert}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  // Dropped the hard bottom border that used to be the only thing separating
  // header from content — on the old flat-white background a divider line
  // was doing all the work; on the warm canvas, the tab bar below is now a
  // white floating card in its own right (see `tabRow`), which already reads
  // as a distinct region without needing a ruled line under it too.
  header: {
    marginBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: 'transparent',
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  // Was a bare outlined track (bg == page bg) with the active tab as the only
  // thing carrying any weight. Now the whole track is its own elevated white
  // card sitting on the warm page — the segmented control reads as one
  // physical object you're pressing on, not text floating over a hairline box.
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  tabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    ...shadow.card,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  nurseName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
})
