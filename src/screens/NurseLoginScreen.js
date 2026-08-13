import { useState } from 'react'
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import PasswordLoginForm from '../components/PasswordLoginForm'
import RegisterForm from '../components/RegisterForm'
import FadeInView from '../components/FadeInView'
import ResponsiveContainer from '../components/ResponsiveContainer'
import PatientDashboardScreen from './PatientDashboardScreen'
import { appConfig } from '../config/appConfig'
import { useNurseLogin } from '../hook/useNurseLogin'
import { th } from '../i18n/th'
import { colors, gradients, radius, shadow, spacing } from '../constants/theme'

export default function NurseLoginScreen() {
  const { error, handlePasswordLogin, handleRegister, loading, resetLogin, session } =
    useNurseLogin()
  const copy = th.nurseLogin
  const [mode, setMode] = useState('login')

  if (session) {
    return (
      <SafeAreaView style={styles.shell}>
        <StatusBar style="dark" />
        <ResponsiveContainer>
          <FadeInView key="dashboard">
            <PatientDashboardScreen nurse={session} onLogout={resetLogin} />
          </FadeInView>
        </ResponsiveContainer>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="dark" />

      <ResponsiveContainer style={styles.content}>
        <FadeInView key={mode}>
          <View style={styles.header}>
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconMark}
            >
              <Ionicons name="medkit" size={30} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{appConfig.appName}</Text>
            </View>
            <Text style={styles.title}>
              {mode === 'login' ? copy.title : 'สมัครสมาชิกพยาบาล'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'login' ? copy.subtitle : 'สร้างบัญชีพยาบาลใหม่เพื่อเข้าใช้งานระบบ'}
            </Text>
          </View>

          {mode === 'login' ? (
            <PasswordLoginForm error={error} loading={loading} onSubmit={handlePasswordLogin} />
          ) : (
            <RegisterForm error={error} loading={loading} onSubmit={handleRegister} />
          )}

          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => {
              resetLogin()
              setMode(mode === 'login' ? 'register' : 'login')
            }}
            disabled={loading}
            activeOpacity={0.6}
          >
            <Text style={styles.switchModeText}>
              {mode === 'login' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ'}
            </Text>
          </TouchableOpacity>
        </FadeInView>
      </ResponsiveContainer>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.xxl,
    alignItems: 'flex-start',
  },
  iconMark: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadow.raised,
  },
  // Secondary violet instead of accent indigo — a deliberate, single point of
  // color hierarchy: the badge is identity/branding, the button below is the
  // action. Using two different accent hues for those two different jobs
  // makes "this is clickable" (indigo) read distinctly from "this is a label"
  // (violet) at a glance, instead of one color doing every job on the screen.
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
  },
  badgeText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    marginTop: spacing.sm,
  },
  switchModeButton: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  switchModeText: {
    color: colors.accent,
    fontSize: 13.5,
    fontWeight: '700',
  },
})
