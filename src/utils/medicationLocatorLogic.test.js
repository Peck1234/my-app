import { getBoxRect, matchesSlot, matchesCassette, isTargetMedication } from './medicationLocatorLogic'

describe('getBoxRect', () => {
  it('computes a box from cornerPoints (Android-style result)', () => {
    const result = {
      cornerPoints: [
        { x: 100, y: 50 },
        { x: 200, y: 50 },
        { x: 200, y: 150 },
        { x: 100, y: 150 },
      ],
    }

    expect(getBoxRect(result, 400, 800)).toEqual({ x: 100, y: 50, width: 100, height: 100 })
  })

  it('ignores cornerPoints with fewer than 3 points and falls through', () => {
    const result = { cornerPoints: [{ x: 10, y: 10 }] }

    expect(getBoxRect(result, 400, 800)).toEqual({ x: 140, y: 340, width: 120, height: 120 })
  })

  it('falls back to bounds when cornerPoints is absent (iOS-style result)', () => {
    const result = {
      bounds: { origin: { x: 30, y: 40 }, size: { width: 80, height: 90 } },
    }

    expect(getBoxRect(result, 400, 800)).toEqual({ x: 30, y: 40, width: 80, height: 90 })
  })

  it('prefers cornerPoints over bounds when both are present', () => {
    const result = {
      cornerPoints: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
      ],
      bounds: { origin: { x: 999, y: 999 }, size: { width: 999, height: 999 } },
    }

    expect(getBoxRect(result, 400, 800)).toEqual({ x: 0, y: 0, width: 50, height: 50 })
  })

  it('falls back to a centered placeholder box when neither geometry is usable', () => {
    expect(getBoxRect({}, 400, 800)).toEqual({ x: 140, y: 340, width: 120, height: 120 })
  })

  it('falls back when bounds has zero size', () => {
    const result = { bounds: { origin: { x: 5, y: 5 }, size: { width: 0, height: 0 } } }

    expect(getBoxRect(result, 300, 600)).toEqual({ x: 90, y: 240, width: 120, height: 120 })
  })
})

describe('matchesSlot', () => {
  it('returns true when the scanned code equals the patient slot QR', () => {
    expect(matchesSlot('SLOT-0001', 'SLOT-0001')).toBe(true)
  })

  it('returns false for a different code', () => {
    expect(matchesSlot('SLOT-0002', 'SLOT-0001')).toBe(false)
  })

  it('returns false when the patient has no slot QR at all', () => {
    expect(matchesSlot('SLOT-0001', undefined)).toBe(false)
  })
})

describe('matchesCassette', () => {
  const medicationByQr = {
    'CASSETTE-0001': { order_id: 1, drug_name: 'Paracetamol' },
    'CASSETTE-0002': { order_id: 2, drug_name: 'Amoxicillin' },
  }

  it('returns the matching medication for a known cassette QR', () => {
    expect(matchesCassette('CASSETTE-0001', medicationByQr)).toEqual({ order_id: 1, drug_name: 'Paracetamol' })
  })

  it('returns null for an unrecognized QR code', () => {
    expect(matchesCassette('CASSETTE-9999', medicationByQr)).toBeNull()
  })

  it('returns null when the QR map is empty', () => {
    expect(matchesCassette('CASSETTE-0001', {})).toBeNull()
  })
})

describe('isTargetMedication', () => {
  const target = { order_id: 5, drug_name: 'Glipizide' }

  it('returns true when the matched medication is the current target', () => {
    expect(isTargetMedication({ order_id: 5, drug_name: 'Glipizide' }, target)).toBe(true)
  })

  it('returns false when the matched medication is a different pending item', () => {
    expect(isTargetMedication({ order_id: 6, drug_name: 'Diacerein' }, target)).toBe(false)
  })

  it('returns false when there is no current target (e.g. everything already dispensed)', () => {
    expect(isTargetMedication({ order_id: 5, drug_name: 'Glipizide' }, null)).toBe(false)
  })

  it('returns false when there is no matched medication', () => {
    expect(isTargetMedication(null, target)).toBe(false)
  })
})
