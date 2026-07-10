import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useAuthStore } from "@/features/auth/store";
import { loadGoal, setGoalPhoto, useGoalStore } from "./goal-store";

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [3, 4],
  quality: 0.5,
};

function Phase({ label, text }: { label: string; text: string }) {
  return (
    <View className="mt-3">
      <Text className="font-nunito-bold text-sm text-sage-700 dark:text-sage-200">
        {label}
      </Text>
      <Text className="mt-0.5 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
        {text}
      </Text>
    </View>
  );
}

/** Optional "how I want to look" goal photo + Sage's phased plan. */
export function GoalVisionCard() {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const goal = useGoalStore((state) => state.goal);
  const uploading = useGoalStore((state) => state.uploading);
  const analyzing = useGoalStore((state) => state.analyzing);
  const errorKey = useGoalStore((state) => state.errorKey);

  useEffect(() => {
    loadGoal();
  }, []);

  async function pick(fromCamera: boolean) {
    if (!session || uploading || analyzing) return;
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      useGoalStore.setState({ errorKey: "goal.errors.permission" });
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    await setGoalPhoto(session.user.id, asset.uri);
  }

  const busy = uploading || analyzing;

  return (
    <View className="mb-4 rounded-card bg-white p-5 dark:bg-nightSurface">
      <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
        {t("goal.title")}
      </Text>
      <Text className="mt-1 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
        {t("goal.subtitle")}
      </Text>

      {goal?.signedUrl ? (
        <Image
          source={{ uri: goal.signedUrl }}
          style={{ width: 120, height: 160, borderRadius: 16, marginTop: 12 }}
          contentFit="cover"
        />
      ) : null}

      {busy ? (
        <View className="mt-4 flex-row items-center">
          <ActivityIndicator />
          <Text className="ml-2 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
            {uploading ? t("goal.uploading") : t("goal.analyzing")}
          </Text>
        </View>
      ) : null}

      {!busy && goal?.assessment ? (
        <>
          <Text className="mt-4 font-nunito text-sm text-ink dark:text-ink-inverse">
            {goal.assessment}
          </Text>
          {goal.plan ? (
            <>
              <Phase label={t("goal.short")} text={goal.plan.short} />
              <Phase label={t("goal.mid")} text={goal.plan.mid} />
              <Phase label={t("goal.long")} text={goal.plan.long} />
            </>
          ) : null}
          <Text className="mt-4 font-nunito-semibold text-xs text-terracotta-600 dark:text-terracotta-300">
            {t("goal.disclaimer")}
          </Text>
        </>
      ) : null}

      {!busy ? (
        <View className="mt-4 flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => pick(false)}
            className="flex-1 items-center rounded-button bg-sage-500 py-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="font-nunito-bold text-sm text-white">
              {goal ? t("goal.change") : t("goal.upload")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => pick(true)}
            className="items-center justify-center rounded-button bg-sage-100 px-4 py-3 dark:bg-sage-800"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-lg">📷</Text>
          </Pressable>
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
