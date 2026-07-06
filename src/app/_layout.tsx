import "../global.css";
import "@/lib/i18n";

import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/nunito";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { useAuthDeepLinks } from "@/features/auth/oauth";
import { startAuthListener, useAuthStore } from "@/features/auth/store";
import { initReminders } from "@/features/reminders/store";
import { loadThemePreference } from "@/features/theme/store";

SplashScreen.preventAutoHideAsync();

startAuthListener();

export default function RootLayout() {
  // Catches OAuth redirects that arrive as deep links (see oauth.ts).
  useAuthDeepLinks();

  useEffect(() => {
    loadThemePreference();
    initReminders();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  const session = useAuthStore((state) => state.session);
  const authInitialized = useAuthStore((state) => state.initialized);

  const ready = (fontsLoaded || !!fontError) && authInitialized;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
