import { Alert, Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as MediaLibrary from 'expo-media-library'
import { downloadQrCode } from './downloadQrCode'

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///mock/cache/',
  writeAsStringAsync: jest.fn(),
}))

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
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
      FileSystem.writeAsStringAsync.mockReset()
      MediaLibrary.requestPermissionsAsync.mockReset()
      MediaLibrary.saveToLibraryAsync.mockReset()
      jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    })

    afterEach(() => {
      Alert.alert.mockRestore()
    })

    it('writes the QR image as base64 to the cache directory and saves it to the photo library when permission is granted', async () => {
      FileSystem.writeAsStringAsync.mockResolvedValue(undefined)
      MediaLibrary.requestPermissionsAsync.mockResolvedValue({ status: 'granted' })
      MediaLibrary.saveToLibraryAsync.mockResolvedValue(undefined)
      const qrRef = { current: { toDataURL: (cb) => cb('BASE64DATA') } }

      downloadQrCode(qrRef, 'slot-0001.png')
      await flushPromises()

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        'file:///mock/cache/slot-0001.png',
        'BASE64DATA',
        { encoding: 'base64' }
      )
      expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith('file:///mock/cache/slot-0001.png')
      expect(Alert.alert).toHaveBeenCalledWith('บันทึกรูปสำเร็จ', expect.any(String))
    })

    it('does not attempt to save and warns the user when permission is denied', async () => {
      FileSystem.writeAsStringAsync.mockResolvedValue(undefined)
      MediaLibrary.requestPermissionsAsync.mockResolvedValue({ status: 'denied' })
      const qrRef = { current: { toDataURL: (cb) => cb('BASE64DATA') } }

      downloadQrCode(qrRef, 'slot-0003.png')
      await flushPromises()

      expect(MediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled()
      expect(Alert.alert).toHaveBeenCalledWith('บันทึกรูปไม่สำเร็จ', expect.any(String))
    })

    it('shows an error alert instead of failing silently when writing the file throws', async () => {
      FileSystem.writeAsStringAsync.mockRejectedValue(new Error('disk full'))
      const qrRef = { current: { toDataURL: (cb) => cb('BASE64DATA') } }

      downloadQrCode(qrRef, 'slot-0004.png')
      await flushPromises()

      expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled()
      expect(Alert.alert).toHaveBeenCalledWith('บันทึกรูปไม่สำเร็จ', expect.stringContaining('disk full'))
    })
  })
})
