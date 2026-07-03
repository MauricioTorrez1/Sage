import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { AuthLayout } from "@/components/ui/AuthLayout";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authErrorKey } from "@/features/auth/errors";
import { fieldErrors } from "@/features/auth/form";
import { resetPasswordSchema } from "@/features/auth/schemas";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setFormError(null);
    const parsed = resetPasswordSchema.safeParse({
      code,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    // Verifying the recovery code signs the user in; the root layout will
    // redirect into the app once the session lands, so update the password
    // right away while this handler is still running.
    const { error: otpError } = await supabase.auth.verifyOtp({
      email,
      token: parsed.data.code,
      type: "recovery",
    });
    if (otpError) {
      setLoading(false);
      setFormError(t(authErrorKey(otpError)));
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    setLoading(false);
    if (updateError) {
      setFormError(t(authErrorKey(updateError)));
    }
  }

  return (
    <AuthLayout
      title={t("auth.resetTitle")}
      subtitle={t("auth.resetSubtitle", { email })}
    >
      <TextField
        label={t("auth.code")}
        placeholder={t("auth.codePlaceholder")}
        value={code}
        onChangeText={setCode}
        error={errors.code ? t(errors.code) : undefined}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />
      <TextField
        label={t("auth.newPassword")}
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
        title={t("auth.savePassword")}
        onPress={handleReset}
        loading={loading}
      />
    </AuthLayout>
  );
}
