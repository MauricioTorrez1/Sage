const { colors } = require("./src/theme/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
      fontFamily: {
        // React Native selects weight by family name, so each weight is its own key.
        nunito: ["Nunito_400Regular"],
        "nunito-semibold": ["Nunito_600SemiBold"],
        "nunito-bold": ["Nunito_700Bold"],
        "nunito-extrabold": ["Nunito_800ExtraBold"],
      },
      borderRadius: {
        card: "24px",
        button: "16px",
      },
    },
  },
  plugins: [],
};
