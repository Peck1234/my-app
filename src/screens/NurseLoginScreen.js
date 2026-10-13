import { useState } from 'react'
import { Image, Keyboard, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import PasswordLoginForm from '../components/PasswordLoginForm'
import RegisterForm from '../components/RegisterForm'
import FadeInView from '../components/FadeInView'
import ResponsiveContainer from '../components/ResponsiveContainer'
import PatientDashboardScreen, { DESKTOP_WEB_MIN_WIDTH } from './PatientDashboardScreen'
import ForgotPasswordScreen from './ForgotPasswordScreen'
import ResetPasswordScreen from './ResetPasswordScreen'
import { appConfig } from '../config/appConfig'
import { useNurseLogin } from '../hook/useNurseLogin'
import { th } from '../i18n/th'
import { colors, radius, shadow, spacing } from '../constants/theme'

export default function NurseLoginScreen() {
  const { error, handlePasswordLogin, handleRegister, loading, resetLogin, session, updateSession } =
    useNurseLogin()
  const copy = th.nurseLogin
  const [mode, setMode] = useState('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetNotice, setResetNotice] = useState(null)
  const { width } = useWindowDimensions()
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_WEB_MIN_WIDTH

  if (session) {
    // Desktop web builds its own full-width sidebar shell inside
    // PatientDashboardScreen - ResponsiveContainer's mobile-app-width cap
    // would just fight it, so skip that wrapper there.
    const dashboard = (
      <FadeInView key="dashboard">
        <PatientDashboardScreen nurse={session} onLogout={resetLogin} onProfileUpdated={updateSession} />
      </FadeInView>
    )

    return (
      <SafeAreaView style={styles.shell}>
        <StatusBar style="dark" />
        {isDesktopWeb ? dashboard : <ResponsiveContainer>{dashboard}</ResponsiveContainer>}
      </SafeAreaView>
    )
  }

  if (mode === 'forgot') {
    return (
      <SafeAreaView style={styles.shell}>
        <StatusBar style="dark" />
        <ResponsiveContainer style={styles.content}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <FadeInView key="forgot">
            <ForgotPasswordScreen
              onBack={() => setMode('login')}
              onCodeSent={(email) => {
                setResetEmail(email)
                setMode('reset')
              }}
            />
          </FadeInView>
          </ScrollView>
        </ResponsiveContainer>
      </SafeAreaView>
    )
  }

  if (mode === 'reset') {
    return (
      <SafeAreaView style={styles.shell}>
        <StatusBar style="dark" />
        <ResponsiveContainer style={styles.content}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <FadeInView key="reset">
            <ResetPasswordScreen
              email={resetEmail}
              onBack={() => setMode('login')}
              onSuccess={(message) => {
                setResetNotice(message)
                setMode('login')
              }}
            />
          </FadeInView>
          </ScrollView>
        </ResponsiveContainer>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="dark" />

      {/* Tapping anywhere outside a text input (but not on the inputs/buttons
          themselves, which handle their own touches first) dismisses the
          keyboard - standard "tap outside to close keyboard" behavior.
          Pressable (not TouchableWithoutFeedback) on purpose: TWF injects its
          responder handlers into its direct child via cloneElement, but
          ResponsiveContainer only reads `children`/`style` and drops any
          other props, so those handlers never reached a real View and taps
          silently did nothing. Pressable owns its own View instead, so this
          works regardless of what's nested inside it.

          Web-only bug this caused: react-native-web's Keyboard.dismiss()
          shims "hide the keyboard" as "blur the focused element" (there's no
          real on-screen keyboard to hide on web), and unlike native, a web
          click on a nested TextInput still bubbles up to this Pressable's
          onClick - so focusing a field fired this handler right after,
          immediately blurring the field you just clicked into. There's no
          keyboard to dismiss on web anyway, so just skip wiring this there. */}
      <Pressable style={styles.pressableFill} onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
        <ResponsiveContainer style={styles.content}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <FadeInView key={mode}>
            <View style={styles.header}>
              <Image source={require('../../assets/icon.png')} style={styles.iconMark} resizeMode="cover" />
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

            {!!resetNotice && mode === 'login' && (
              <View style={styles.resetNoticeBox}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.resetNoticeText}>{resetNotice}</Text>
              </View>
            )}

            {mode === 'login' ? (
              <PasswordLoginForm
                error={error}
                loading={loading}
                onSubmit={handlePasswordLogin}
                onForgotPassword={() => {
                  resetLogin()
                  setResetNotice(null)
                  setMode('forgot')
                }}
              />
            ) : (
              <RegisterForm error={error} loading={loading} onSubmit={handleRegister} />
            )}

            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => {
                resetLogin()
                setResetNotice(null)
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
          </ScrollView>
        </ResponsiveContainer>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pressableFill: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  // Core RN SafeAreaView is an iOS-only no-op on Android, so it never
  // reserves space for the on-screen nav bar there - content (like the
  // switchModeButton below) can render underneath and become untappable.
  // A fixed bottom pad plus making this screen scrollable are a cheap fix
  // that doesn't need react-native-safe-area-context and a native rebuild.
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 48,
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
  resetNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successBg,
    marginBottom: spacing.lg,
  },
  resetNoticeText: {
    flex: 1,
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
})
