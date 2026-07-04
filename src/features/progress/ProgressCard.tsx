import { router } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { loadPhotos, useProgressStore } from "@/features/progress/store";

const PHOTO_DUE_DAYS = 7;

/** Home entry point: nudges a new photo weekly. */
export function ProgressCard() {
  const { t } = useTranslation();
  const photos = useProgressStore((state) => state.photos);
  const loaded = useProgressStore((state) => state.loaded);

  useEffect(() => {
    loadPhotos();
  }, []);

  let subtitle = t("progress.cardEmpty");
  if (loaded && photos.length > 0) {
    const days = Math.floor(
      (Date.now() - new Date(photos[0].created_at).getTime()) / 86_400_000,
    );
    subtitle =
      days >= PHOTO_DUE_DAYS
        ? t("progress.cardDue")
        : t("progress.cardRecent", { count: days });
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/progress")}
      className="mt-4 flex-row items-center rounded-card bg-terracotta-50 p-5 dark:bg-nightSurface"
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-terracotta-100 dark:bg-terracotta-900">
        <Text className="text-xl">📸</Text>
      </View>
      <View className="flex-1">
        <Text className="font-nunito-bold text-base text-terracotta-800 dark:text-terracotta-100">
          {t("progress.cardTitle")}
        </Text>
        <Text className="mt-0.5 font-nunito text-sm text-terracotta-700 dark:text-terracotta-300">
          {subtitle}
        </Text>
      </View>
      <Text className="text-xl text-terracotta-600 dark:text-terracotta-300">
        ›
      </Text>
    </Pressable>
  );
}
