import { Platform } from 'react-native'

// Path on the web app's own domain that Netlify proxies to the backend with
// the `ngrok-skip-browser-warning` header added (see netlify.toml). Needed
// because a plain <img> can't send that header, so a free ngrok backend
// answers browsers with its HTML warning page instead of the image.
const WEB_MEDIA_PROXY_PREFIX = '/backend-media'

function backendHost() {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL
  if (!base) return null
  try {
    return new URL(base).host
  } catch {
    return null
  }
}

// Turns a backend file URL (e.g. a nurse's profile photo) into one the
// current platform can actually display. Native apps load it as-is.
export function displayImageUri(uri) {
  if (!uri || Platform.OS !== 'web') return uri
  const host = backendHost()
  if (!host) return uri
  try {
    const url = new URL(uri)
    if (url.host !== host) return uri
    return `${WEB_MEDIA_PROXY_PREFIX}${url.pathname}${url.search}`
  } catch {
    return uri
  }
}
