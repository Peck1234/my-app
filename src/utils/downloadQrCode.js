import { Alert, Platform } from 'react-native'

export function downloadQrCode(qrRef, filename) {
  if (!qrRef?.current) return

  qrRef.current.toDataURL((base64Data) => {
    if (Platform.OS === 'web') {
      downloadOnWeb(base64Data, filename)
    } else {
      downloadOnNative(base64Data, filename)
    }
  })
}

function downloadOnWeb(base64Data, filename) {
  const link = document.createElement('a')
  link.href = `data:image/png;base64,${base64Data}`
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

async function downloadOnNative(base64Data, filename) {
  try {
    const FileSystem = await import('expo-file-system/legacy')
    const MediaLibrary = await import('expo-media-library')

    const fileUri = `${FileSystem.cacheDirectory}${filename}`
    await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: 'base64' })

    const { status } = await MediaLibrary.requestPermissionsAsync(true)
    if (status !== 'granted') {
      Alert.alert('บันทึกรูปไม่สำเร็จ', 'กรุณาอนุญาตให้แอปเข้าถึงคลังภาพในตั้งค่าเครื่อง แล้วลองอีกครั้ง')
      return
    }

    await MediaLibrary.saveToLibraryAsync(fileUri)
    Alert.alert('บันทึกรูปสำเร็จ', 'บันทึกรหัส QR ลงในคลังภาพของเครื่องแล้ว')
  } catch (err) {
    console.error('downloadQrCode failed:', err)
    Alert.alert('บันทึกรูปไม่สำเร็จ', `เกิดข้อผิดพลาดขณะบันทึกรูป: ${err?.message || 'ไม่ทราบสาเหตุ'}`)
  }
}
