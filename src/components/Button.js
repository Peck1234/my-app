import { useRef } from 'react'
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, shadow } from '../constants/theme'

const VARIANTS = {
  // Flat indigo instead of Aurora's gradient fill - this is the variant a
  // nurse taps most often in a shift (submit, confirm, dispense...), and a
  // solid color is recognized faster than a gradient at a glance. The
  // indigo->violet gradient still exists (see theme.js `gradients`) but is
  // now reserved for icon marks/avatars, not buttons.
  primary: { bg: colors.accent, fg: '#FFFFFF', elevated: true },
  dark: { bg: colors.ink, fg: '#FFFFFF', elevated: true },
  success: { bg: colors.success, fg: '#FFFFFF', elevated: true },
  danger: { bg: colors.danger, fg: '#FFFFFF', elevated: true },
  // Flat violet for a second point of emphasis that isn't the main CTA.
  secondary: { bg: colors.secondary, fg: '#FFFFFF', elevated: true },
  outline: { bg: colors.surface, fg: colors.ink, borderColor: colors.border, elevated: false },
}

// Same props as before (label, onPress, variant, loading, disabled, fullWidth,
// icon, style) - `primary` looks different now (flat indigo instead of a
// gradient) but nothing about how callers use Button changed.
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
