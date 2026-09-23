// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')
const http = require('http')
const https = require('https')
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

// WEB_BACKEND_URL lets `npm run web` point straight at the real deployed
// backend (e.g. Railway) instead of a local `php artisan serve` - handy for
// one-off admin data entry through the web UI against production data
// without needing a local PHP server or a phone. Unset by default so normal
// local dev behavior (proxy to this machine's own backend on port 8000)
// doesn't change.
const WEB_BACKEND_URL = process.env.WEB_BACKEND_URL ? new URL(process.env.WEB_BACKEND_URL) : null

const BACKEND_PROTOCOL = WEB_BACKEND_URL ? WEB_BACKEND_URL.protocol : 'http:'
const BACKEND_HOST = WEB_BACKEND_URL ? WEB_BACKEND_URL.hostname : detectLanIp()
const BACKEND_PORT = WEB_BACKEND_URL
  ? WEB_BACKEND_URL.port || (BACKEND_PROTOCOL === 'https:' ? 443 : 80)
  : 8000

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith('/api')) {
        const client = BACKEND_PROTOCOL === 'https:' ? https : http
        const proxyReq = client.request(
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
