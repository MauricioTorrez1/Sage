import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { AuthLayout } from "@/components/ui/AuthLayout";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authErrorKey } from "@/features/auth/errors";
import { fieldErrors } from "@/features/auth/form";
import { forgotPasswordSchema } from "@/features/auth/schemas";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    setFormError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
    );
    setLoading(false);
    if (error) {
      setFormError(t(authErrorKey(error)));
      return;
    }
    router.push({
      pathname: "/reset-password",
      params: { email: parsed.data.email },
    });
  }

  return (
    <AuthLayout
      title={t("auth.forgotTitle")}
      subtitle={t("auth.forgotSubtitle")}
    >
      <TextField
        label={t("auth.email")}
        placeholder={t("auth.emailPlaceholder")}
        value={email}
        onChangeText={setEmail}
        error={errors.email ? t(errors.email) : undefined}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      {formError ? (
        <Text className="mb-4 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
          {formError}
        </Text>
      ) : null}

      <Button
        title={t("auth.sendCode")}
        onPress={handleSendCode}
        loading={loading}
      />
      <Button
        title={t("auth.backToLogin")}
        onPress={() => router.back()}
        variant="ghost"
      />
    </AuthLayout>
  );
}
