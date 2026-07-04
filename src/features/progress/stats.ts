import { create } from "zustand";

import type { DailyPlanItem } from "@/features/plan/daily-store";
import { todayKey } from "@/features/plan/daily-store";
import { supabase } from "@/lib/supabase";

export type DayAdherence = {
  /** Local date as YYYY-MM-DD. */
  date: string;
  mealsDone: number;
  mealsTotal: number;
  exercisesDone: number;
  exercisesTotal: number;
};

export type WeightPoint = {
  date: string;
  kg: number;
};

type StatsState = {
  /** Oldest first, one entry per day that has a plan. */
  days: DayAdherence[];
  /** Oldest first, one point per photo that recorded a weight. */
  weights: WeightPoint[];
  loaded: boolean;
};

export const useStatsStore = create<StatsState>(() => ({
  days: [],
  weights: [],
  loaded: false,
}));

const HISTORY_DAYS = 30;

function dateKeyDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toLocaleDateString("en-CA");
}

/**
 * Loads the adherence + weight history. Always refetches: the checklist
 * changes while the user is in the app and the queries are tiny.
 */
export async function loadStats() {
  const since = dateKeyDaysAgo(HISTORY_DAYS - 1);

  const [plansResult, photosResult] = await Promise.all([
    supabase
      .from("daily_plans")
      .select("plan_date, items")
      .gte("plan_date", since)
      .order("plan_date", { ascending: true }),
    supabase
      .from("progress_photos")
      .select("created_at, weight_kg")
      .not("weight_kg", "is", null)
      .order("created_at", { ascending: true })
      .limit(60),
  ]);

  const days = (plansResult.data ?? []).map((row) => {
    const items = (row.items ?? []) as DailyPlanItem[];
    const meals = items.filter((item) => item.kind === "meal");
    const exercises = items.filter((item) => item.kind === "exercise");
    return {
      date: row.plan_date as string,
      mealsDone: meals.filter((item) => item.done).length,
      mealsTotal: meals.length,
      exercisesDone: exercises.filter((item) => item.done).length,
      exercisesTotal: exercises.length,
    };
  });

  // One point per day: the last weight recorded that day wins.
  const weightByDate = new Map<string, number>();
  for (const photo of photosResult.data ?? []) {
    const date = new Date(photo.created_at as string).toLocaleDateString(
      "en-CA",
    );
    weightByDate.set(date, photo.weight_kg as number);
  }
  const weights = [...weightByDate.entries()].map(([date, kg]) => ({
    date,
    kg,
  }));

  useStatsStore.setState({ days, weights, loaded: true });
}

export function todayAdherence(days: DayAdherence[]): DayAdherence | null {
  return days.find((day) => day.date === todayKey()) ?? null;
}

function isComplete(day: DayAdherence) {
  const total = day.mealsTotal + day.exercisesTotal;
  const done = day.mealsDone + day.exercisesDone;
  return total > 0 && done === total;
}

/**
 * Consecutive fully-completed days. Today only counts once complete, so an
 * in-progress day never breaks yesterday's streak.
 */
export function currentStreak(days: DayAdherence[]): number {
  const byDate = new Map(days.map((day) => [day.date, day]));
  let streak = 0;
  for (let daysAgo = 0; daysAgo < HISTORY_DAYS; daysAgo++) {
    const day = byDate.get(dateKeyDaysAgo(daysAgo));
    if (day && isComplete(day)) {
      streak++;
    } else if (daysAgo === 0) {
      continue; // today is still in progress
    } else {
      break;
    }
  }
  return streak;
}

/** Clears cached stats; call on sign-out. */
export function resetStats() {
  useStatsStore.setState({ days: [], weights: [], loaded: false });
}
