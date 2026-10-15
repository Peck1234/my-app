import { addDays, daysBetween, thaiDate, toIsoDate } from './PatientDispenseHistoryScreen'

jest.mock('../api', () => ({
  fetchPatientDispenseHistory: jest.fn(),
  exportPatientDispenseHistory: jest.fn(),
}))

describe('PatientDispenseHistoryScreen date helpers', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2026, 9, 5))).toBe('2026-10-05')
  })

  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2026-10-15', -6)).toBe('2026-10-09')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('counts days inclusively', () => {
    expect(daysBetween('2026-10-09', '2026-10-15')).toBe(7)
    expect(daysBetween('2026-10-15', '2026-10-15')).toBe(1)
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(31)
  })

  it('shows dates the way the paper form does (Thai month, 2-digit Buddhist year)', () => {
    expect(thaiDate('2026-10-15')).toBe('15 ต.ค. 69')
    expect(thaiDate('2026-01-03')).toBe('3 ม.ค. 69')
  })
})
