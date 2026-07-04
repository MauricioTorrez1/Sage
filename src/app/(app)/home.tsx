import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedBlobs } from "@/components/ui/AnimatedBlobs";
import { Button } from "@/components/ui/Button";
import { calculatePlan } from "@/features/plan/calculations";
import { DailyPlanCard } from "@/features/plan/DailyPlanCard";
import { ProgressCard } from "@/features/progress/ProgressCard";
import { useProfileStore } from "@/features/profile/store";
import type { Goal } from "@/features/profile/types";
import { setThemePreference } from "@/features/theme/store";
import { supabase } from "@/lib/supabase";

const GOAL_LABEL_KEY: Record<Goal, string> = {
  lose_weight: "onboarding.goalLose",
  maintain: "onboarding.goalMaintain",
  gain_muscle: "onboarding.goalGain",
};

function MacroTile({ label, grams }: { label: string; grams: number }) {
  return (
    <View className="flex-1 items-center rounded-button bg-sage-50 py-3 dark:bg-sage-900">
      <Text className="font-nunito-extrabold text-xl text-ink dark:text-ink-inverse">
        {grams} g
      </Text>
      <Text className="font-nunito text-xs text-ink-muted dark:text-ink-invmuted">
        {label}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const profile = useProfileStore((state) => state.profile);
  const plan = profile ? calculatePlan(profile) : null;
  const dark = colorScheme === "dark";

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-night">
      <AnimatedBlobs />
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-6 py-8"
      >
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 font-nunito-extrabold text-3xl text-ink dark:text-ink-inverse">
            {profile?.display_name
              ? t("home.greetingName", { name: profile.display_name })
              : t("home.greeting")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("home.toggleTheme")}
            onPress={() => setThemePreference(dark ? "light" : "dark")}
            className="ml-3 h-10 w-10 items-center justify-center rounded-full bg-sage-100 dark:bg-sage-800"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text>{dark ? "☀️" : "🌙"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("home.editProfile")}
            onPress={() => router.push("/profile")}
            className="ml-3 h-10 w-10 items-center justify-center rounded-full bg-sage-100 dark:bg-sage-800"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text>✏️</Text>
          </Pressable>
        </View>
        {profile?.goal ? (
          <View className="mt-2 self-start rounded-full bg-sage-100 px-3 py-1 dark:bg-sage-800">
            <Text className="font-nunito-semibold text-sm text-sage-700 dark:text-sage-200">
              {t(GOAL_LABEL_KEY[profile.goal])}
            </Text>
          </View>
        ) : null}

        {plan ? (
          <View className="mt-6 rounded-card bg-white p-5 dark:bg-nightSurface">
            <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
              {t("plan.title")}
            </Text>
            <View className="mt-3 flex-row items-baseline">
              <Text className="font-nunito-extrabold text-5xl leading-[56px] text-terracotta-500">
                {plan.calories}
              </Text>
              <Text className="ml-2 font-nunito-semibold text-base text-ink-muted dark:text-ink-invmuted">
                {t("plan.kcalPerDay")}
              </Text>
            </View>
            <View className="mt-4 flex-row gap-2">
              <MacroTile
                label={t("plan.protein")}
                grams={plan.proteinG}
              />
              <MacroTile label={t("plan.fat")} grams={plan.fatG} />
              <MacroTile label={t("plan.carbs")} grams={plan.carbsG} />
            </View>
            <Text className="mt-4 font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
              {t("plan.method")}
            </Text>
          </View>
        ) : (
          <View className="mt-6 rounded-card bg-white p-5 dark:bg-nightSurface">
            <Text className="font-nunito text-base text-ink-muted dark:text-ink-invmuted">
              {t("plan.incomplete")}
            </Text>
          </View>
        )}

        <DailyPlanCard />

        <ProgressCard />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/coach")}
          className="mt-4 flex-row items-center rounded-card bg-sage-100 p-5 dark:bg-sage-900"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-sage-200 dark:bg-sage-800">
            <Text className="text-xl">🌿</Text>
          </View>
          <View className="flex-1">
            <Text className="font-nunito-bold text-base text-sage-800 dark:text-sage-100">
              {t("home.coachTitle")}
            </Text>
            <Text className="mt-0.5 font-nunito text-sm text-sage-700 dark:text-sage-300">
              {t("home.coachSubtitle")}
            </Text>
          </View>
          <Text className="text-xl text-sage-600 dark:text-sage-300">›</Text>
        </Pressable>

        <View className="mt-auto pt-8">
          <Button
            title={t("auth.logout")}
            onPress={() => supabase.auth.signOut()}
            variant="ghost"
          />
          <Text className="mt-4 text-center font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
            {t("home.disclaimer")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
