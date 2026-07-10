import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import type { MealReminder, ReminderPrefs } from "./store";
import {
  newMealReminderId,
  setReminderPrefs,
  useRemindersStore,
} from "./store";

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

function MealReminderRow({
  meal,
  onChange,
  onRemove,
}: {
  meal: MealReminder;
  onChange: (partial: Partial<MealReminder>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="rounded-button border border-sage-200 bg-white px-4 py-3.5 dark:border-sage-800 dark:bg-nightSurface">
      <View className="flex-row items-center justify-between">
        <TextInput
          className="mr-3 flex-1 font-nunito-bold text-base text-ink dark:text-ink-inverse"
          placeholder={t("reminders.mealLabelPlaceholder")}
          value={meal.label}
          onChangeText={(label) => onChange({ label })}
          maxLength={30}
        />
        <Switch
          value={meal.enabled}
          onValueChange={(enabled) => onChange({ enabled })}
        />
      </View>
      {meal.enabled ? (
        <TimePicker
          hour={meal.hour}
          minute={meal.minute}
          onHourChange={(hour) => onChange({ hour })}
          onMinuteChange={(minute) => onChange({ minute })}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onRemove}
        className="mt-2 self-start"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text className="font-nunito-semibold text-sm text-terracotta-600 dark:text-terracotta-300">
          {t("reminders.mealRemove")}
        </Text>
      </Pressable>
    </View>
  );
}

/** expo WEEKLY weekday: 1=Sunday … 7=Saturday; index = weekday - 1. */
const WEEKDAY_SHORT = ["D", "L", "M", "M", "J", "V", "S"];

function WeekdayPicker({
  weekday,
  onChange,
}: {
  weekday: number;
  onChange: (weekday: number) => void;
}) {
  return (
    <View className="mt-3 flex-row justify-center gap-1.5">
      {WEEKDAY_SHORT.map((short, index) => {
        const value = index + 1;
        const active = value === weekday;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            onPress={() => onChange(value)}
            className={`h-9 w-9 items-center justify-center rounded-full ${
              active ? "bg-sage-500" : "bg-sage-100 dark:bg-sage-800"
            }`}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text
              className={`font-nunito-bold text-sm ${
                active
                  ? "text-white"
                  : "text-sage-800 dark:text-sage-100"
              }`}
            >
              {short}
            </Text>
          </Pressable>
        );
      })}
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

  function addMeal() {
    update({
      mealReminders: [
        ...prefs.mealReminders,
        {
          id: newMealReminderId(),
          label: "",
          hour: 9,
          minute: 0,
          enabled: true,
        },
      ],
    });
  }

  function changeMeal(id: string, partial: Partial<MealReminder>) {
    update({
      mealReminders: prefs.mealReminders.map((meal) =>
        meal.id === id ? { ...meal, ...partial } : meal,
      ),
    });
  }

  function removeMeal(id: string) {
    update({
      mealReminders: prefs.mealReminders.filter((meal) => meal.id !== id),
    });
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

      <Text className="mb-2 mt-4 font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
        {t("reminders.mealsTitle")}
      </Text>
      <View className="gap-2">
        {prefs.mealReminders.map((meal) => (
          <MealReminderRow
            key={meal.id}
            meal={meal}
            onChange={(partial) => changeMeal(meal.id, partial)}
            onRemove={() => removeMeal(meal.id)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={addMeal}
          className="items-center rounded-button border border-dashed border-sage-300 py-3 dark:border-sage-700"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text className="font-nunito-semibold text-sm text-sage-700 dark:text-sage-200">
            {t("reminders.mealAdd")}
          </Text>
        </Pressable>
      </View>

      <Text className="mb-2 mt-4 font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
        {t("reminders.photoSectionTitle")}
      </Text>
      <View className="rounded-button border border-sage-200 bg-white px-4 py-3.5 dark:border-sage-800 dark:bg-nightSurface">
        <View className="flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <Text className="font-nunito-bold text-base text-ink dark:text-ink-inverse">
              {t("reminders.photoLabel")}
            </Text>
            <Text className="mt-0.5 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
              {t("reminders.photoHint")}
            </Text>
          </View>
          <Switch
            value={prefs.weeklyPhoto.enabled}
            onValueChange={(enabled) =>
              update({ weeklyPhoto: { ...prefs.weeklyPhoto, enabled } })
            }
          />
        </View>
        {prefs.weeklyPhoto.enabled ? (
          <>
            <WeekdayPicker
              weekday={prefs.weeklyPhoto.weekday}
              onChange={(weekday) =>
                update({ weeklyPhoto: { ...prefs.weeklyPhoto, weekday } })
              }
            />
            <TimePicker
              hour={prefs.weeklyPhoto.hour}
              minute={prefs.weeklyPhoto.minute}
              onHourChange={(hour) =>
                update({ weeklyPhoto: { ...prefs.weeklyPhoto, hour } })
              }
              onMinuteChange={(minute) =>
                update({ weeklyPhoto: { ...prefs.weeklyPhoto, minute } })
              }
            />
          </>
        ) : null}
      </View>

      {denied ? (
        <Text className="mt-1.5 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
          {t("reminders.permissionDenied")}
        </Text>
      ) : null}
    </View>
  );
}
