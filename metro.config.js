// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')
const http = require('http')
const os = require('os')

const config = getDefaultConfig(__dirname)

// พร็อกซี่ /api/* ไปที่ backend Laravel ผ่าน dev server ตัวเดียวกัน ทำให้ frontend
// เรียก API แบบ path สัมพัทธ์ได้เสมอ ไม่ว่าจะเปิดผ่าน localhost, LAN IP, หรือ tunnel URL
//
// ทำไมไม่ใช้ 127.0.0.1 ตรงๆ: start-backend.ps1 bind PHP เข้ากับ IP วง LAN ของ
// เครื่องนี้โดยตรง (ไม่ใช่ 0.0.0.0) เพื่อแก้ปัญหามือถือต่อจากภายนอกไม่ได้ - ผลคือ
// backend ไม่ listen ที่ loopback อีกต่อไป ถ้า hardcode 127.0.0.1 ไว้ที่นี่ พอ IP
// เครื่องเปลี่ยน (เช่น DHCP เปลี่ยนให้ หรือย้าย WiFi) proxy ตัวนี้จะยิงไม่ถึงเลย
// (เจอเป็น ECONNREFUSED 127.0.0.1:8000 ตอนใช้ npm run web) เลยตรวจจับ IP สดใหม่
// ทุกครั้งที่ Metro start แทน เหมือนที่ start-backend.ps1 ทำฝั่ง backend
function detectLanIp() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    if (/loopback|vethernet|wsl|vpn|virtualbox|vmware/i.test(name)) continue
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}

const BACKEND_HOST = detectLanIp()
const BACKEND_PORT = 8000

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith('/api')) {
        const proxyReq = http.request(
          {
            host: BACKEND_HOST,
            port: BACKEND_PORT,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers)
            proxyRes.pipe(res, { end: true })
          }
        )

        proxyReq.on('error', (err) => {
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ detail: `เชื่อมต่อ backend ไม่ได้: ${err.message}` }))
        })

        req.pipe(proxyReq, { end: true })
        return
      }

      return metroMiddleware(req, res, next)
    }
  },
}

module.exports = config
