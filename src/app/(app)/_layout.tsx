import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore } from "@/features/auth/store";
import { resetCoach } from "@/features/coach/store";
import { resetDailyPlan } from "@/features/plan/daily-store";
import { resetProgress } from "@/features/progress/store";
import {
  loadProfile,
  resetProfile,
  useProfileStore,
} from "@/features/profile/store";
import { tokens } from "@/theme/tokens";

export default function AppLayout() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const profile = useProfileStore((state) => state.profile);
  const loaded = useProfileStore((state) => state.loaded);

  useEffect(() => {
    if (!userId) return;
    // On fetch failure fall through to onboarding rather than hang on the
    // spinner; saving there will surface any persistent backend problem.
    loadProfile(userId).catch(() => {
      useProfileStore.setState({ loaded: true });
    });
    return () => {
      resetProfile();
      resetCoach();
      resetDailyPlan();
      resetProgress();
    };
  }, [userId]);

  if (!loaded) {
    return (
      <View className="flex-1 items-center justify-center bg-cream dark:bg-night">
        <ActivityIndicator size="large" color={tokens.colors.sage[500]} />
      </View>
    );
  }

  const onboarded = !!profile?.onboarded_at;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="home" />
        <Stack.Screen name="coach" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="progress" />
      </Stack.Protected>
    </Stack>
  );
}
