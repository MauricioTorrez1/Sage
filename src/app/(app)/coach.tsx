import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ChatMessage } from "@/features/coach/store";
import {
  MAX_MESSAGE_CHARS,
  sendMessage,
  useCoachStore,
} from "@/features/coach/store";
import { tokens } from "@/theme/tokens";

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <View
      className={`mb-2 max-w-[85%] rounded-card px-4 py-3 ${
        mine
          ? "self-end rounded-br-md bg-sage-600"
          : "self-start rounded-bl-md bg-white dark:bg-nightSurface"
      }`}
    >
      <Text
        className={`font-nunito text-base ${
          mine ? "text-white" : "text-ink dark:text-ink-inverse"
        }`}
      >
        {message.content}
      </Text>
    </View>
  );
}

export default function CoachScreen() {
  const { t } = useTranslation();
  const messages = useCoachStore((state) => state.messages);
  const sending = useCoachStore((state) => state.sending);
  const errorKey = useCoachStore((state) => state.errorKey);
  const [draft, setDraft] = useState("");

  function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    sendMessage(text);
  }

  // Inverted list renders newest first, so reverse a copy.
  const data = [...messages].reverse();

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-night">
      <View className="flex-row items-center border-b border-sage-100 px-4 py-3 dark:border-sage-800">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("coach.back")}
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full"
        >
          <Text className="text-xl text-ink dark:text-ink-inverse">‹</Text>
        </Pressable>
        <View className="mr-2 h-9 w-9 items-center justify-center rounded-full bg-sage-100 dark:bg-sage-800">
          <Text>🌿</Text>
        </View>
        <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
          {t("coach.title")}
        </Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          className="flex-1"
          contentContainerClassName="px-4 py-4"
          inverted
          data={data}
          keyExtractor={(_, index) => String(data.length - index)}
          renderItem={({ item }) => <Bubble message={item} />}
          ListHeaderComponent={
            // With inverted lists the "header" renders at the bottom,
            // right above the input — where the typing indicator belongs.
            sending ? (
              <View className="mb-2 flex-row items-center gap-2 self-start rounded-card rounded-bl-md bg-white px-4 py-3 dark:bg-nightSurface">
                <ActivityIndicator size="small" color={tokens.colors.sage[500]} />
                <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                  {t("coach.thinking")}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            // ...and the "footer" renders at the top: the welcome bubble.
            <View className="mb-2 max-w-[85%] self-start rounded-card rounded-bl-md bg-sage-100 px-4 py-3 dark:bg-sage-800">
              <Text className="font-nunito text-base text-ink dark:text-ink-inverse">
                {t("coach.greeting")}
              </Text>
            </View>
          }
        />

        {errorKey ? (
          <Text className="px-4 pb-2 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
            {t(errorKey)}
          </Text>
        ) : null}

        <View className="flex-row items-end gap-2 border-t border-sage-100 px-4 py-3 dark:border-sage-800">
          <TextInput
            className="max-h-28 flex-1 rounded-button border border-sage-200 bg-white px-4 py-3 font-nunito text-base text-ink dark:border-sage-800 dark:bg-nightSurface dark:text-ink-inverse"
            placeholder={t("coach.inputPlaceholder")}
            placeholderTextColor={tokens.colors.ink.soft}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={MAX_MESSAGE_CHARS}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("coach.send")}
            onPress={handleSend}
            disabled={sending || !draft.trim()}
            className="h-12 w-12 items-center justify-center rounded-full bg-terracotta-500"
            style={({ pressed }) => ({
              opacity: pressed || sending || !draft.trim() ? 0.6 : 1,
            })}
          >
            <Text className="text-lg text-white">↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
