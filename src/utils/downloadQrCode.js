import { Platform } from 'react-native'

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
  const { File, Paths } = await import('expo-file-system')
  const Sharing = await import('expo-sharing')

  const file = new File(Paths.cache, filename)
  if (file.exists) {
    file.delete()
  }
  file.create()
  file.write(base64Data, { encoding: 'base64' })

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'image/png' })
  }
}
