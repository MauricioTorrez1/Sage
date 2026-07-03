import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/features/auth/store";
import { supabase } from "@/lib/supabase";

export default function HomeScreen() {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-night">
      <View className="flex-1 justify-center px-6">
        <Text className="font-nunito-extrabold text-4xl text-ink dark:text-ink-inverse">
          {t("home.greeting")}
        </Text>
        <Text className="mt-2 font-nunito-semibold text-base text-ink-muted dark:text-ink-invmuted">
          {t("home.loggedInAs", { email: session?.user.email })}
        </Text>
        <Text className="mt-6 font-nunito text-base text-ink-muted dark:text-ink-invmuted">
          {t("home.placeholder")}
        </Text>
      </View>

      <View className="px-6 pb-10">
        <Button
          title={t("auth.logout")}
          onPress={() => supabase.auth.signOut()}
          variant="ghost"
        />
        <Text className="mt-4 text-center font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
          {t("home.disclaimer")}
        </Text>
      </View>
    </SafeAreaView>
  );
}
