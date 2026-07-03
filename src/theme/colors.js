/**
 * Sage brand palette — single source of truth for colors.
 * Plain CommonJS so both tailwind.config.js (Node) and app code (via tokens.ts)
 * can consume it without duplication.
 */
const colors = {
  // Primary: soft sage green. Calm, warm, natural.
  sage: {
    50: "#F3F6F3",
    100: "#E5ECE6",
    200: "#CDDACF",
    300: "#B0C3B4",
    400: "#96AF9B",
    500: "#7C9A82",
    600: "#637E68",
    700: "#4D6352",
    800: "#3A4A3E",
    900: "#2A362D",
  },
  // Accent: warm terracotta/coral for CTAs.
  terracotta: {
    50: "#FCF1ED",
    100: "#F8DED5",
    200: "#F2BFAE",
    300: "#EA9D85",
    400: "#E58B70",
    500: "#E07A5F",
    600: "#C75F44",
    700: "#A54A32",
    800: "#823A27",
    900: "#602B1D",
  },
  // Backgrounds: warm off-white (light) and warm near-black (dark).
  cream: "#FAF7F2",
  sand: "#F1ECE3",
  night: "#1C1A17",
  nightSurface: "#262320",
  // Text: warm dark grays, never pure black.
  ink: {
    DEFAULT: "#3D3A35",
    muted: "#6F6A61",
    soft: "#8A8478",
    inverse: "#F2EFE9",
    invmuted: "#B5AFA4",
  },
};

module.exports = { colors };
