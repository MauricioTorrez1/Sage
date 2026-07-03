import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";

import { tokens } from "@/theme/tokens";

type TextFieldProps = TextInputProps & {
  label: string;
  /** Translated message; renders below the field and turns the border red. */
  error?: string;
  /** Adds a show/hide toggle and hides the text by default. */
  isPassword?: boolean;
};

export function TextField({
  label,
  error,
  isPassword = false,
  ...inputProps
}: TextFieldProps) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(isPassword);

  return (
    <View className="mb-4">
      <Text className="mb-2 font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
        {label}
      </Text>
      <View
        className={`flex-row items-center rounded-button border bg-white dark:bg-nightSurface ${
          error
            ? "border-terracotta-600"
            : "border-sage-200 dark:border-sage-800"
        }`}
      >
        <TextInput
          className="flex-1 px-4 py-3.5 font-nunito text-base text-ink dark:text-ink-inverse"
          placeholderTextColor={tokens.colors.ink.soft}
          secureTextEntry={hidden}
          {...inputProps}
        />
        {isPassword && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              hidden ? "auth.showPassword" : "auth.hidePassword",
            )}
            onPress={() => setHidden((value) => !value)}
            className="px-4 py-3.5"
          >
            <Text className="text-base">{hidden ? "👁️" : "🙈"}</Text>
          </Pressable>
        )}
      </View>
      {error ? (
        <Text className="mt-1.5 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
