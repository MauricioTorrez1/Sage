import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-night">
      <View className="flex-1 items-center justify-center px-6">
        <Animated.View
          entering={FadeInDown.duration(600)}
          className="h-28 w-28 items-center justify-center rounded-full bg-sage-100 dark:bg-sage-800"
        >
          <Text className="text-5xl">🌿</Text>
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.duration(600).delay(150)}
          className="mt-6 font-nunito-extrabold text-5xl text-ink dark:text-ink-inverse"
        >
          {t("welcome.appName")}
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.duration(600).delay(300)}
          className="mt-3 text-center font-nunito-semibold text-lg text-ink-muted dark:text-ink-invmuted"
        >
          {t("welcome.tagline")}
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.duration(600).delay(400)}
          className="mt-2 text-center font-nunito text-base text-ink-soft dark:text-ink-invmuted"
        >
          {t("welcome.subtitle")}
        </Animated.Text>
      </View>

      <Animated.View
        entering={FadeInUp.duration(600).delay(550)}
        className="px-6 pb-10"
      >
        <Pressable
          accessibilityRole="button"
          className="items-center rounded-button bg-terracotta-500 py-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <Text className="font-nunito-bold text-lg text-white">
            {t("welcome.cta")}
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
