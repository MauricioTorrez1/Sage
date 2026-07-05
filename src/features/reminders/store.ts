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

export type ReminderPrefs = {
  morningEnabled: boolean;
  /** 0-23, local time. */
  morningHour: number;
  /** 0-59, local time. */
  morningMinute: number;
  eveningEnabled: boolean;
  eveningHour: number;
  eveningMinute: number;
};

const STORAGE_KEY = "sage.reminders";

const DEFAULT_PREFS: ReminderPrefs = {
  morningEnabled: false,
  morningHour: 8,
  morningMinute: 0,
  eveningEnabled: false,
  eveningHour: 20,
  eveningMinute: 0,
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
      // Merge over defaults so prefs saved before minutes existed (no
      // *Minute field) load as :00 instead of NaN.
      const parsed = JSON.parse(saved) as Partial<ReminderPrefs>;
      useRemindersStore.setState({ ...DEFAULT_PREFS, ...parsed });
    }
  } catch {
    // Unreadable storage: stay on defaults.
  }
}

async function reschedule(prefs: ReminderPrefs): Promise<boolean> {
  if (Platform.OS === "web") return true;

  if (prefs.morningEnabled || prefs.eveningEnabled) {
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
