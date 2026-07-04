import { create } from "zustand";

import { supabase } from "@/lib/supabase";

export type DailyPlanItem = {
  id: string;
  kind: "meal" | "exercise";
  title: string;
  detail: string;
  kcal?: number;
  done: boolean;
};

export type DailyPlan = {
  id: string;
  plan_date: string;
  items: DailyPlanItem[];
};

type DailyPlanState = {
  plan: DailyPlan | null;
  /** True once today's row (or its absence) has been fetched. */
  loaded: boolean;
  generating: boolean;
  errorKey: string | null;
};

export const useDailyPlanStore = create<DailyPlanState>(() => ({
  plan: null,
  loaded: false,
  generating: false,
  errorKey: null,
}));

/** Local device date as YYYY-MM-DD ("en-CA" formats exactly that way). */
export function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

/** Fetches today's plan if any. Safe to call repeatedly. */
export async function loadTodayPlan() {
  const { data, error } = await supabase
    .from("daily_plans")
    .select("id, plan_date, items")
    .eq("plan_date", todayKey())
    .maybeSingle();

  useDailyPlanStore.setState({
    plan: error ? null : (data as DailyPlan | null),
    loaded: true,
  });
}

/** Asks the coach function to generate (or regenerate) today's checklist. */
export async function generateTodayPlan() {
  if (useDailyPlanStore.getState().generating) return;
  useDailyPlanStore.setState({ generating: true, errorKey: null });

  const invoke = () =>
    supabase.functions.invoke("coach", {
      body: { type: "daily_plan", date: todayKey() },
    });

  const isBusy = (e: unknown) =>
    (e as { context?: Response })?.context?.status === 429;

  let { data, error } = await invoke();

  // Server hiccups (timeouts, truncated output) resolve on a fresh attempt
  // far more often than not; retry once before bothering the user. A 429
  // means the function is rate limited — retrying immediately won't help.
  if ((error || !data?.plan) && !isBusy(error)) {
    ({ data, error } = await invoke());
  }

  if (error || !data?.plan) {
    useDailyPlanStore.setState({
      generating: false,
      errorKey: isBusy(error) ? "coach.errors.busy" : "dailyPlan.errors.generate",
    });
    return;
  }

  useDailyPlanStore.setState({
    plan: data.plan as DailyPlan,
    generating: false,
  });
}

/** Optimistically toggles an item and persists the whole items array. */
export async function toggleItem(itemId: string) {
  const { plan, generating } = useDailyPlanStore.getState();
  // While regenerating, the server is reading the current checkmarks;
  // toggling now would race with the merge it is about to write.
  if (!plan || generating) return;

  const previous = plan.items;
  const items = plan.items.map((item) =>
    item.id === itemId ? { ...item, done: !item.done } : item,
  );
  useDailyPlanStore.setState({ plan: { ...plan, items } });

  const { error } = await supabase
    .from("daily_plans")
    .update({ items })
    .eq("id", plan.id);

  if (error) {
    // Roll back so the UI never lies about what's saved.
    useDailyPlanStore.setState({
      plan: { ...plan, items: previous },
      errorKey: "dailyPlan.errors.save",
    });
  }
}

/** Clears cached plan state; call on sign-out. */
export function resetDailyPlan() {
  useDailyPlanStore.setState({
    plan: null,
    loaded: false,
    generating: false,
    errorKey: null,
  });
}
