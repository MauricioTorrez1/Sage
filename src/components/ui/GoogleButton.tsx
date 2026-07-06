import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { signInWithGoogle } from "@/features/auth/oauth";
import { tokens } from "@/theme/tokens";

/** Google's official multicolor "G". */
function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </Svg>
  );
}

type GoogleButtonProps = {
  /** Called with an i18n key when the sign-in fails (not on cancel). */
  onError: (messageKey: string) => void;
};

/** "o" divider + Google sign-in button for the auth screens. */
export function GoogleButton({ onError }: GoogleButtonProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handlePress() {
    if (loading) return;
    setLoading(true);
    const result = await signInWithGoogle();
    setLoading(false);
    // success → the auth listener redirects; cancelled → nothing to report.
    if (result === "failed") onError("auth.errors.google");
  }

  return (
    <>
      <View className="my-5 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-sage-200 dark:bg-sage-800" />
        <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
          {t("auth.or")}
        </Text>
        <View className="h-px flex-1 bg-sage-200 dark:bg-sage-800" />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        disabled={loading}
        className="flex-row items-center justify-center gap-3 rounded-button border border-sage-200 bg-white py-4 dark:border-sage-800 dark:bg-nightSurface"
        style={({ pressed }) => ({ opacity: pressed || loading ? 0.7 : 1 })}
      >
        {loading ? (
          <ActivityIndicator color={tokens.colors.sage[500]} />
        ) : (
          <>
            <GoogleLogo />
            <Text className="font-nunito-bold text-base text-ink dark:text-ink-inverse">
              {t("auth.continueWithGoogle")}
            </Text>
          </>
        )}
      </Pressable>
    </>
  );
}
