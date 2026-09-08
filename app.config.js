const fs = require('fs')
const path = require('path')
const appJson = require('./app.json')

// Local dev (`expo start`): read the file start-app-easy.ps1 writes every
// time it opens a fresh backend tunnel (URL changes every run). Works fine
// there because this config runs on the same machine as the file.
//
// EAS Build: that file is gitignored, so it never reaches EAS's remote build
// servers - this function would silently return null there and the built
// app would have no way to reach the backend at all. process.env.BACKEND_TUNNEL_URL
// covers that case instead - set in eas.json's build.<profile>.env to the
// permanent Railway backend domain, so unlike local dev's rotating tunnel
// URL this one doesn't need refreshing before each build.
function readBackendTunnelUrl() {
  if (process.env.BACKEND_TUNNEL_URL) {
    return process.env.BACKEND_TUNNEL_URL
  }
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
