import { useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'

export default function FadeInView({ children, style }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(10)).current
  const scale = useRef(new Animated.Value(0.98)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        mass: 0.9,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 16,
        mass: 0.8,
      }),
    ]).start()
  }, [opacity, translateY, scale])

  return (
    <Animated.View style={[styles.base, { opacity, transform: [{ translateY }, { scale }] }, style]}>
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
})
