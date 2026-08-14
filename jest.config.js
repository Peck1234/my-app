module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  collectCoverageFrom: [
    'src/utils/qr.js',
    'src/utils/downloadQrCode.js',
    'src/utils/medicationLocatorLogic.js',
    'src/hook/**/*.js',
    'src/services/**/*.js',
    '!**/*.test.js',
  ],
}
