import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import { Button } from "@/components/ui/Button";
import type { DailyPlanItem } from "@/features/plan/daily-store";
import {
  generateTodayPlan,
  loadTodayPlan,
  toggleItem,
  useDailyPlanStore,
} from "@/features/plan/daily-store";
import { tokens } from "@/theme/tokens";

const GENERATING_MESSAGES = [
  "dailyPlan.generating1",
  "dailyPlan.generating2",
  "dailyPlan.generating3",
] as const;

/**
 * Shown in place of the generate button while Sage builds the day. The API
 * gives no real progress signal, so the bar runs two legs — a lively climb
 * to 60%, then a slow crawl toward 95% that covers a 30–90 s generation
 * (plus one silent retry) — and the card swaps in the finished plan when
 * the response lands.
 */
function GeneratingIndicator() {
  const { t } = useTranslation();
  const progress = useSharedValue(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    progress.value = withSequence(
      withTiming(0.6, { duration: 8000, easing: Easing.out(Easing.cubic) }),
      withTiming(0.95, { duration: 80000, easing: Easing.out(Easing.quad) }),
    );
    const interval = setInterval(
      () =>
        setMessageIndex((index) => (index + 1) % GENERATING_MESSAGES.length),
      4000,
    );
    return () => clearInterval(interval);
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View className="py-3">
      <View className="h-2 overflow-hidden rounded-full bg-sage-100 dark:bg-sage-900">
        {/* Reanimated views drop className on web; style the fill inline. */}
        <Animated.View
          style={[
            {
              height: "100%",
              borderRadius: 9999,
              backgroundColor: tokens.colors.sage[500],
            },
            fillStyle,
          ]}
        />
      </View>
      <Text className="mt-2 text-center font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
        {t(GENERATING_MESSAGES[messageIndex])}
      </Text>
    </View>
  );
}

function ItemRow({ item }: { item: DailyPlanItem }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.done }}
      onPress={() => toggleItem(item.id)}
      className="flex-row items-center py-2"
    >
      <View
        className={`mr-3 h-6 w-6 items-center justify-center rounded-md border ${
          item.done
            ? "border-sage-500 bg-sage-500"
            : "border-sage-300 dark:border-sage-700"
        }`}
      >
        {item.done ? <Text className="text-xs text-white">✓</Text> : null}
      </View>
      <View className="flex-1">
        <Text
          className={`font-nunito-semibold text-base ${
            item.done
              ? "text-ink-soft line-through dark:text-ink-invmuted"
              : "text-ink dark:text-ink-inverse"
          }`}
        >
          {item.title}
        </Text>
        <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
          {item.detail}
        </Text>
      </View>
      {item.kcal ? (
        <Text className="ml-2 font-nunito-semibold text-xs text-ink-soft dark:text-ink-invmuted">
          {item.kcal} kcal
        </Text>
      ) : null}
    </Pressable>
  );
}

export function DailyPlanCard() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const plan = useDailyPlanStore((state) => state.plan);
  const loaded = useDailyPlanStore((state) => state.loaded);
  const generating = useDailyPlanStore((state) => state.generating);
  const errorKey = useDailyPlanStore((state) => state.errorKey);

  useEffect(() => {
    loadTodayPlan();
  }, []);

  const dateLabel = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
  });

  const meals = plan?.items.filter((item) => item.kind === "meal") ?? [];
  const exercises =
    plan?.items.filter((item) => item.kind === "exercise") ?? [];
  const doneCount = plan?.items.filter((item) => item.done).length ?? 0;
  const total = plan?.items.length ?? 0;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <View className="mt-4 rounded-card bg-white p-5 dark:bg-nightSurface">
      <View className="flex-row items-baseline justify-between">
        <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
          {t("dailyPlan.title")}
        </Text>
        <Text className="font-nunito text-sm capitalize text-ink-soft dark:text-ink-invmuted">
          {dateLabel}
        </Text>
      </View>

      {!loaded ? (
        <View className="items-center py-6">
          <ActivityIndicator color={tokens.colors.sage[500]} />
        </View>
      ) : !plan ? (
        <>
          <Text className="mb-4 mt-2 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
            {t("dailyPlan.empty")}
          </Text>
          {generating ? (
            <GeneratingIndicator />
          ) : (
            <Button title={t("dailyPlan.generate")} onPress={generateTodayPlan} />
          )}
        </>
      ) : (
        <>
          <View className="mt-3 h-2 overflow-hidden rounded-full bg-sage-100 dark:bg-sage-900">
            <View
              className="h-2 rounded-full bg-sage-500"
              style={{ width: `${progress}%` }}
            />
          </View>
          <Text className="mt-1 font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
            {t("dailyPlan.progress", { percent: progress })}
          </Text>

          <Text className="mt-4 font-nunito-bold text-sm uppercase tracking-wide text-sage-700 dark:text-sage-300">
            {t("dailyPlan.meals")}
          </Text>
          {meals.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}

          <Text className="mt-3 font-nunito-bold text-sm uppercase tracking-wide text-sage-700 dark:text-sage-300">
            {t("dailyPlan.exercises")}
          </Text>
          {exercises.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}

          {generating ? (
            <GeneratingIndicator />
          ) : doneCount === total ? (
            // Celebration: the banner springs in when the last item is checked.
            // Reanimated views drop className on web; style the banner inline.
            <Animated.View
              entering={ZoomIn.springify().damping(12)}
              style={{
                marginTop: 12,
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: dark
                  ? tokens.colors.sage[900]
                  : tokens.colors.sage[100],
              }}
            >
              <Text className="text-center font-nunito-semibold text-sm text-sage-700 dark:text-sage-300">
                {t("dailyPlan.allDone")}
              </Text>
            </Animated.View>
          ) : (
            <>
              <Button
                title={
                  doneCount > 0
                    ? t("dailyPlan.regenerateRemaining")
                    : t("dailyPlan.regenerate")
                }
                onPress={generateTodayPlan}
                variant="ghost"
              />
              {doneCount > 0 ? (
                <Text className="text-center font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
                  {t("dailyPlan.keptNote")}
                </Text>
              ) : null}
            </>
          )}
        </>
      )}

      {errorKey ? (
        <Text className="mt-2 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
          {t(errorKey)}
        </Text>
      ) : null}
    </View>
  );
}
