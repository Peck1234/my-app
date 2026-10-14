import { Platform } from 'react-native'
import { displayImageUri } from './mediaUrl'

describe('displayImageUri', () => {
  const originalOS = Platform.OS
  const originalBase = process.env.EXPO_PUBLIC_API_BASE_URL
  const photo = 'https://backend.example.ngrok-free.dev/storage/profile-photos/nurse-2.jpg'

  afterEach(() => {
    Platform.OS = originalOS
    process.env.EXPO_PUBLIC_API_BASE_URL = originalBase
  })

  it('leaves URLs untouched on native', () => {
    Platform.OS = 'android'
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://backend.example.ngrok-free.dev/api'
    expect(displayImageUri(photo)).toBe(photo)
  })

  it('routes backend files through the web media proxy on web, for http or https links', () => {
    Platform.OS = 'web'
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://backend.example.ngrok-free.dev/api'
    expect(displayImageUri(photo)).toBe('/backend-media/storage/profile-photos/nurse-2.jpg')
    expect(displayImageUri(photo.replace('https:', 'http:'))).toBe('/backend-media/storage/profile-photos/nurse-2.jpg')
  })

  it('leaves other hosts, empty values and relative-API builds alone on web', () => {
    Platform.OS = 'web'
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://backend.example.ngrok-free.dev/api'
    expect(displayImageUri('https://elsewhere.example.com/a.jpg')).toBe('https://elsewhere.example.com/a.jpg')
    expect(displayImageUri(null)).toBe(null)
    process.env.EXPO_PUBLIC_API_BASE_URL = ''
    expect(displayImageUri(photo)).toBe(photo)
  })
})
