import { colorScheme } from "nativewind";
import { AppState } from "react-native";

/**
 * The theme follows the local clock: light from 09:00 to 16:20, dark the rest
 * of the day. There is no manual override — the app decides from the hour.
 */
const LIGHT_START_MIN = 9 * 60; // 09:00
const LIGHT_END_MIN = 16 * 60 + 20; // 16:20

/** "light" during the day window, "dark" otherwise. */
export function computeAutoTheme(now: Date = new Date()): "light" | "dark" {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= LIGHT_START_MIN && minutes < LIGHT_END_MIN
    ? "light"
    : "dark";
}

function applyAutoTheme() {
  colorScheme.set(computeAutoTheme());
}

/**
 * Drives the theme from the local clock. Call once from the root layout after
 * mount (never at module scope — the static web export would touch native
 * modules). Re-checks every minute so the 16:20 flip happens while the app is
 * open, and again whenever the app returns to the foreground. Returns a
 * cleanup that removes the timer and listener.
 */
export function startAutoTheme(): () => void {
  applyAutoTheme();

  const interval = setInterval(applyAutoTheme, 60 * 1000);
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") applyAutoTheme();
  });

  return () => {
    clearInterval(interval);
    subscription.remove();
  };
}
