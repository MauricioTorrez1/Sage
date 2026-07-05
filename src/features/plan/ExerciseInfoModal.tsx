import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { WgerExercise } from "@/lib/wger";
import { fetchWgerExercise } from "@/lib/wger";
import { tokens } from "@/theme/tokens";

type ExerciseInfoModalProps = {
  /** wger exercise ID to show, or null to keep the modal closed. */
  exerciseId: number | null;
  /** The plan item title, shown while the sheet loads. */
  title: string;
  onClose: () => void;
};

/** Exercise sheet (image + instructions) fetched lazily from wger. */
export function ExerciseInfoModal({
  exerciseId,
  title,
  onClose,
}: ExerciseInfoModalProps) {
  const { t } = useTranslation();
  const [exercise, setExercise] = useState<WgerExercise | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (exerciseId === null) return;
    let cancelled = false;
    setExercise(null);
    setFailed(false);
    fetchWgerExercise(exerciseId)
      .then((result) => {
        if (cancelled) return;
        if (result) setExercise(result);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  return (
    <Modal
      visible={exerciseId !== null}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-cream dark:bg-night">
        {/* Extra top space: the Dynamic Island / floating button on recent
            iPhones overlaps the first line of slide-in modals. */}
        <ScrollView className="flex-1" contentContainerClassName="px-6 pb-6 pt-14">
          <Text className="font-nunito-extrabold text-2xl text-ink dark:text-ink-inverse">
            {exercise?.name ?? title}
          </Text>

          {!exercise && !failed ? (
            <View className="items-center py-10">
              <ActivityIndicator
                size="large"
                color={tokens.colors.sage[500]}
              />
              <Text className="mt-3 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                {t("dailyPlan.infoLoading")}
              </Text>
            </View>
          ) : null}

          {failed ? (
            <Text className="mt-4 font-nunito text-base text-ink-muted dark:text-ink-invmuted">
              {t("dailyPlan.infoError")}
            </Text>
          ) : null}

          {exercise ? (
            <>
              {exercise.imageUrl ? (
                <View className="mt-4 overflow-hidden rounded-card bg-white dark:bg-nightSurface">
                  <Image
                    source={{ uri: exercise.imageUrl }}
                    style={{ width: "100%", aspectRatio: 4 / 3 }}
                    contentFit="contain"
                    transition={200}
                  />
                </View>
              ) : null}
              {exercise.description ? (
                <Text className="mt-4 font-nunito text-base leading-6 text-ink dark:text-ink-inverse">
                  {exercise.description}
                </Text>
              ) : null}
              <Text className="mt-4 font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
                {t("dailyPlan.infoCredit")}
              </Text>
            </>
          ) : null}
        </ScrollView>
        <View className="px-6 pb-4">
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="items-center rounded-button bg-sage-500 py-3.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="font-nunito-bold text-base text-white">
              {t("dailyPlan.infoClose")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
