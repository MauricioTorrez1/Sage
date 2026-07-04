import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";
import { create } from "zustand";

/** "system" follows the device; the app also honors a manual override. */
export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "sage.theme";

export const useThemeStore = create<{ preference: ThemePreference }>(() => ({
  preference: "system",
}));

function applyTheme(preference: ThemePreference) {
  colorScheme.set(preference);
  useThemeStore.setState({ preference });
}

/**
 * Restores the saved preference. Call from an effect after mount — never at
 * module scope, where the static web export would touch window/AsyncStorage.
 */
export async function loadThemePreference() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      applyTheme(saved);
    }
  } catch {
    // Unreadable storage: stay on "system".
  }
}

/** Applies the preference immediately and persists it for the next launch. */
export function setThemePreference(preference: ThemePreference) {
  applyTheme(preference);
  AsyncStorage.setItem(STORAGE_KEY, preference).catch(() => {});
}
