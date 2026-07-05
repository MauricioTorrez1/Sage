import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, Switch, Text, View } from "react-native";

import type { ReminderPrefs } from "./store";
import { setReminderPrefs, useRemindersStore } from "./store";

type RowProps = {
  label: string;
  hint: string;
  enabled: boolean;
  hour: number;
  onToggle: (enabled: boolean) => void;
  onHourChange: (hour: number) => void;
};

function HourStepper({
  hour,
  onChange,
}: {
  hour: number;
  onChange: (hour: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityLabel={t("reminders.hourA11y")}
      className="mt-3 flex-row items-center justify-center gap-5"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("reminders.earlier")}
        onPress={() => onChange((hour + 23) % 24)}
        className="h-10 w-10 items-center justify-center rounded-full bg-sage-100 dark:bg-sage-800"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Text className="font-nunito-bold text-xl text-sage-800 dark:text-sage-100">
          −
        </Text>
      </Pressable>
      <Text className="w-20 text-center font-nunito-bold text-xl text-ink dark:text-ink-inverse">
        {String(hour).padStart(2, "0")}:00
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("reminders.later")}
        onPress={() => onChange((hour + 1) % 24)}
        className="h-10 w-10 items-center justify-center rounded-full bg-sage-100 dark:bg-sage-800"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Text className="font-nunito-bold text-xl text-sage-800 dark:text-sage-100">
          +
        </Text>
      </Pressable>
    </View>
  );
}

function ReminderRow({
  label,
  hint,
  enabled,
  hour,
  onToggle,
  onHourChange,
}: RowProps) {
  return (
    <View className="rounded-button border border-sage-200 bg-white px-4 py-3.5 dark:border-sage-800 dark:bg-nightSurface">
      <View className="flex-row items-center justify-between">
        <View className="mr-3 flex-1">
          <Text className="font-nunito-bold text-base text-ink dark:text-ink-inverse">
            {label}
          </Text>
          <Text className="mt-0.5 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
            {hint}
          </Text>
        </View>
        <Switch value={enabled} onValueChange={onToggle} />
      </View>
      {enabled ? <HourStepper hour={hour} onChange={onHourChange} /> : null}
    </View>
  );
}

/** Device-local daily reminders; hidden on web (no local notifications). */
export function RemindersCard() {
  const { t } = useTranslation();
  const prefs = useRemindersStore();
  const [denied, setDenied] = useState(false);

  if (Platform.OS === "web") return null;

  async function update(partial: Partial<ReminderPrefs>) {
    const ok = await setReminderPrefs(partial);
    setDenied(!ok);
  }

  return (
    <View className="mb-4">
      <Text className="mb-1 font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
        {t("reminders.title")}
      </Text>
      <Text className="mb-2 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
        {t("reminders.subtitle")}
      </Text>
      <View className="gap-2">
        <ReminderRow
          label={t("reminders.morningLabel")}
          hint={t("reminders.morningHint")}
          enabled={prefs.morningEnabled}
          hour={prefs.morningHour}
          onToggle={(morningEnabled) => update({ morningEnabled })}
          onHourChange={(morningHour) => update({ morningHour })}
        />
        <ReminderRow
          label={t("reminders.eveningLabel")}
          hint={t("reminders.eveningHint")}
          enabled={prefs.eveningEnabled}
          hour={prefs.eveningHour}
          onToggle={(eveningEnabled) => update({ eveningEnabled })}
          onHourChange={(eveningHour) => update({ eveningHour })}
        />
      </View>
      {denied ? (
        <Text className="mt-1.5 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
          {t("reminders.permissionDenied")}
        </Text>
      ) : null}
    </View>
  );
}
