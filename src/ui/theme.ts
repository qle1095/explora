/**
 * Cozy UI theme — warm parchment chrome matching the storybook map art.
 * (True rounded custom font arrives with the next native build; until
 * then Avenir Next is the warmest face available without a rebuild.)
 */
export const colors = {
  card: "#fdf5e0",
  cardBorder: "#e3cfa4",
  inset: "#f6ecd2",
  insetBorder: "#e8d9b4",
  textPrimary: "#5b4a32",
  textSecondary: "#8a7a5e",
  textFaint: "#b3a382",
  accent: "#5cb8ae",
  accentDeep: "#3d9a90",
  onAccent: "#fdf5e0",
  coral: "#f77f5f",
  gold: "#f2b74b",
  shadow: "rgba(110, 84, 45, 0.35)",
};

export const font = {
  bold: "AvenirNext-Bold",
  demi: "AvenirNext-DemiBold",
  medium: "AvenirNext-Medium",
};

/**
 * 4pt spacing rhythm. Reach for these instead of ad-hoc margins — the whole
 * point is that two unrelated screens end up with the same gaps.
 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

/**
 * Type roles, not type sizes. Pick by what the text *is* — a row's name is
 * `body`, its category and distance are `meta` — so hierarchy stays
 * consistent without every screen re-deciding what 13.5px means.
 */
export const type = {
  title: { fontFamily: font.bold, fontSize: 19 },
  body: { fontFamily: font.demi, fontSize: 15 },
  /** Secondary line under a title — a local-script name, a subtitle. */
  sub: { fontFamily: font.medium, fontSize: 13 },
  meta: { fontFamily: font.medium, fontSize: 12 },
  chip: { fontFamily: font.demi, fontSize: 10.5 },
} as const;

/** Semantic aliases: screens ask for "open", not for a hex value. */
export const status = {
  openText: colors.accentDeep,
  openBg: "rgba(92, 184, 174, 0.16)",
  closedText: colors.textFaint,
  closedBg: "rgba(179, 163, 130, 0.14)",
} as const;

export const card = {
  backgroundColor: colors.card,
  borderColor: colors.cardBorder,
  borderWidth: 1.5,
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.9,
  shadowRadius: 6,
} as const;
