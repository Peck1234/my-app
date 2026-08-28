import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import FadeInView from '../components/FadeInView'
import MedicineAddScreen from './MedicineAddScreen'
import MedicineImportScreen from './MedicineImportScreen'
import MedicineAssignScreen from './MedicineAssignScreen'
import { fetchMedicineCatalog, toggleMedicineFavorite } from '../api'
import { colors, radius, shadow, spacing } from '../constants/theme'

export default function MedicineDatabaseScreen({ onSubScreenChange }) {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState('list') // list | add | import | assign
  const [togglingId, setTogglingId] = useState(null)
  const [assigningMedicine, setAssigningMedicine] = useState(null)

  useEffect(() => {
    onSubScreenChange?.(view !== 'list')
  }, [view, onSubScreenChange])

  const loadMedicines = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchMedicineCatalog()
      .then(setMedicines)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadMedicines()
  }, [loadMedicines])

  const filteredMedicines = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = !q
      ? medicines
      : medicines.filter(
          (m) => m.drug_name.toLowerCase().includes(q) || (m.generic_name || '').toLowerCase().includes(q)
        )

    // Favorites first always, matching the search endpoint's own ordering -
    // kept consistent here since this list can also be shown unfiltered.
    return [...list].sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1
      return a.drug_name.localeCompare(b.drug_name)
    })
  }, [medicines, query])

  const handleToggleFavorite = async (medicine) => {
    setTogglingId(medicine.id)
    try {
      const updated = await toggleMedicineFavorite(medicine.id)
      setMedicines((list) => list.map((m) => (m.id === updated.id ? updated : m)))
    } catch (err) {
      setError(err.message)
    } finally {
      setTogglingId(null)
    }
  }

  const backToList = () => {
    setView('list')
    loadMedicines()
  }

  if (view === 'add') {
    return (
      <FadeInView key="add">
        <MedicineAddScreen onCreated={backToList} onCancel={() => setView('list')} />
      </FadeInView>
    )
  }

  if (view === 'import') {
    return (
      <FadeInView key="import">
        <MedicineImportScreen existingCatalog={medicines} onImported={backToList} onCancel={() => setView('list')} />
      </FadeInView>
    )
  }

  if (view === 'assign' && assigningMedicine) {
    return (
      <FadeInView key="assign">
        <MedicineAssignScreen
          medicine={assigningMedicine}
          onDone={() => {
            setAssigningMedicine(null)
            setView('list')
          }}
          onCancel={() => {
            setAssigningMedicine(null)
            setView('list')
          }}
        />
      </FadeInView>
    )
  }

  return (
    <View style={styles.shell}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>คลังยากลาง</Text>
          <Text style={styles.subtitle}>{medicines.length} รายการในคลัง</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setView('import')} activeOpacity={0.7}>
            <Ionicons name="cloud-upload-outline" size={18} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={() => setView('add')} activeOpacity={0.7}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={15} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหาชื่อยาหรือชื่อสามัญ"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.centerStage}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : filteredMedicines.length === 0 ? (
        <View style={styles.centerStage}>
          <Ionicons name="medkit-outline" size={32} color={colors.muted} />
          <Text style={styles.emptyText}>{query ? 'ไม่พบยาที่ตรงกับคำค้นหา' : 'ยังไม่มียาในคลัง'}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filteredMedicines.map((med) => (
            <View key={med.id} style={styles.medicineCard}>
              <TouchableOpacity
                style={styles.starButton}
                onPress={() => handleToggleFavorite(med)}
                disabled={togglingId === med.id}
                hitSlop={8}
              >
                <Ionicons
                  name={med.is_favorite ? 'star' : 'star-outline'}
                  size={20}
                  color={med.is_favorite ? colors.warning : colors.muted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.medicineInfo}
                onPress={() => {
                  setAssigningMedicine(med)
                  setView('assign')
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.medicineName}>
                  {med.drug_name}
                  {med.generic_name ? `  ·  ${med.generic_name}` : ''}
                </Text>
                <View style={styles.metaRow}>
                  {!!med.standard_dose && <MetaBadge label={med.standard_dose} />}
                  {!!med.category && <MetaBadge label={med.category} tone="secondary" />}
                </View>
                {!!med.purpose && <Text style={styles.purposeText}>{med.purpose}</Text>}
                {!!med.contraindication && (
                  <View style={styles.warningRow}>
                    <Ionicons name="warning-outline" size={13} color={colors.warning} />
                    <Text style={styles.warningText}>{med.contraindication}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} style={styles.chevron} />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function MetaBadge({ label, tone = 'accent' }) {
  const bg = tone === 'secondary' ? colors.secondarySoft : colors.accentSoft
  const fg = tone === 'secondary' ? colors.secondary : colors.accent
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1, gap: spacing.md + 2 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    ...shadow.card,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...shadow.card,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, padding: 0 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  centerStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: 40 },
  emptyText: { color: colors.muted, fontSize: 13.5, textAlign: 'center' },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  medicineCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  starButton: { paddingTop: 2 },
  chevron: { alignSelf: 'center' },
  medicineInfo: { flex: 1, gap: 4 },
  medicineName: { color: colors.ink, fontSize: 14.5, fontWeight: '800' },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
  purposeText: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  warningText: { color: colors.warning, fontSize: 12, flex: 1 },
})
