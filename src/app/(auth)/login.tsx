import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AuthLayout } from "@/components/ui/AuthLayout";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authErrorKey } from "@/features/auth/errors";
import { fieldErrors } from "@/lib/forms";
import { loginSchema } from "@/features/auth/schemas";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      setFormError(t(authErrorKey(error)));
    }
    // On success the auth listener flips the session and the root layout
    // redirects into the (app) group automatically.
  }

  return (
    <AuthLayout title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")}>
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
      <TextField
        label={t("auth.password")}
        placeholder={t("auth.passwordPlaceholder")}
        value={password}
        onChangeText={setPassword}
        error={errors.password ? t(errors.password) : undefined}
        isPassword
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
      />

      {formError ? (
        <Text className="mb-4 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
          {formError}
        </Text>
      ) : null}

      <Button title={t("auth.login")} onPress={handleLogin} loading={loading} />

      <Link href="/forgot-password" asChild>
        <Text className="mt-4 text-center font-nunito-semibold text-sm text-sage-700 dark:text-sage-300">
          {t("auth.forgotPassword")}
        </Text>
      </Link>

      <View className="mt-8 flex-row justify-center">
        <Text className="font-nunito text-base text-ink-muted dark:text-ink-invmuted">
          {t("auth.noAccount")}{" "}
        </Text>
        <Link href="/register" asChild>
          <Text className="font-nunito-bold text-base text-terracotta-600 dark:text-terracotta-300">
            {t("auth.signUpLink")}
          </Text>
        </Link>
      </View>
    </AuthLayout>
  );
}
