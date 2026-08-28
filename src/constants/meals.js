// Single source of truth for the 5 meal-cassette values, matching the
// backend's PatientMealCassette::MEALS exactly (breakfast/lunch/dinner/
// bedtime/prn) - every screen that shows or picks a meal imports from here
// instead of hardcoding the list, so the two can't drift apart.
export const MEALS = ['breakfast', 'lunch', 'dinner', 'bedtime', 'prn']

export const MEAL_LABELS = {
  breakfast: 'เช้า',
  lunch: 'กลางวัน',
  dinner: 'เย็น',
  bedtime: 'ก่อนนอน',
  prn: 'ตามแพทย์สั่ง (PRN)',
}

export const MEAL_TIMES = {
  breakfast: '08:00',
  lunch: '12:00',
  dinner: '18:00',
  bedtime: '21:00',
  prn: null,
}
