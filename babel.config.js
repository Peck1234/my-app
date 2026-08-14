module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    env: {
      // babel-preset-expo targets Metro, which understands dynamic import()
      // natively - it doesn't compile it down to require(). Jest runs tests
      // in a Node VM context that can't resolve a real import() without the
      // --experimental-vm-modules flag, so downloadQrCode.js's `await
      // import('expo-file-system')` needs this plugin, test-env only, to get
      // rewritten into a Promise-wrapped require() instead.
      test: {
        plugins: ['babel-plugin-dynamic-import-node'],
      },
    },
  }
}
