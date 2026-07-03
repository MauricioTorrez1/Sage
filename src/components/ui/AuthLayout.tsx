import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/** Shared chrome for auth screens: safe area, keyboard handling, heading. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-night">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="font-nunito-extrabold text-3xl text-ink dark:text-ink-inverse">
            {title}
          </Text>
          {subtitle ? (
            <Text className="mb-8 mt-2 font-nunito text-base text-ink-muted dark:text-ink-invmuted">
              {subtitle}
            </Text>
          ) : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
