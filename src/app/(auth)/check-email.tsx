import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { AuthLayout } from "@/components/ui/AuthLayout";
import { Button } from "@/components/ui/Button";

export default function CheckEmailScreen() {
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <AuthLayout title={t("auth.checkEmailTitle")}>
      <Text className="mb-8 font-nunito text-base text-ink-muted dark:text-ink-invmuted">
        {t("auth.checkEmailBody", { email })}
      </Text>
      <Button
        title={t("auth.backToLogin")}
        onPress={() => router.replace("/login")}
      />
    </AuthLayout>
  );
}
