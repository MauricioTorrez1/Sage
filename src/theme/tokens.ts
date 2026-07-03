import { colors } from "./colors";

/**
 * Design tokens for Sage. Colors live in colors.js (shared with Tailwind);
 * everything here is the typed surface the app should import from.
 * Prefer Tailwind classes in components; use these tokens only where a raw
 * value is required (navigation themes, animations, native props).
 */
export const tokens = {
  colors,
  font: {
    regular: "Nunito_400Regular",
    semibold: "Nunito_600SemiBold",
    bold: "Nunito_700Bold",
    extrabold: "Nunito_800ExtraBold",
  },
  radius: {
    card: 24,
    button: 16,
  },
  spacing: {
    screenX: 24,
  },
} as const;

export type Tokens = typeof tokens;
