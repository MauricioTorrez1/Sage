import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/features/auth/store";
import { useProfileStore } from "@/features/profile/store";
import { AdherenceRings } from "@/features/progress/AdherenceRings";
import {
  currentStreak,
  loadStats,
  todayAdherence,
  useStatsStore,
} from "@/features/progress/stats";
import type { PhotoPose, ProgressPhoto } from "@/features/progress/store";
import {
  addPhoto,
  analyzePhoto,
  deletePhoto,
  loadPhotos,
  useProgressStore,
} from "@/features/progress/store";
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

function confirmDeletePhoto(
  t: (key: string) => string,
  photo: ProgressPhoto,
) {
  // Alert is a no-op on web; fall back to the browser confirm dialog.
  if (Platform.OS === "web") {
    if (window.confirm(t("progress.deleteConfirm"))) deletePhoto(photo);
    return;
  }
  Alert.alert(t("progress.deleteTitle"), t("progress.deleteConfirm"), [
    { text: t("progress.deleteCancel"), style: "cancel" },
    {
      text: t("progress.delete"),
      style: "destructive",
      onPress: () => deletePhoto(photo),
    },
  ]);
}

function PhotoCard({ photo }: { photo: ProgressPhoto }) {
  const { t } = useTranslation();
  const analyzingId = useProgressStore((state) => state.analyzingId);
  const deletingId = useProgressStore((state) => state.deletingId);
  const analyzing = analyzingId === photo.id;
  const deleting = deletingId === photo.id;

  const date = new Date(photo.created_at).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <View className="mb-4 overflow-hidden rounded-card bg-white dark:bg-nightSurface">
      {photo.signedUrl ? (
        <Image
          source={{ uri: photo.signedUrl }}
          style={{ width: "100%", aspectRatio: 3 / 4 }}
          contentFit="cover"
          transition={200}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("progress.delete")}
        onPress={() => confirmDeletePhoto(t, photo)}
        disabled={deleting}
        className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-black/40"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        {deleting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text className="text-base text-white">🗑</Text>
        )}
      </Pressable>
      <View className="p-4">
        <Text className="font-nunito-semibold text-sm text-ink-muted dark:text-ink-invmuted">
          {date}
          {` · ${t(POSE_LABEL_KEY[photo.pose ?? "front"])}`}
          {photo.weight_kg ? ` · ${photo.weight_kg} kg` : ""}
        </Text>
        {photo.analysis ? (
          <Text className="mt-2 font-nunito text-base text-ink dark:text-ink-inverse">
            {photo.analysis}
          </Text>
        ) : analyzing ? (
          <View className="mt-2 flex-row items-center gap-2">
            <ActivityIndicator size="small" color={tokens.colors.sage[500]} />
            <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
              {t("progress.analyzing")}
            </Text>
          </View>
        ) : (
          <Button
            title={t("progress.analyze")}
            onPress={() => analyzePhoto(photo.id)}
            variant="ghost"
          />
        )}
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const profile = useProfileStore((state) => state.profile);
  const photos = useProgressStore((state) => state.photos);
  const loaded = useProgressStore((state) => state.loaded);
  const uploading = useProgressStore((state) => state.uploading);
  const errorKey = useProgressStore((state) => state.errorKey);
  const days = useStatsStore((state) => state.days);
  const weights = useStatsStore((state) => state.weights);
  const statsLoaded = useStatsStore((state) => state.loaded);
  const [pose, setPose] = useState<PhotoPose>("front");

  useEffect(() => {
    loadPhotos();
    loadStats();
  }, []);

  const today = todayAdherence(days);
  const streak = currentStreak(days);
  const todayTotal = today ? today.mealsTotal + today.exercisesTotal : 0;
  const todayDone = today ? today.mealsDone + today.exercisesDone : 0;
  const motivationKey =
    todayTotal > 0 && todayDone === todayTotal
      ? "progress.motivationFull"
      : todayDone >= todayTotal / 2 && todayDone > 0
        ? "progress.motivationHigh"
        : todayDone > 0
          ? "progress.motivationLow"
          : "progress.motivationStart";

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
        <FlatList
          className="flex-1"
          contentContainerClassName="px-6 py-6"
          data={photos}
          keyExtractor={(photo) => photo.id}
          renderItem={({ item }) => <PhotoCard photo={item} />}
          ListHeaderComponent={
            <View className="mb-4">
              {statsLoaded ? (
                <>
                  <View className="mb-4 rounded-card bg-white p-5 dark:bg-nightSurface">
                    <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
                      {t("progress.todayTitle")}
                    </Text>
                    {today ? (
                      <>
                        <View className="mt-4">
                          <AdherenceRings
                            mealsDone={today.mealsDone}
                            mealsTotal={today.mealsTotal}
                            exercisesDone={today.exercisesDone}
                            exercisesTotal={today.exercisesTotal}
                          />
                        </View>
                        <Text className="mt-4 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                          {t(motivationKey)}
                        </Text>
                      </>
                    ) : (
                      <Text className="mt-2 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                        {t("progress.noPlanToday")}
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
              <Text className="mt-3 font-nunito text-xs text-ink-muted dark:text-ink-invmuted">
                {t("progress.privacyNote")}
              </Text>
              {errorKey ? (
                <Text className="mt-3 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
                  {t(errorKey)}
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <Text className="mt-4 font-nunito text-base text-ink-muted dark:text-ink-invmuted">
              {t("progress.empty")}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
