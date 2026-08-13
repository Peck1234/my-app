// "Clarity" — a from-scratch replacement for "Aurora", not an evolution of
// it. Same export shape (colors/gradients/radius/spacing/shadow, same key
// names) so nothing that imports these needs to change — only the design
// language underneath changes.
//
// Direction: flat, saturated indigo/violet as the working color (not a
// gradient-first identity like Aurora) — every primary button is one solid
// color a nurse can recognize at a glance without parsing a gradient angle,
// which matters when the same button gets tapped hundreds of times a shift.
// The indigo->violet gradient still exists, but is now reserved for a
// handful of "brand" moments (icon marks, avatars) instead of carrying the
// whole app. Tighter radius and lighter, crisper shadows than Aurora for a
// more clinical-confident feel instead of a soft/warm one.
//
// All accent/semantic colors below are Tailwind's documented 600/700-weight
// shades specifically because their contrast against white is independently
// verified (WCAG AA, 4.5:1+ for normal text) — not hand-picked and hoped.

export const colors = {
  // Cool white with the faintest violet cast, not a neutral gray-white or
  // Aurora's blue-white - reads as "white" at a glance (the brief's "ขาว")
  // while still belonging to the same family as the indigo/violet accents.
  bg: '#FAFAFF',
  surface: '#FFFFFF',

  ink: '#171325',
  // Darker than a typical "muted gray" so it clears 4.5:1 on white with
  // margin - this label sits on secondary text (patient meta, timestamps)
  // that still has to be read fast under ward lighting, not just decoration.
  muted: '#5B5773',
  border: '#E6E4F0',

  // Indigo - the working color. 700-weight (not 600) specifically so button
  // labels and icon-on-white usages clear WCAG AA (4.5:1) with real margin,
  // not right at the edge of passing.
  accent: '#4338CA',
  accentSoft: '#EEEDFC',

  // Violet - second point of emphasis (secondary CTAs, badges), same role
  // Aurora gave its `secondary` token. Purple-700, same AA-with-margin logic.
  secondary: '#7E22CE',
  secondarySoft: '#F6EEFE',

  success: '#15803D',
  successBg: '#DCFCE7',
  danger: '#B91C1C',
  dangerBg: '#FEE2E2',
  warning: '#B45309',
  warningBg: '#FEF3C7',

  // "Due now / urgent" - the color MissedMedicationsScreen, DueMedicationAlert
  // and PatientMedicationScreen use to mean "act on this now". Deliberately
  // burnt-orange/terracotta, not a coral/pink, so it can't be misread as a
  // shade of the secondary violet at a glance. Also a real fix over Aurora's
  // highlight (#FF6B6B on white was ~3:1 - failed AA for text); this one
  // clears ~5.8:1.
  highlight: '#C2410C',
  highlightBg: '#FFEDD5',
}

// Reserved for brand/hero moments only now (icon marks, avatars) - not the
// default button fill. `primary` is full-strength for small bold surfaces;
// `soft` is a light wash for large backgrounds behind dark text.
export const gradients = {
  primary: ['#4338CA', '#7E22CE'],
  soft: ['#EEF0FD', '#F8EEFE'],
}

// Tighter than Aurora's 10/16/20 - a touch less rounded reads more precise/
// confident, still soft enough not to feel sharp or cold.
export const radius = {
  sm: 8,
  md: 14,
  lg: 18,
  pill: 999,
}

// Unchanged - this is layout rhythm, not brand identity, and every screen's
// spacing was tuned against these values. Changing the scale would mean
// re-checking every screen's layout, which is out of scope for a visual-only
// pass.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
}

// Lighter and tighter than Aurora's (opacity 0.1-0.16, radius 12-20) - less
// diffuse "glow" reads crisper/more clinical. Shadow color is a deep
// indigo-black instead of neutral black so elevation still reads as part of
// this palette's own family up close.
export const shadow = {
  card: {
    shadowColor: '#2E1065',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#2E1065',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },
}
