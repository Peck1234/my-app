// Single source of truth for the 9 meal-cassette values, matching the
// backend's PatientMealCassette::MEALS exactly (each of the 4 real meals
// split into before/after food, plus 'prn') - every screen that shows or
// picks a meal imports from here instead of hardcoding the list, so the two
// can't drift apart.
export const MEALS = [
  'breakfast_before', 'breakfast_after',
  'lunch_before', 'lunch_after',
  'dinner_before', 'dinner_after',
  'bedtime_before', 'bedtime_after',
  'prn',
]

export const MEAL_LABELS = {
  breakfast_before: 'เช้า-ก่อนอาหาร',
  breakfast_after: 'เช้า-หลังอาหาร',
  lunch_before: 'กลางวัน-ก่อนอาหาร',
  lunch_after: 'กลางวัน-หลังอาหาร',
  dinner_before: 'เย็น-ก่อนอาหาร',
  dinner_after: 'เย็น-หลังอาหาร',
  bedtime_before: 'ก่อนนอน-ก่อนอาหาร',
  bedtime_after: 'ก่อนนอน-หลังอาหาร',
  prn: 'ตามแพทย์สั่ง (PRN)',
}

// +-30min around each old single meal time (breakfast 08:00, lunch 12:00,
// dinner 18:00, bedtime 21:00), close enough to "ก่อน/หลังอาหาร" to be
// meaningfully different for the due-medication/reminder logic without
// inventing a real clinical schedule.
export const MEAL_TIMES = {
  breakfast_before: '07:30',
  breakfast_after: '08:30',
  lunch_before: '11:30',
  lunch_after: '12:30',
  dinner_before: '17:30',
  dinner_after: '18:30',
  bedtime_before: '20:30',
  bedtime_after: '21:30',
  prn: null,
}

// UI-only grouping so meal pickers can show "main meal -> before/after" (2
// sub-choices under one heading) instead of a flat 9-pill row. Not sent to
// the backend directly - MealPicker resolves a tap straight to one of the
// MEALS values above.
export const MAIN_MEALS = [
  { key: 'breakfast', label: 'เช้า', before: 'breakfast_before', after: 'breakfast_after' },
  { key: 'lunch', label: 'กลางวัน', before: 'lunch_before', after: 'lunch_after' },
  { key: 'dinner', label: 'เย็น', before: 'dinner_before', after: 'dinner_after' },
  { key: 'bedtime', label: 'ก่อนนอน', before: 'bedtime_before', after: 'bedtime_after' },
]

export const BEFORE_AFTER_LABELS = { before: 'ก่อนอาหาร', after: 'หลังอาหาร' }
