// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')
const http = require('http')

const config = getDefaultConfig(__dirname)

// พร็อกซี่ /api/* ไปที่ backend Laravel (127.0.0.1:8000) ผ่าน dev server ตัวเดียวกัน
// ทำให้ frontend เรียก API แบบ path สัมพัทธ์ได้เสมอ ไม่ว่าจะเปิดผ่าน localhost, LAN IP, หรือ tunnel URL
const BACKEND_HOST = '127.0.0.1'
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
