import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { GeneratingBar } from "@/components/ui/GeneratingBar";
import { TextField } from "@/components/ui/TextField";

import {
  generateWeeklyReview,
  loadWeeklyReview,
  useWeeklyReviewStore,
} from "./weekly-store";

const GENERATING_MESSAGES = [
  "review.generating1",
  "review.generating2",
  "review.generating3",
] as const;

/**
 * Weekly check-in: one per week. The form generates it; once done, the recap
 * lives in the Historial (not here), keeping "Tu progreso" clean. The card then
 * just confirms it's saved and won't allow another until next week.
 */
export function WeeklyReviewCard() {
  const { t } = useTranslation();
  const review = useWeeklyReviewStore((state) => state.review);
  const loaded = useWeeklyReviewStore((state) => state.loaded);
  const generating = useWeeklyReviewStore((state) => state.generating);
  const errorKey = useWeeklyReviewStore((state) => state.errorKey);
  const errorHours = useWeeklyReviewStore((state) => state.errorHours);

  const [feeling, setFeeling] = useState("");
  const [includePhotos, setIncludePhotos] = useState(false);

  useEffect(() => {
    loadWeeklyReview();
  }, []);

  return (
    <View className="mb-4 rounded-card bg-white p-5 dark:bg-nightSurface">
      <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
        {t("review.title")}
      </Text>
      <Text className="mb-3 mt-1 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
        {t("review.subtitle")}
      </Text>

      {!loaded ? null : review ? (
        // Already done this week: the recap is in the Historial; keep it clean.
        <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
          {t("review.savedToHistory")}
        </Text>
      ) : generating ? (
        <GeneratingBar messageKeys={GENERATING_MESSAGES} />
      ) : (
        <>
          <TextField
            label={t("review.feelingLabel")}
            placeholder={t("review.feelingPlaceholder")}
            value={feeling}
            onChangeText={setFeeling}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
          <View className="mb-3 flex-row items-center justify-between">
            <View className="mr-3 flex-1">
              <Text className="font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
                {t("review.includePhotos")}
              </Text>
              <Text className="mt-0.5 font-nunito text-xs text-ink-muted dark:text-ink-invmuted">
                {t("review.includePhotosHint")}
              </Text>
            </View>
            <Switch value={includePhotos} onValueChange={setIncludePhotos} />
          </View>
          <Button
            title={t("review.generate")}
            onPress={() => generateWeeklyReview(feeling.trim(), includePhotos)}
          />
        </>
      )}

      {errorKey ? (
        <Text className="mt-2 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
          {t(errorKey, { hours: errorHours ?? 0 })}
        </Text>
      ) : null}
    </View>
  );
}
