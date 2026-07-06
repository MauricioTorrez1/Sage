import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

type KcalBarProps = {
  /** kcal of today's checked-off meals. */
  consumed: number;
  /** Daily calorie objective. */
  target: number;
};

/**
 * Today's calories vs. the daily objective, with a gentle status line:
 * how much room is left, a heads-up near the target, and a no-guilt note
 * when a logged meal pushed the day over.
 */
export function KcalBar({ consumed, target }: KcalBarProps) {
  const { t } = useTranslation();
  if (target <= 0) return null;

  const ratio = consumed / target;
  const over = ratio > 1;
  const statusKey =
    consumed === 0
      ? "progress.kcalStart"
      : over
        ? "progress.kcalOver"
        : ratio >= 0.9
          ? "progress.kcalNear"
          : "progress.kcalLeft";
  const kcal = Math.round(Math.abs(target - consumed));

  return (
    <View className="mt-4">
      <View className="flex-row items-baseline justify-between">
        <Text className="font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
          {t("progress.kcalTitle")}
        </Text>
        <Text
          className={`font-nunito-bold text-sm ${
            over
              ? "text-terracotta-600 dark:text-terracotta-300"
              : "text-ink dark:text-ink-inverse"
          }`}
        >
          {t("progress.kcalCount", { consumed: Math.round(consumed), target })}
        </Text>
      </View>
      <View className="mt-2 h-3 overflow-hidden rounded-full bg-sage-100 dark:bg-sage-900">
        <View
          className={`h-3 rounded-full ${
            over ? "bg-terracotta-500" : "bg-sage-500"
          }`}
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </View>
      <Text className="mt-2 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
        {t(statusKey, { kcal })}
      </Text>
    </View>
  );
}
