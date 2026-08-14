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

// Stage 2: look up a scanned code against the patient's medication cassette
// QRs. Returns the matched medication, or null if the code isn't recognized.
export function matchesCassette(scannedData, medicationByQr) {
  return medicationByQr[scannedData] || null
}

// Is this matched medication the one the AR flow is currently pointing the
// nurse toward (vs. some other, still-pending medication for the patient)?
export function isTargetMedication(medication, targetMedication) {
  return !!medication && !!targetMedication && medication.order_id === targetMedication.order_id
}
