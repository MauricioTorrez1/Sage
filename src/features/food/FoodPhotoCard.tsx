import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import {
  addMealFromPhoto,
  loadTodayPlan,
  useDailyPlanStore,
} from "@/features/plan/daily-store";
import { supabase } from "@/lib/supabase";
import { tokens } from "@/theme/tokens";

type FoodEstimate = {
  foods: { name: string; grams: number; kcal: number; protein_g: number }[];
  total_kcal: number;
  note: string;
};

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.7, // 0.4 was too lossy — the model misread desserts as savory
  base64: true,
};

/**
 * Food photo → estimated log. Consent-first and ephemeral: the analysis
 * happens in one request and the image is never stored anywhere.
 */
export function FoodPhotoCard() {
  const { t } = useTranslation();
  const plan = useDailyPlanStore((state) => state.plan);
  const [analyzing, setAnalyzing] = useState(false);
  const [meal, setMeal] = useState<FoodEstimate | null>(null);
  const [added, setAdded] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    loadTodayPlan();
  }, []);

  async function pick(fromCamera: boolean) {
    if (analyzing) return;
    setErrorKey(null);

    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorKey("progress.errors.permission");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;

    setAnalyzing(true);
    setMeal(null);
    setAdded(false);
    const { data, error } = await supabase.functions.invoke("coach", {
      body: {
        type: "food_photo",
        image: asset.base64,
        media_type: asset.mimeType ?? "image/jpeg",
      },
    });
    setAnalyzing(false);

    if (error || !data?.meal) {
      setErrorKey("food.errors.photo");
      return;
    }
    setMeal(data.meal as FoodEstimate);
  }

  async function handleAdd() {
    if (!meal || meal.foods.length === 0) return;
    const title =
      meal.foods.length === 1 ? meal.foods[0].name : t("food.photoMealTitle");
    const detail = meal.foods
      .map((food) => `${food.name} ~${food.grams} g`)
      .join(", ");
    const ok = await addMealFromPhoto(title, detail, meal.total_kcal);
    if (ok) setAdded(true);
    else setErrorKey("food.errors.photoAdd");
  }

  return (
    <View className="mt-4 rounded-card bg-white p-5 dark:bg-nightSurface">
      <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
        {t("food.photoTitle")}
      </Text>
      <Text className="mb-4 mt-2 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
        {t("food.photoConsent")}
      </Text>

      {analyzing ? (
        <View className="flex-row items-center gap-2 py-2">
          <ActivityIndicator size="small" color={tokens.colors.sage[500]} />
          <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
            {t("food.photoAnalyzing")}
          </Text>
        </View>
      ) : (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              title={t("progress.takePhoto")}
              onPress={() => pick(true)}
            />
          </View>
          <View className="flex-1">
            <Button
              title={t("progress.pickPhoto")}
              onPress={() => pick(false)}
            />
          </View>
        </View>
      )}

      {meal ? (
        <View className="mt-4 rounded-button border border-sage-200 p-4 dark:border-sage-800">
          {meal.foods.map((food, index) => (
            <View
              key={`${food.name}-${index}`}
              className="flex-row items-baseline justify-between py-1"
            >
              <Text className="flex-1 font-nunito-semibold text-base text-ink dark:text-ink-inverse">
                {food.name}
              </Text>
              <Text className="ml-2 font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
                ~{food.grams} g · {food.kcal} kcal · {food.protein_g} g prot
              </Text>
            </View>
          ))}
          {meal.foods.length > 0 ? (
            <Text className="mt-2 border-t border-sage-100 pt-2 font-nunito-bold text-sm text-ink dark:border-sage-800 dark:text-ink-inverse">
              {t("food.photoTotal", { kcal: meal.total_kcal })}
            </Text>
          ) : null}
          <Text className="mt-2 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
            {meal.note}
          </Text>

          {meal.foods.length > 0 ? (
            added ? (
              <Text className="mt-3 text-center font-nunito-semibold text-sm text-sage-700 dark:text-sage-300">
                {t("food.photoAdded")}
              </Text>
            ) : plan ? (
              <Button title={t("food.photoAdd")} onPress={handleAdd} variant="ghost" />
            ) : (
              <Text className="mt-3 font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
                {t("food.photoNeedsPlan")}
              </Text>
            )
          ) : null}
        </View>
      ) : null}

      {errorKey ? (
        <Text className="mt-2 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
          {t(errorKey)}
        </Text>
      ) : null}
    </View>
  );
}
