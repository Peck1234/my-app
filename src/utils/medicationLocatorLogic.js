// Pure QR/AR matching logic used by MedicationLocatorScreen, kept in its own
// dependency-free module (no expo-camera/expo-haptics/component imports) so
// it can be unit tested directly without rendering the screen or mocking the
// camera. Extracted from the screen file with no behavior change - each
// function here is exactly what used to be inline.

// Computes the on-screen highlight box for a scanned code from whichever
// geometry expo-camera's scanning result actually provided this platform:
// Android reports `cornerPoints` (4 corners of the detected code), iOS
// reports a `bounds` rect. Falls back to a centered placeholder box if
// neither is present/usable, so a caller can always draw *something*.
export function getBoxRect(result, screenWidth, screenHeight) {
  const { cornerPoints, bounds } = result
  if (Array.isArray(cornerPoints) && cornerPoints.length >= 3) {
    const xs = cornerPoints.map((p) => p.x)
    const ys = cornerPoints.map((p) => p.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    const width = Math.max(...xs) - x
    const height = Math.max(...ys) - y
    if (width > 0 && height > 0) return { x, y, width, height }
  }
  if (bounds?.size?.width > 0 && bounds?.size?.height > 0) {
    return {
      x: bounds.origin.x,
      y: bounds.origin.y,
      width: bounds.size.width,
      height: bounds.size.height,
    }
  }
  return { x: screenWidth / 2 - 60, y: screenHeight / 2 - 60, width: 120, height: 120 }
}

// Stage 1: does a scanned code match the patient's cart-drawer QR?
export function matchesSlot(scannedData, patientSlotQr) {
  return scannedData === patientSlotQr
}

// Stage 2, meal-cassette architecture: one QR now covers every drug in a
// patient's meal, not a single drug, so medications sharing a cassette QR
// group under it instead of each getting their own 1:1 entry.
export function groupMedicationsByCassetteQr(medications) {
  const map = {}
  for (const item of medications) {
    if (!item.qr_code_cassette) continue
    if (!map[item.qr_code_cassette]) map[item.qr_code_cassette] = []
    map[item.qr_code_cassette].push(item)
  }
  return map
}

// Does a scanned code match any cassette this patient has (regardless of
// which drugs are currently inside it - that list is only ever trusted fresh
// from verify-cassette, never inferred from this local grouping)?
export function matchesCassetteQr(scannedData, cassetteMedicationsByQr) {
  return Object.prototype.hasOwnProperty.call(cassetteMedicationsByQr, scannedData)
}

// Is this scanned cassette QR the one containing the medication the AR flow
// is currently pointing the nurse toward (vs. some other, still-pending
// medication in a different meal)?
export function isTargetCassette(scannedData, targetMedication) {
  return !!targetMedication && targetMedication.qr_code_cassette === scannedData
}
