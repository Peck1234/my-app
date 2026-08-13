import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '../constants/theme'

export default function LinkButton({ label, onPress, tone = 'accent', icon = 'chevron-back', style }) {
  const color = tone === 'danger' ? colors.danger : colors.accent

  return (
    <TouchableOpacity
      style={[styles.base, { borderColor: color }, style]}
      onPress={onPress}
      activeOpacity={0.6}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      {!!icon && <Ionicons name={icon} size={15} color={color} />}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
})
