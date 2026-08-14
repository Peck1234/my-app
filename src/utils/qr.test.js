import { normalizeQrValue } from './qr'

describe('normalizeQrValue', () => {
  it('trims surrounding whitespace from a scanned value', () => {
    expect(normalizeQrValue('  PATIENT-0005  ')).toBe('PATIENT-0005')
  })

  it('returns the value unchanged when there is no whitespace to trim', () => {
    expect(normalizeQrValue('CASSETTE-0027')).toBe('CASSETTE-0027')
  })

  it('returns an empty string for non-string input (e.g. undefined scan result)', () => {
    expect(normalizeQrValue(undefined)).toBe('')
  })

  it('returns an empty string for null', () => {
    expect(normalizeQrValue(null)).toBe('')
  })

  it('returns an empty string for non-string types like numbers', () => {
    expect(normalizeQrValue(12345)).toBe('')
  })

  it('returns an empty string when the value is only whitespace', () => {
    expect(normalizeQrValue('   ')).toBe('')
  })
})
