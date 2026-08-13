import { ActivityIndicator, SafeAreaView, StyleSheet, Text } from 'react-native'
import { useCameraPermissions } from 'expo-camera'
import Button from './Button'
import { colors } from '../constants/theme'
import { th } from '../i18n/th'

export default function CameraPermissionGate({ children }) {
  const [permission, requestPermission] = useCameraPermissions()
  const copy = th.nurseLogin

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    )
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permissionText}>{copy.permissionMessage}</Text>
        <Button label={copy.permissionButton} onPress={requestPermission} fullWidth={false} />
      </SafeAreaView>
    )
  }

  return children
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: colors.bg,
  },
  permissionText: {
    color: colors.ink,
    fontSize: 15,
    textAlign: 'center',
  },
})
