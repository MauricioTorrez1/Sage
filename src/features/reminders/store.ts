import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { create } from "zustand";

import i18n from "@/lib/i18n";

/**
 * Device-local daily reminders (Expo local notifications — remote push is
 * not available in Expo Go, local scheduling is). Preferences persist in
 * AsyncStorage; the schedule itself lives in the OS, so it survives
 * restarts and only changes when the user edits it here.
 */

/** A user-defined meal reminder ("Desayuno" at 10:00, etc.). */
export type MealReminder = {
  id: string;
  label: string;
  /** 0-23, local time. */
  hour: number;
  /** 0-59, local time. */
  minute: number;
  enabled: boolean;
};

/** Weekly nudge to upload progress photos. */
export type WeeklyPhotoReminder = {
  enabled: boolean;
  /** expo WEEKLY weekday: 1=Sunday … 7=Saturday. */
  weekday: number;
  hour: number;
  minute: number;
};

export type ReminderPrefs = {
  morningEnabled: boolean;
  /** 0-23, local time. */
  morningHour: number;
  /** 0-59, local time. */
  morningMinute: number;
  eveningEnabled: boolean;
  eveningHour: number;
  eveningMinute: number;
  /** Custom meal reminders the user adds/edits. */
  mealReminders: MealReminder[];
  weeklyPhoto: WeeklyPhotoReminder;
};

const STORAGE_KEY = "sage.reminders";

const DEFAULT_PREFS: ReminderPrefs = {
  morningEnabled: false,
  morningHour: 8,
  morningMinute: 0,
  eveningEnabled: false,
  eveningHour: 20,
  eveningMinute: 0,
  mealReminders: [],
  weeklyPhoto: {
    enabled: false,
    weekday: 2, // Monday
    hour: 9,
    minute: 0,
  },
};

export const useRemindersStore = create<ReminderPrefs>(() => DEFAULT_PREFS);

/**
 * Call once from the root layout after mount (never at module scope — the
 * static web export would touch window/AsyncStorage). Sets the foreground
 * handler and restores saved preferences.
 */
export async function initReminders() {
  if (Platform.OS === "web") return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) {
      // Merge over defaults so prefs saved before a field existed (e.g. the
      // *Minute fields, mealReminders, weeklyPhoto) load with sane values
      // instead of undefined/NaN.
      const parsed = JSON.parse(saved) as Partial<ReminderPrefs>;
      useRemindersStore.setState({
        ...DEFAULT_PREFS,
        ...parsed,
        mealReminders: Array.isArray(parsed.mealReminders)
          ? parsed.mealReminders
          : DEFAULT_PREFS.mealReminders,
        weeklyPhoto: {
          ...DEFAULT_PREFS.weeklyPhoto,
          ...(parsed.weeklyPhoto ?? {}),
        },
      });
    }
  } catch {
    // Unreadable storage: stay on defaults.
  }
}

function anyEnabled(prefs: ReminderPrefs): boolean {
  return (
    prefs.morningEnabled ||
    prefs.eveningEnabled ||
    prefs.weeklyPhoto.enabled ||
    prefs.mealReminders.some((meal) => meal.enabled)
  );
}

async function reschedule(prefs: ReminderPrefs): Promise<boolean> {
  if (Platform.OS === "web") return true;

  if (anyEnabled(prefs)) {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return false;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  if (prefs.morningEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("reminders.morningTitle"),
        body: i18n.t("reminders.morningBody"),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: prefs.morningHour,
        minute: prefs.morningMinute,
      },
    });
  }
  if (prefs.eveningEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("reminders.eveningTitle"),
        body: i18n.t("reminders.eveningBody"),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: prefs.eveningHour,
        minute: prefs.eveningMinute,
      },
    });
  }
  for (const meal of prefs.mealReminders) {
    if (!meal.enabled) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("reminders.mealTitle"),
        body: i18n.t("reminders.mealBody", {
          label: meal.label || i18n.t("reminders.mealDefaultLabel"),
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: meal.hour,
        minute: meal.minute,
      },
    });
  }
  if (prefs.weeklyPhoto.enabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("reminders.photoTitle"),
        body: i18n.t("reminders.photoBody"),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: prefs.weeklyPhoto.weekday,
        hour: prefs.weeklyPhoto.hour,
        minute: prefs.weeklyPhoto.minute,
      },
    });
  }
  return true;
}

/**
 * Merges, persists and reschedules. Returns false when the OS denied the
 * notification permission (the toggles are rolled back).
 */
export async function setReminderPrefs(partial: Partial<ReminderPrefs>) {
  const previous = useRemindersStore.getState();
  const prefs = { ...previous, ...partial };
  useRemindersStore.setState(prefs);

  const ok = await reschedule(prefs);
  if (!ok) {
    useRemindersStore.setState(previous);
    return false;
  }
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)).catch(() => {});
  return true;
}

/** Generates an id for a new meal reminder. */
export function newMealReminderId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
