import { useRef } from 'react'
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { colors, gradients, radius, shadow } from '../constants/theme'

const VARIANTS = {
  // `primary` now renders the Aurora blue->violet gradient instead of a flat
  // fill - this is the one variant used almost everywhere by default, so
  // making it a gradient here is what carries the new theme through the
  // whole app without touching every screen's Button call.
  primary: { gradient: true, fg: '#FFFFFF', elevated: true },
  dark: { bg: colors.ink, fg: '#FFFFFF', elevated: true },
  success: { bg: colors.success, fg: '#FFFFFF', elevated: true },
  danger: { bg: colors.danger, fg: '#FFFFFF', elevated: true },
  // Flat violet (the gradient's own second stop, promoted to solo use) for
  // a second point of emphasis that isn't the main CTA.
  secondary: { bg: colors.secondary, fg: '#FFFFFF', elevated: true },
  outline: { bg: colors.surface, fg: colors.ink, borderColor: colors.border, elevated: false },
}

// Same props as before (label, onPress, variant, loading, disabled, fullWidth,
// icon, style) - `primary` looks different now (gradient fill instead of flat
// accent) but nothing about how callers use Button changed.
export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  icon,
  style,
}) {
  const palette = VARIANTS[variant] || VARIANTS.primary
  const isDisabled = disabled || loading
  const scale = useRef(new Animated.Value(1)).current

  const animateTo = (toValue) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start()
  }

  const content = (
    <>
      {loading && <ActivityIndicator color={palette.fg} />}
      {!!icon && !loading && <Ionicons name={icon} size={17} color={palette.fg} />}
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </>
  )

  const bodyStyle = [
    styles.base,
    fullWidth && styles.fullWidth,
    palette.elevated && !isDisabled && shadow.card,
    isDisabled && styles.disabled,
    style,
  ]

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      disabled={isDisabled}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {palette.gradient ? (
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={bodyStyle}>
            {content}
          </LinearGradient>
        ) : (
          <View
            style={[
              ...bodyStyle,
              {
                backgroundColor: palette.bg,
                borderColor: palette.borderColor || 'transparent',
                borderWidth: palette.borderColor ? 1 : 0,
              },
            ]}
          >
            {content}
          </View>
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    borderRadius: radius.md,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
  },
})
