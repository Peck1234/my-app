import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, shadow } from '../constants/theme'

const MAX_SUGGESTIONS = 6

// Renders suggestions inline (pushes the rest of the form down) instead of as
// an absolutely-positioned overlay - PatientFormScreen stacks several of
// these inside one ScrollView, and a floating dropdown would either get
// clipped or collide with the next medication card depending on z-index,
// which inline placement sidesteps entirely.
export default function MedicineAutocompleteField({
  label = 'ชื่อยา *',
  value,
  onChangeText,
  onSelectMedicine,
  medicines,
  placeholder = 'พิมพ์เพื่อค้นหาในคลังยา หรือกรอกชื่อยาใหม่',
}) {
  const [focused, setFocused] = useState(false)

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q || !medicines?.length) return []

    return medicines
      .filter((m) => m.drug_name.toLowerCase().includes(q) || (m.generic_name || '').toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1
        return a.drug_name.localeCompare(b.drug_name)
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [value, medicines])

  const showDropdown = focused && suggestions.length > 0

  const handleSelect = (medicine) => {
    onSelectMedicine(medicine)
    setFocused(false)
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.dropdownScroll}>
            {suggestions.map((med) => (
              <TouchableOpacity
                key={med.id}
                style={styles.suggestionRow}
                onPress={() => handleSelect(med)}
                activeOpacity={0.7}
              >
                {med.is_favorite && <Ionicons name="star" size={13} color={colors.warning} />}
                <View style={styles.suggestionText}>
                  <Text style={styles.suggestionName} numberOfLines={1}>
                    {med.drug_name}
                    {med.generic_name ? `  ·  ${med.generic_name}` : ''}
                  </Text>
                  {!!med.standard_dose && (
                    <Text style={styles.suggestionMeta} numberOfLines={1}>
                      {med.standard_dose}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    color: colors.ink,
    fontSize: 15,
  },
  dropdown: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  dropdownScroll: { maxHeight: 220 },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionText: { flex: 1, gap: 1 },
  suggestionName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  suggestionMeta: { color: colors.muted, fontSize: 12 },
})
