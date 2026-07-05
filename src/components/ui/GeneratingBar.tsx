import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { tokens } from "@/theme/tokens";

type GeneratingBarProps = {
  /** i18n keys for the rotating status messages. */
  messageKeys: readonly string[];
};

/**
 * Indeterminate progress bar for AI generations. The API gives no real
 * progress signal, so the bar runs two legs — a lively climb to 60%, then
 * a slow crawl toward 95% that covers a 30–90 s generation (plus one
 * silent retry) — and the caller swaps it out when the response lands.
 */
export function GeneratingBar({ messageKeys }: GeneratingBarProps) {
  const { t } = useTranslation();
  const progress = useSharedValue(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    progress.value = withSequence(
      withTiming(0.6, { duration: 8000, easing: Easing.out(Easing.cubic) }),
      withTiming(0.95, { duration: 80000, easing: Easing.out(Easing.quad) }),
    );
    const interval = setInterval(
      () => setMessageIndex((index) => (index + 1) % messageKeys.length),
      4000,
    );
    return () => clearInterval(interval);
  }, [progress, messageKeys.length]);

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
        {t(messageKeys[messageIndex])}
      </Text>
    </View>
  );
}
