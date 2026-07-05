import { create } from "zustand";

import { invokeErrorInfo } from "@/lib/functions";
import { supabase } from "@/lib/supabase";

export type ShoppingItem = {
  id: string;
  title: string;
  quantity: string;
  est_mxn: number;
  done: boolean;
};

export type ShoppingList = {
  id: string;
  week_start: string;
  items: ShoppingItem[];
};

type ShoppingState = {
  list: ShoppingList | null;
  /** True once this week's row (or its absence) has been fetched. */
  loaded: boolean;
  generating: boolean;
  errorKey: string | null;
  /** Hours until the generation limit lifts (for coach.errors.limit). */
  errorHours: number | null;
};

export const useShoppingStore = create<ShoppingState>(() => ({
  list: null,
  loaded: false,
  generating: false,
  errorKey: null,
  errorHours: null,
}));

/** Monday of the current local week as YYYY-MM-DD. */
export function weekStartKey() {
  const date = new Date();
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - ((day + 6) % 7));
  return date.toLocaleDateString("en-CA");
}

/** Fetches this week's shopping list if any. Safe to call repeatedly. */
export async function loadShoppingList() {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select("id, week_start, items")
    .eq("week_start", weekStartKey())
    .maybeSingle();

  useShoppingStore.setState({
    list: error ? null : (data as ShoppingList | null),
    loaded: true,
  });
}

/** Asks the coach function to (re)generate this week's list. */
export async function generateShoppingList() {
  if (useShoppingStore.getState().generating) return;
  useShoppingStore.setState({
    generating: true,
    errorKey: null,
    errorHours: null,
  });

  const invoke = () =>
    supabase.functions.invoke("coach", {
      body: { type: "shopping_list", week_start: weekStartKey() },
    });

  let { data, error } = await invoke();
  let info = error ? await invokeErrorInfo(error) : null;

  // Same silent single retry as the daily plan (skip when rate limited).
  if ((error || !data?.list) && info?.status !== 429) {
    ({ data, error } = await invoke());
    info = error ? await invokeErrorInfo(error) : null;
  }

  if (error || !data?.list) {
    useShoppingStore.setState({
      generating: false,
      errorKey:
        info?.code === "limit"
          ? "coach.errors.limit"
          : info?.status === 429
            ? "coach.errors.busy"
            : "food.errors.generate",
      errorHours: info?.hoursLeft,
    });
    return;
  }

  useShoppingStore.setState({
    list: data.list as ShoppingList,
    generating: false,
  });
}

/** Optimistically toggles an item and persists the whole items array. */
export async function toggleShoppingItem(itemId: string) {
  const { list, generating } = useShoppingStore.getState();
  if (!list || generating) return;

  const previous = list.items;
  const items = list.items.map((item) =>
    item.id === itemId ? { ...item, done: !item.done } : item,
  );
  useShoppingStore.setState({ list: { ...list, items } });

  const { error } = await supabase
    .from("shopping_lists")
    .update({ items, updated_at: new Date().toISOString() })
    .eq("id", list.id);

  if (error) {
    useShoppingStore.setState({
      list: { ...list, items: previous },
      errorKey: "dailyPlan.errors.save",
    });
  }
}

/** Appends a manual item (e.g. a scanned product) to this week's list. */
export async function addShoppingItem(title: string) {
  const { list } = useShoppingStore.getState();
  if (!list) return;

  const item: ShoppingItem = {
    // Hermes lacks crypto.randomUUID; a timestamp id is unique enough here.
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    quantity: "1 pza",
    est_mxn: 0,
    done: false,
  };
  const previous = list.items;
  const items = [...list.items, item];
  useShoppingStore.setState({ list: { ...list, items } });

  const { error } = await supabase
    .from("shopping_lists")
    .update({ items, updated_at: new Date().toISOString() })
    .eq("id", list.id);

  if (error) {
    useShoppingStore.setState({
      list: { ...list, items: previous },
      errorKey: "dailyPlan.errors.save",
    });
  }
}

/** Clears cached list state; call on sign-out. */
export function resetShopping() {
  useShoppingStore.setState({
    list: null,
    loaded: false,
    generating: false,
    errorKey: null,
    errorHours: null,
  });
}
