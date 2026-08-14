import { Platform } from 'react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { downloadQrCode } from './downloadQrCode'

const mockFileInstance = {
  exists: false,
  delete: jest.fn(),
  create: jest.fn(),
  write: jest.fn(),
  uri: 'file:///mock/cache/test.png',
}

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => mockFileInstance),
  Paths: { cache: '/mock/cache' },
}))

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}))

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('downloadQrCode', () => {
  const originalPlatformOS = Platform.OS

  afterEach(() => {
    Platform.OS = originalPlatformOS
  })

  it('does nothing when the QR ref has not mounted yet', () => {
    expect(() => downloadQrCode({ current: null }, 'x.png')).not.toThrow()
    expect(() => downloadQrCode(null, 'x.png')).not.toThrow()
  })

  describe('on web', () => {
    let mockLink
    let createElementSpy
    let appendChildSpy
    let removeChildSpy

    beforeEach(() => {
      Platform.OS = 'web'
      mockLink = { href: '', download: '', click: jest.fn() }
      createElementSpy = jest.fn(() => mockLink)
      appendChildSpy = jest.fn()
      removeChildSpy = jest.fn()
      global.document = {
        createElement: createElementSpy,
        body: { appendChild: appendChildSpy, removeChild: removeChildSpy },
      }
    })

    afterEach(() => {
      delete global.document
    })

    it('builds a temporary <a> download link and clicks it', () => {
      const qrRef = { current: { toDataURL: (cb) => cb('BASE64DATA') } }

      downloadQrCode(qrRef, 'patient-0005.png')

      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(mockLink.href).toBe('data:image/png;base64,BASE64DATA')
      expect(mockLink.download).toBe('patient-0005.png')
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink)
      expect(mockLink.click).toHaveBeenCalledTimes(1)
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink)
    })
  })

  describe('on native', () => {
    beforeEach(() => {
      Platform.OS = 'ios'
      mockFileInstance.exists = false
      mockFileInstance.delete.mockClear()
      mockFileInstance.create.mockClear()
      mockFileInstance.write.mockClear()
      File.mockClear()
      Sharing.isAvailableAsync.mockReset()
      Sharing.shareAsync.mockReset()
    })

    it('writes the QR image to the cache directory and shares it when sharing is available', async () => {
      Sharing.isAvailableAsync.mockResolvedValue(true)
      Sharing.shareAsync.mockResolvedValue(undefined)
      const qrRef = { current: { toDataURL: (cb) => cb('BASE64DATA') } }

      downloadQrCode(qrRef, 'slot-0001.png')
      await flushPromises()

      expect(File).toHaveBeenCalledWith(Paths.cache, 'slot-0001.png')
      expect(mockFileInstance.create).toHaveBeenCalledTimes(1)
      expect(mockFileInstance.write).toHaveBeenCalledWith('BASE64DATA', { encoding: 'base64' })
      expect(Sharing.shareAsync).toHaveBeenCalledWith(mockFileInstance.uri, { mimeType: 'image/png' })
    })

    it('deletes a pre-existing cached file with the same name before writing the new one', async () => {
      mockFileInstance.exists = true
      Sharing.isAvailableAsync.mockResolvedValue(false)
      const qrRef = { current: { toDataURL: (cb) => cb('BASE64DATA') } }

      downloadQrCode(qrRef, 'slot-0002.png')
      await flushPromises()

      expect(mockFileInstance.delete).toHaveBeenCalledTimes(1)
    })

    it('does not attempt to share when sharing is unavailable on the device', async () => {
      Sharing.isAvailableAsync.mockResolvedValue(false)
      const qrRef = { current: { toDataURL: (cb) => cb('BASE64DATA') } }

      downloadQrCode(qrRef, 'slot-0003.png')
      await flushPromises()

      expect(Sharing.shareAsync).not.toHaveBeenCalled()
    })
  })
})
