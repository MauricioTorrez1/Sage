import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/features/auth/store";
import { useProfileStore } from "@/features/profile/store";
import { AdherenceRings } from "@/features/progress/AdherenceRings";
import { GoalVisionCard } from "@/features/progress/GoalVisionCard";
import { purgeOldHistory } from "@/features/progress/history-store";
import {
  currentStreak,
  loadStats,
  useStatsStore,
  weekAdherence,
} from "@/features/progress/stats";
import type { PhotoPose } from "@/features/progress/store";
import { addPhoto, loadPhotos, useProgressStore } from "@/features/progress/store";
import { WeeklyReviewCard } from "@/features/progress/WeeklyReviewCard";
import { WeightTrend } from "@/features/progress/WeightTrend";
import { tokens } from "@/theme/tokens";

const POSE_LABEL_KEY: Record<PhotoPose, string> = {
  front: "progress.poseFront",
  back: "progress.poseBack",
  side: "progress.poseSide",
};
const POSES: PhotoPose[] = ["front", "back", "side"];

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [3, 4],
  quality: 0.5,
};

export default function ProgressScreen() {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const profile = useProfileStore((state) => state.profile);
  const loaded = useProgressStore((state) => state.loaded);
  const uploading = useProgressStore((state) => state.uploading);
  const analyzingId = useProgressStore((state) => state.analyzingId);
  const errorKey = useProgressStore((state) => state.errorKey);
  const days = useStatsStore((state) => state.days);
  const weights = useStatsStore((state) => state.weights);
  const statsLoaded = useStatsStore((state) => state.loaded);
  const [pose, setPose] = useState<PhotoPose>("front");

  useEffect(() => {
    loadPhotos();
    loadStats();
    // Rolling 90-day purge of archived photos/check-ins (once per day).
    purgeOldHistory();
  }, []);

  const streak = currentStreak(days);
  const week = weekAdherence(days);
  const weekTotal = week.mealsTotal + week.exercisesTotal;
  const weekClosed =
    weekTotal > 0 &&
    week.mealsDone === week.mealsTotal &&
    week.exercisesDone === week.exercisesTotal;

  async function pick(fromCamera: boolean) {
    if (!session || uploading) return;
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      useProgressStore.setState({ errorKey: "progress.errors.permission" });
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    await addPhoto(session.user.id, asset.uri, profile?.weight_kg ?? null, pose);
  }

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-night">
      <View className="flex-row items-center border-b border-sage-100 px-4 py-3 dark:border-sage-800">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("coach.back")}
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full"
        >
          <Text className="text-xl text-ink dark:text-ink-inverse">‹</Text>
        </Pressable>
        <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
          {t("progress.title")}
        </Text>
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.colors.sage[500]} />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-6 py-6">
          {statsLoaded ? (
            <>
              <View className="mb-4 rounded-card bg-white p-5 dark:bg-nightSurface">
                <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
                  {t("progress.weekTitle")}
                </Text>
                {weekTotal > 0 ? (
                  <>
                    <View className="mt-4">
                      <AdherenceRings
                        mealsDone={week.mealsDone}
                        mealsTotal={week.mealsTotal}
                        exercisesDone={week.exercisesDone}
                        exercisesTotal={week.exercisesTotal}
                      />
                    </View>
                    <Text className="mt-4 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                      {t("progress.weekComplete", { done: week.daysComplete })}
                    </Text>
                    {weekClosed ? (
                      <Text className="mt-2 font-nunito-semibold text-sm text-terracotta-600 dark:text-terracotta-300">
                        {t("progress.weekPerfect")}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text className="mt-2 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                    {t("progress.weekEmpty")}
                  </Text>
                )}
                {streak > 0 ? (
                  <Text className="mt-2 font-nunito-semibold text-sm text-terracotta-600 dark:text-terracotta-300">
                    {t("progress.streak", { count: streak })}
                  </Text>
                ) : null}
              </View>
              <View className="mb-4 rounded-card bg-white p-5 dark:bg-nightSurface">
                <Text className="mb-3 font-nunito-bold text-lg text-ink dark:text-ink-inverse">
                  {t("progress.weightTitle")}
                </Text>
                <WeightTrend weights={weights} />
              </View>
              <WeeklyReviewCard />
              <GoalVisionCard />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/history")}
                className="mb-4 flex-row items-center rounded-card bg-white p-5 dark:bg-nightSurface"
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-sage-100 dark:bg-sage-800">
                  <Text className="text-xl">🗂️</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-nunito-bold text-base text-ink dark:text-ink-inverse">
                    {t("history.entryTitle")}
                  </Text>
                  <Text className="mt-0.5 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                    {t("history.entrySubtitle")}
                  </Text>
                </View>
                <Text className="text-xl text-sage-600 dark:text-sage-300">›</Text>
              </Pressable>
            </>
          ) : null}

          {/* Pose for the NEXT photo; Sage compares same-pose photos. */}
          <Text className="mb-2 font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
            {t("progress.poseTitle")}
          </Text>
          <View className="mb-3 flex-row gap-2">
            {POSES.map((option) => {
              const selected = option === pose;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setPose(option)}
                  className={`flex-1 items-center rounded-full border px-3 py-2 ${
                    selected
                      ? "border-sage-500 bg-sage-100 dark:border-sage-400 dark:bg-sage-800"
                      : "border-sage-200 bg-white dark:border-sage-800 dark:bg-nightSurface"
                  }`}
                >
                  <Text
                    className={`text-sm text-ink dark:text-ink-inverse ${
                      selected ? "font-nunito-bold" : "font-nunito-semibold"
                    }`}
                  >
                    {t(POSE_LABEL_KEY[option])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button
                title={t("progress.takePhoto")}
                onPress={() => pick(true)}
                loading={uploading}
              />
            </View>
            <View className="flex-1">
              <Button
                title={t("progress.pickPhoto")}
                onPress={() => pick(false)}
                disabled={uploading}
              />
            </View>
          </View>
          {analyzingId ? (
            <View className="mt-3 flex-row items-center gap-2">
              <ActivityIndicator size="small" color={tokens.colors.sage[500]} />
              <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                {t("progress.analyzingToHistory")}
              </Text>
            </View>
          ) : (
            <Text className="mt-3 font-nunito text-xs text-ink-muted dark:text-ink-invmuted">
              {t("progress.photosToHistory")}
            </Text>
          )}
          <Text className="mt-2 font-nunito text-xs text-ink-muted dark:text-ink-invmuted">
            {t("progress.privacyNote")}
          </Text>
          {errorKey ? (
            <Text className="mt-3 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
              {t(errorKey)}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
