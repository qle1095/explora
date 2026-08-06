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

export const card = {
  backgroundColor: colors.card,
  borderColor: colors.cardBorder,
  borderWidth: 1.5,
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.9,
  shadowRadius: 6,
} as const;
