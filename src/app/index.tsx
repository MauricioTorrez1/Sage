import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedBlobs } from "@/components/ui/AnimatedBlobs";

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-night">
      <AnimatedBlobs />
      <View className="flex-1 items-center justify-center px-6">
        {/* Reanimated's Animated.* components drop className on web, so
            animations live on plain wrappers and classes on inner elements. */}
        <Animated.View entering={FadeInDown.duration(600)}>
          <View className="h-28 w-28 items-center justify-center rounded-full bg-sage-100 dark:bg-sage-800">
            <Text className="text-5xl">🌿</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(150)}>
          <Text className="mt-6 font-nunito-extrabold text-5xl leading-[56px] text-ink dark:text-ink-inverse">
            {t("welcome.appName")}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(300)}>
          <Text className="mt-3 text-center font-nunito-semibold text-lg text-ink-muted dark:text-ink-invmuted">
            {t("welcome.tagline")}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(400)}>
          <Text className="mt-2 text-center font-nunito text-base text-ink-soft dark:text-ink-invmuted">
            {t("welcome.subtitle")}
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.duration(600).delay(550)}>
        <View className="px-6 pb-10">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/register")}
            className="items-center rounded-button bg-terracotta-500 py-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text className="font-nunito-bold text-lg text-white">
              {t("welcome.cta")}
            </Text>
          </Pressable>

          <View className="mt-4 flex-row justify-center">
            <Text className="font-nunito text-base text-ink-muted dark:text-ink-invmuted">
              {t("welcome.haveAccount")}{" "}
            </Text>
            <Link href="/login" asChild>
              <Text className="font-nunito-bold text-base text-terracotta-600 dark:text-terracotta-300">
                {t("welcome.signInLink")}
              </Text>
            </Link>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
