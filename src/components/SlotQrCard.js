import { useRef, useState } from 'react'
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { Ionicons } from '@expo/vector-icons'
import { downloadQrCode } from '../utils/downloadQrCode'
import { colors, radius } from '../constants/theme'

function buildLabelHtml(slotCode, dataUrl) {
  return `
  <html>
  <head><meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .label { text-align: center; border: 1.5px dashed #D0D5DD; border-radius: 12px; padding: 24px 32px; }
    img { width: 220px; height: 220px; image-rendering: pixelated; }
    .code { font-family: ui-monospace, Consolas, monospace; font-size: 16px; font-weight: 700; margin-top: 10px; }
  </style>
  </head>
  <body>
    <div class="label">
      <img src="data:image/png;base64,${dataUrl}" />
      <div class="code">${slotCode}</div>
    </div>
  </body>
  </html>`
}

export default function SlotQrCard({ slotCode, slotNo }) {
  const qrRef = useRef(null)
  const [printing, setPrinting] = useState(false)

  const handlePrint = () => {
    if (!qrRef.current) return
    setPrinting(true)
    qrRef.current.toDataURL(async (dataUrl) => {
      try {
        const html = buildLabelHtml(slotCode, dataUrl)
        if (Platform.OS === 'web') {
          await Print.printAsync({ html })
        } else {
          const { uri } = await Print.printToFileAsync({ html })
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })
          }
        }
      } finally {
        setPrinting(false)
      }
    })
  }

  return (
    <View style={styles.card}>
      <View style={styles.qrBox}>
        <QRCode value={slotCode} size={180} getRef={(ref) => (qrRef.current = ref)} />
      </View>
      <Text style={styles.qrCode}>{slotCode}</Text>
      {!!slotNo && <Text style={styles.qrSub}>ตำแหน่ง {slotNo}</Text>}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => downloadQrCode(qrRef, `slot-${slotCode}.png`)}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={14} color={colors.accent} />
          <Text style={styles.actionButtonText}>ดาวน์โหลด</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handlePrint} disabled={printing} activeOpacity={0.7}>
          <Ionicons name="print-outline" size={14} color={colors.accent} />
          <Text style={styles.actionButtonText}>{printing ? 'กำลังเตรียม...' : 'พิมพ์'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 8, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  qrBox: { padding: 14, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  qrCode: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 4, fontFamily: 'monospace' },
  qrSub: { color: colors.muted, fontSize: 12.5 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accent,
  },
  actionButtonText: { color: colors.accent, fontSize: 12.5, fontWeight: '700' },
})
