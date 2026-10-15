import { useState } from 'react'
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import FadeInView from '../components/FadeInView'
import DispenseSummaryCard from '../components/DispenseSummaryCard'
import DueMedicationAlert from '../components/DueMedicationAlert'
import BackgroundReminderPrompt from '../components/BackgroundReminderPrompt'
import PatientListScreen from './PatientListScreen'
import PatientMedicationScreen from './PatientMedicationScreen'
import MissedMedicationsScreen from './MissedMedicationsScreen'
import StatsDashboardScreen from './StatsDashboardScreen'
import DispenseLogScreen from './DispenseLogScreen'
import SlotManagementScreen from './SlotManagementScreen'
import MedicineDatabaseScreen from './MedicineDatabaseScreen'
import AccountSettingsScreen from './AccountSettingsScreen'
import { useMedicationReminders } from '../hook/useMedicationReminders'
import { useAndroidBack } from '../hook/useAndroidBack'
import { displayImageUri } from '../utils/mediaUrl'
import { colors, gradients, radius, shadow, spacing } from '../constants/theme'

const TAB_EYEBROWS = {
  patients: 'รายชื่อผู้ป่วย',
  missed: 'ยาที่ค้างจ่าย',
  slots: 'จัดการช่องยา',
  medicines: 'คลังยากลาง',
  stats: 'สถิติการจ่ายยา',
  logs: 'ประวัติการจ่ายยา',
}

const TAB_ICONS = {
  patients: 'people',
  missed: 'alert-circle',
  slots: 'grid',
  medicines: 'medkit',
  stats: 'bar-chart',
}

// Web-only sidebar nav - surfaces all 6 sections directly (mobile reaches
// stats/logs indirectly, via the DispenseSummaryCard and a "ดูประวัติ" link
// inside StatsDashboardScreen, since there's no room for a 6-item tab row on
// a phone). A desktop sidebar has the vertical space for a flat list, so
// there's no reason to make those two sections a click deeper than the rest.
const NAV_ITEMS = [
  { key: 'patients', label: 'รายชื่อผู้ป่วย', icon: 'people' },
  { key: 'missed', label: 'ยาที่ค้างจ่าย', icon: 'alert-circle' },
  { key: 'slots', label: 'จัดการช่องยา', icon: 'grid' },
  { key: 'medicines', label: 'คลังยา', icon: 'medkit' },
  { key: 'stats', label: 'สถิติการจ่ายยา', icon: 'bar-chart' },
  { key: 'logs', label: 'ประวัติการจ่ายยา', icon: 'time' },
]

// Below this width (phones, including the home-screen web app on iPhone) the
// web build uses the same header + tab layout as the native app instead of
// the desktop sidebar.
export const DESKTOP_WEB_MIN_WIDTH = 900

