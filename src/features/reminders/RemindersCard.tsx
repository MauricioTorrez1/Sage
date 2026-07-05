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
  minute: number;
  onToggle: (enabled: boolean) => void;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
};

/** Minutes step in 5s so a couple of taps span the whole hour. */
const MINUTE_STEP = 5;

function Stepper({
  value,
  decLabel,
  incLabel,
  onDec,
  onInc,
}: {
  value: string;
  decLabel: string;
  incLabel: string;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={decLabel}
        onPress={onDec}
        className="h-9 w-9 items-center justify-center rounded-full bg-sage-100 dark:bg-sage-800"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Text className="font-nunito-bold text-xl text-sage-800 dark:text-sage-100">
          −
        </Text>
      </Pressable>
      <Text className="w-8 text-center font-nunito-bold text-xl text-ink dark:text-ink-inverse">
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={incLabel}
        onPress={onInc}
        className="h-9 w-9 items-center justify-center rounded-full bg-sage-100 dark:bg-sage-800"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Text className="font-nunito-bold text-xl text-sage-800 dark:text-sage-100">
          +
        </Text>
      </Pressable>
    </View>
  );
}

function TimePicker({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: {
  hour: number;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityLabel={t("reminders.hourA11y")}
      className="mt-3 flex-row items-center justify-center gap-3"
    >
      <Stepper
        value={String(hour).padStart(2, "0")}
        decLabel={t("reminders.hourEarlier")}
        incLabel={t("reminders.hourLater")}
        onDec={() => onHourChange((hour + 23) % 24)}
        onInc={() => onHourChange((hour + 1) % 24)}
      />
      <Text className="font-nunito-bold text-xl text-ink dark:text-ink-inverse">
        :
      </Text>
      <Stepper
        value={String(minute).padStart(2, "0")}
        decLabel={t("reminders.minuteEarlier")}
        incLabel={t("reminders.minuteLater")}
        onDec={() => onMinuteChange((minute + 60 - MINUTE_STEP) % 60)}
        onInc={() => onMinuteChange((minute + MINUTE_STEP) % 60)}
      />
    </View>
  );
}

function ReminderRow({
  label,
  hint,
  enabled,
  hour,
  minute,
  onToggle,
  onHourChange,
  onMinuteChange,
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
      {enabled ? (
        <TimePicker
          hour={hour}
          minute={minute}
          onHourChange={onHourChange}
          onMinuteChange={onMinuteChange}
        />
      ) : null}
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
          minute={prefs.morningMinute}
          onToggle={(morningEnabled) => update({ morningEnabled })}
          onHourChange={(morningHour) => update({ morningHour })}
          onMinuteChange={(morningMinute) => update({ morningMinute })}
        />
        <ReminderRow
          label={t("reminders.eveningLabel")}
          hint={t("reminders.eveningHint")}
          enabled={prefs.eveningEnabled}
          hour={prefs.eveningHour}
          minute={prefs.eveningMinute}
          onToggle={(eveningEnabled) => update({ eveningEnabled })}
          onHourChange={(eveningHour) => update({ eveningHour })}
          onMinuteChange={(eveningMinute) => update({ eveningMinute })}
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
