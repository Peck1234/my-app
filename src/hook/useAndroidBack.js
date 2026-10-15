import { useEffect, useState } from 'react'
import { BackHandler, Platform } from 'react-native'
import { useLatestCallback } from './useLatestCallback'

// Android's hardware back button. Screens switch through component state, not
// a navigator, so without this the button just closes the app. Every screen
// that can "go back" registers a handler that undoes its own innermost step
// and returns true, or returns false when it is already at its top level.
//
// The deepest screen must get the first try. Effects run children-first, so
// subscription order can't tell depth apart - but render runs parent-first,
// and a screen opened later renders later, so each one takes a number on its
// first render and the highest number is asked first.
let nextOrder = 0
const handlers = new Map()
let subscription = null

function handleHardwareBack() {
  const orders = [...handlers.keys()].sort((a, b) => b - a)
  return orders.some((order) => handlers.get(order)())
}

export function useAndroidBack(handler) {
  const [order] = useState(() => ++nextOrder)
  const latest = useLatestCallback(handler)

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined
    handlers.set(order, () => latest() === true)
    if (!subscription) subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack)
    return () => {
      handlers.delete(order)
      if (handlers.size === 0 && subscription) {
        subscription.remove()
        subscription = null
      }
    }
  }, [order, latest])
}