export default function PatientDashboardScreen({ nurse, onLogout, onProfileUpdated }) {
  const { dueCount, alertItems, dismissAlert } = useMedicationReminders()
  const { width } = useWindowDimensions()
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_WEB_MIN_WIDTH

  const [selectedPatient, setSelectedPatient] = useState(null)
  const [activeTab, setActiveTab] = useState('patients')
  const [patientSubScreenActive, setPatientSubScreenActive] = useState(false)
  const [slotSubScreenActive, setSlotSubScreenActive] = useState(false)
  const [medicineSubScreenActive, setMedicineSubScreenActive] = useState(false)
  const [pendingAssignPatient, setPendingAssignPatient] = useState(null)
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const initial = nurse.full_name?.trim()?.charAt(0) || 'N'

  // Top level of the Android back button: screens below handle their own
  // inner steps first; here back closes settings/the open patient, then
  // returns to the patients tab, and from there leaves the app.
  useAndroidBack(() => {
    if (showAccountSettings) setShowAccountSettings(false)
    else if (selectedPatient) setSelectedPatient(null)
    else if (activeTab === 'logs') setActiveTab('stats')
    else if (activeTab !== 'patients') setActiveTab('patients')
    else return false
    return true
  })

  const goAssignNewPatientToSlot = (patient) => {
    setPendingAssignPatient(patient)
    setSelectedPatient(null)
    setActiveTab('slots')
  }

  const dueMedicationAlert = (
    <DueMedicationAlert
      items={alertItems}
      onViewMissed={() => {
        dismissAlert()
        setSelectedPatient(null)
        setActiveTab('missed')
      }}
      onDismiss={dismissAlert}
    />
  )

  const mainContent = showAccountSettings ? (
    <AccountSettingsScreen
      nurse={nurse}
      onBack={() => setShowAccountSettings(false)}
      onProfileUpdated={onProfileUpdated}
    />
  ) : (
    <>
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
        ) : activeTab === 'medicines' ? (
          <MedicineDatabaseScreen nurse={nurse} onSubScreenChange={setMedicineSubScreenActive} />
        ) : activeTab === 'stats' ? (
          <StatsDashboardScreen
            onBack={() => setActiveTab('patients')}
            onViewLogs={() => setActiveTab('logs')}
          />
        ) : activeTab === 'logs' ? (
          <DispenseLogScreen onBack={() => setActiveTab('stats')} />
        ) : (
          <PatientListScreen
            nurse={nurse}
            onSelectPatient={setSelectedPatient}
            onSubScreenChange={setPatientSubScreenActive}
            onAssignNewPatient={goAssignNewPatientToSlot}
          />
        )}
      </FadeInView>

      {!selectedPatient && activeTab === 'patients' && !patientSubScreenActive && (
        <DispenseSummaryCard onPress={() => setActiveTab('stats')} />
      )}
    </>
  )

  // Desktop web gets a persistent sidebar instead of the mobile top
  // header/tab-row - there's no reason a 6-section nav needs to be a click
  // deeper on a screen with vertical space to spare, and unlike the mobile
  // header (which has to duck out of the way for headerless sub-screens to
  // get room), a sidebar can just stay put regardless of what's showing.
  if (isDesktopWeb) {
    return (
      <View style={styles.webShell}>
        <ScrollView style={styles.sidebar} contentContainerStyle={styles.sidebarContent}>
          <View style={styles.sidebarIdentity}>
            {nurse.profile_photo_url ? (
              <Image source={{ uri: displayImageUri(nurse.profile_photo_url) }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
            )}
            <View style={styles.identityText}>
              <Text style={styles.sidebarNurseName} numberOfLines={1} ellipsizeMode="tail">
                พยาบาล {nurse.full_name}
              </Text>
              <TouchableOpacity onPress={() => setShowAccountSettings(true)} activeOpacity={0.7}>
                <Text style={styles.sidebarAccountLink}>ตั้งค่าบัญชี</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sidebarNav}>
            {NAV_ITEMS.map((item) => {
              const isActive = !showAccountSettings && !selectedPatient && activeTab === item.key
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => {
                    setShowAccountSettings(false)
                    setSelectedPatient(null)
                    setActiveTab(item.key)
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={isActive ? '#FFFFFF' : colors.muted}
                  />
                  <Text style={[styles.navItemText, isActive && styles.navItemTextActive]}>
                    {item.label}
                  </Text>
                  {item.key === 'missed' && !!dueCount && (
                    <View style={styles.navBadge}>
                      <Text style={styles.tabBadgeText}>{dueCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity style={styles.sidebarLogout} onPress={onLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={16} color={colors.danger} />
            <Text style={styles.logoutButtonText}>ออกจากระบบ</Text>
          </TouchableOpacity>
        </ScrollView>

        <ScrollView style={styles.webMain} contentContainerStyle={styles.webMainContent}>
          <View style={styles.webMainInner}>{mainContent}</View>
        </ScrollView>

        {dueMedicationAlert}
        <BackgroundReminderPrompt />
      </View>
    )
  }

  const showHeader =
    !selectedPatient &&
    activeTab !== 'stats' &&
    activeTab !== 'logs' &&
    !(activeTab === 'patients' && patientSubScreenActive) &&
    !(activeTab === 'slots' && slotSubScreenActive) &&
    !(activeTab === 'medicines' && medicineSubScreenActive)

  if (showAccountSettings) {
    return <View style={styles.shell}>{mainContent}</View>
  }

  return (
    <View style={styles.shell}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.identity}>
              {nurse.profile_photo_url ? (
                <Image source={{ uri: displayImageUri(nurse.profile_photo_url) }} style={styles.avatar} />
              ) : (
                <LinearGradient
                  colors={gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>{initial}</Text>
                </LinearGradient>
              )}
              <View style={styles.identityText}>
                <Text style={styles.eyebrow} numberOfLines={1}>{TAB_EYEBROWS[activeTab]}</Text>
                <Text style={styles.nurseName} numberOfLines={1} ellipsizeMode="tail">
                  พยาบาล {nurse.full_name}
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.accountButton}
                onPress={() => setShowAccountSettings(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Ionicons name="settings-outline" size={16} color={colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={onLogout}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={14} color={colors.danger} />
                <Text style={styles.logoutButtonText}>ออกจากระบบ</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tabRow}>
            {[
              { key: 'patients', label: 'รายชื่อผู้ป่วย' },
              { key: 'missed', label: 'ยาที่ค้างจ่าย', badge: dueCount },
              { key: 'slots', label: 'จัดการช่องยา' },
              { key: 'medicines', label: 'คลังยา' },
            ].map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={styles.tab}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                >
                  {/* Flat indigo fill instead of a gradient wash - this is a
                      state indicator someone scans across three tabs quickly,
                      not a brand moment, so instant recognizability beats a
                      decorative gradient here. */}
                  {isActive && <View style={[StyleSheet.absoluteFillObject, styles.tabActiveFill]} />}
                  <View style={styles.tabContent}>
                    <Ionicons
                      name={TAB_ICONS[tab.key]}
                      size={17}
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

      {mainContent}

      {dueMedicationAlert}

      <BackgroundReminderPrompt />
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    // Core RN SafeAreaView doesn't reserve space for Android's status bar
    // or on-screen nav bar (iOS-only no-op there), so the header used to
    // render under the clock/battery icons at the top, and the
    // DispenseSummaryCard rendered under the nav bar at the bottom.
    paddingTop: 28,
    paddingBottom: 32,
  },
  // Dropped the hard bottom border that used to be the only thing separating
  // header from content — the tab bar below is its own floating white card
  // (see `tabRow`), which already reads as a distinct region without needing
  // a ruled line under it too.
  header: {
    marginBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  accountButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
  // card — the segmented control reads as one physical object you're
  // pressing on, not text floating over a hairline box.
  //
  // 2x2 grid instead of one cramped row of 4: `flexWrap: 'wrap'` + each tab
  // pinned to ~48% width forces exactly two per row regardless of container
  // width, so "รายชื่อผู้ป่วย" (the longest label) finally gets room to
  // breathe on both mobile and the wider web layout (ResponsiveContainer
  // caps width but doesn't change the column count here - 2x2 stays 2x2).
  // Swapped the outer card and each cell from a full pill (radius.pill) to
  // radius.lg - a stadium shape reads right for a single-row segmented
  // control, but looks stretched/odd once the block is two rows tall.
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  tabActiveFill: {
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  // width: '48%' (not flex: 1) is what actually produces 2-per-row once the
  // container wraps - flex:1 would just stretch each item to fill whatever
  // room is left on its own row instead of matching its sibling above/below it.
  tab: {
    width: '48%',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  tabText: {
    color: colors.muted,
    fontSize: 14.5,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  // flexShrink + minWidth: 0 let this block give up width to headerActions
  // (settings/logout) instead of pushing it past the screen edge - RN's
  // flex default (flexShrink: 0, no minWidth cap) is why a long nurse name
  // used to force the logout button off-screen on narrow phones.
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    flexShrink: 1,
    minWidth: 0,
  },
  identityText: {
    flexShrink: 1,
    minWidth: 0,
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

  // --- Web-only desktop sidebar shell ---
  webShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bg,
    // Fixed (not min) height - this pins the shell to the browser window so
    // the sidebar and main pane below can each scroll independently inside
    // it. With minHeight the shell itself grew past the viewport instead,
    // and nothing in the tree had an actual scrollbar to catch the overflow
    // - the page (and every screen inside it) was just clipped at 100vh with
    // no way to reach content or the logout button below the fold.
    height: '100vh',
  },
  sidebar: {
    width: 260,
    // ScrollView defaults to flexGrow: 1 internally (so its content can fill
    // whatever space it's given) - left as-is, that made the sidebar grow
    // past its 260px width to soak up the row's leftover space alongside
    // webMain's own flex: 1. Pinning both flexGrow and flexShrink to 0 keeps
    // width: 260 as a hard size instead of just a starting point.
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  sidebarContent: {
    flexGrow: 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  sidebarIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sidebarNurseName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  sidebarAccountLink: {
    color: colors.accent,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 3,
  },
  sidebarNav: {
    gap: spacing.xs + 2,
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  navItemActive: {
    backgroundColor: colors.accent,
  },
  navItemText: {
    color: colors.muted,
    fontSize: 14.5,
    fontWeight: '700',
    flex: 1,
  },
  navItemTextActive: {
    color: '#FFFFFF',
  },
  navBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  webMain: {
    flex: 1,
  },
  webMainContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  // Capped, not full-bleed - forms and detail views (single-column by
  // design) would stretch into awkwardly long input rows on a wide monitor
  // otherwise. 1100px reads as a real desktop app pane without turning every
  // screen into a redesign exercise for the content living inside it.
  webMainInner: {
    width: '100%',
    maxWidth: 1100,
  },
})
