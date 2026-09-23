export const CAMERA_FACING = 'back'
export const QR_BARCODE_TYPES = ['qr']

// Expo's own docs warn that on Android, a barcode should take up the
// majority of the frame to scan reliably - a wristband QR held at a normal
// distance is small relative to the frame, so zoom helps it fill enough of
// the image to be detected consistently. 0.25 missed at a slightly farther
// hold distance; 0.4 was too much - settled in between.
export const CAMERA_QR_ZOOM = 0.3
