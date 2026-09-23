import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { CameraView } from 'expo-camera'
import { CAMERA_FACING, CAMERA_QR_ZOOM, QR_BARCODE_TYPES } from '../constants/camera'
import { colors, radius } from '../constants/theme'
import { th } from '../i18n/th'

export default function QrScanView({ error, loading, onBarcodeScanned }) {
  const copy = th.nurseLogin

  return (
    <View style={styles.scanStage}>
      <View style={styles.viewfinderWrap}>
        <CameraView
          style={styles.camera}
          facing={CAMERA_FACING}
          zoom={CAMERA_QR_ZOOM}
          barcodeScannerSettings={{ barcodeTypes: QR_BARCODE_TYPES }}
          onBarcodeScanned={loading ? undefined : onBarcodeScanned}
        />
        <View style={styles.frameOverlay} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      <View style={styles.statusRow}>
        {loading && <ActivityIndicator color={colors.accent} />}
        <Text style={styles.instruction}>{copy.instruction}</Text>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  scanStage: {
    alignItems: 'center',
    gap: 14,
  },
  viewfinderWrap: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: '#0B1413',
  },
  camera: {
    flex: 1,
  },
  frameOverlay: {
    position: 'absolute',
    top: '18%',
    right: '18%',
    bottom: '18%',
    left: '18%',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.accent,
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderRadius: 6,
  },
  cornerBR: {
    right: 0,
    bottom: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderRadius: 6,
  },
  statusRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  instruction: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
})
