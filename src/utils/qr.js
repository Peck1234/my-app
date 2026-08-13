export function normalizeQrValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}
