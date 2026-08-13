const fs = require('fs')
const path = require('path')
const appJson = require('./app.json')

// เขียนโดย start-backend.ps1 ทุกครั้งที่เปิด Cloudflare tunnel ใหม่ (URL เปลี่ยนทุกรอบที่รัน)
// อ่านตรงนี้เพื่อฝังเข้า Constants.expoConfig.extra ให้ src/api.js ใช้ต่อได้
function readBackendTunnelUrl() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.backend-tunnel-url'), 'utf8').trim()
    return raw || null
  } catch {
    return null
  }
}

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...(appJson.expo.extra || {}),
    backendTunnelUrl: readBackendTunnelUrl(),
  },
})
