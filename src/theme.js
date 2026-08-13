// "Aurora" — replaces "Warm Trust". Same reasoning as last time: every key
// that already exists keeps its name (nothing that imports `colors`/`radius`/
// `spacing`/`shadow` needs to change) — only values changed, plus additive
// gradient tokens for the new blue->violet identity.

export const colors = {
  // Cool near-white instead of Warm Trust's cream - the whole neutral family
  // (bg/ink/muted/border) shifted from a warm-brown undertone to a cool
  // blue-violet undertone so it reads as one family with the new accent
  // gradient, the same way Warm Trust's neutrals matched its cream/blue.
  bg: '#F7F8FC',
  surface: '#FFFFFF',

  ink: '#161A2E',
  muted: '#6B7089',
  border: '#E3E6F5',

  // Blue->violet gradient is the core of this theme - `accent` is the blue
  // end (used anywhere a flat/solid color is needed: links, icons, borders),
  // `gradientPrimary` is the full two-stop pair for LinearGradient. Chosen
  // to sit close enough to the old Warm Trust accent (#1D7FE0) that this
  // reads as an evolution of the same brand blue, not an unrelated color.
  accent: '#2E7CF6',
  accentSoft: '#E7EFFE',

  // Violet - the gradient's other stop, promoted to a standalone token too
  // (Button's existing `secondary` variant, decorative badges) since a
  // color this central to the new identity is worth having on its own,
  // not just baked into the gradient array.
  secondary: '#8B5CF6',
  secondarySoft: '#F0E9FE',

  success: '#1F8A4C',
  successBg: '#E6F4EC',
  danger: '#C23B3B',
  dangerBg: '#FBEAEA',
  warning: '#B97B12',
  warningBg: '#FBF1E1',

  // This is the real "due now / urgent" semantic color used across
  // MissedMedicationsScreen, DueMedicationAlert, PatientMedicationScreen -
  // moved from Warm Trust's amber-orange to Aurora's coral so urgency still
  // reads as its own distinct, warm-toned color against the cool blue/violet
  // rest of the palette (not just "the other accent color").
  highlight: '#FF6B6B',
  highlightBg: '#FFE8E5',
}

// Two-stop gradient pairs for <LinearGradient colors={...}>. `primary` is
// full-strength, for small/bold surfaces that carry their own contrast
// (buttons, icon marks, header bars, stat card fills) - white text on top
// stays >= 3:1 (WCAG AA for bold/large text) across the whole gradient run.
// `soft` is a light wash of the same two hues for larger backgrounds behind
// dark text (e.g. a hero panel), where full-strength color would fight the
// content instead of framing it.
export const gradients = {
  primary: ['#2E7CF6', '#8B5CF6'],
  soft: ['#EAF1FE', '#F3EEFE'],
}

// Unchanged from Warm Trust - rounder-across-the-board wasn't part of what
// this pass was asked to touch.
export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  pill: 999,
}

// Unchanged from Warm Trust.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
}

// Shadow color moved from Warm Trust's warm near-black (#3A2E1F) to a cool
// blue-violet near-black, so elevation still reads as "this palette's own
// shadow" instead of a warm-toned shadow left over from the old theme.
export const shadow = {
  card: {
    shadowColor: '#242A5C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  raised: {
    shadowColor: '#242A5C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 6,
  },
}
