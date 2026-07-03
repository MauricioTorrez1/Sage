import { Link, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AuthLayout } from "@/components/ui/AuthLayout";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authErrorKey } from "@/features/auth/errors";
import { fieldErrors } from "@/features/auth/form";
import { registerSchema } from "@/features/auth/schemas";
import { supabase } from "@/lib/supabase";

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setFormError(null);
    const parsed = registerSchema.safeParse({
      email,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      setFormError(t(authErrorKey(error)));
      return;
    }
    // With email confirmation on, signUp returns a user but no session:
    // send them to the "check your email" screen. If confirmation is off,
    // the session lands and the root layout redirects into the app.
    if (!data.session) {
      router.replace({
        pathname: "/check-email",
        params: { email: parsed.data.email },
      });
    }
  }

  return (
    <AuthLayout
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSubtitle")}
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
      <TextField
        label={t("auth.password")}
        placeholder={t("auth.passwordPlaceholder")}
        value={password}
        onChangeText={setPassword}
        error={errors.password ? t(errors.password) : undefined}
        isPassword
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label={t("auth.confirmPassword")}
        placeholder={t("auth.passwordPlaceholder")}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={errors.confirmPassword ? t(errors.confirmPassword) : undefined}
        isPassword
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />

      {formError ? (
        <Text className="mb-4 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
          {formError}
        </Text>
      ) : null}

      <Button
        title={t("auth.register")}
        onPress={handleRegister}
        loading={loading}
      />

      <View className="mt-8 flex-row justify-center">
        <Text className="font-nunito text-base text-ink-muted dark:text-ink-invmuted">
          {t("auth.haveAccount")}{" "}
        </Text>
        <Link href="/login" asChild>
          <Text className="font-nunito-bold text-base text-terracotta-600 dark:text-terracotta-300">
            {t("auth.signInLink")}
          </Text>
        </Link>
      </View>
    </AuthLayout>
  );
}
