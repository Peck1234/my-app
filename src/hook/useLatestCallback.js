import { useCallback, useRef } from 'react'

// Returns a function whose identity never changes but always runs the latest
// `fn`. Needed for expo-camera's onBarcodeScanned on web: its scan loop
// captures the handler from the render that enabled scanning and keeps
// calling that one, so any state the handler reads (e.g. which step the
// scan flow is on) would otherwise stay frozen at its first value.
export function useLatestCallback(fn) {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback((...args) => ref.current(...args), [])
}
