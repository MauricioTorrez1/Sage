import { create } from "zustand";

import { weekStartKey } from "@/features/food/shopping-store";
import { invokeErrorInfo } from "@/lib/functions";
import { supabase } from "@/lib/supabase";

export type WeeklyReview = {
  id: string;
  week_start: string;
  feeling: string | null;
  summary: string;
  meals_done: number;
  meals_total: number;
  exercises_done: number;
  exercises_total: number;
  created_at: string;
};

type WeeklyReviewState = {
  /** This week's review, once fetched (or generated). */
  review: WeeklyReview | null;
  /** True once this week's row (or its absence) has been fetched. */
  loaded: boolean;
  generating: boolean;
  errorKey: string | null;
  errorHours: number | null;
};

export const useWeeklyReviewStore = create<WeeklyReviewState>(() => ({
  review: null,
  loaded: false,
  generating: false,
  errorKey: null,
  errorHours: null,
}));

/** Fetches this week's check-in if any. Safe to call repeatedly. */
export async function loadWeeklyReview() {
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("week_start", weekStartKey())
    .maybeSingle();

  useWeeklyReviewStore.setState({
    review: error ? null : (data as WeeklyReview | null),
    loaded: true,
  });
}

/**
 * Asks the coach for this week's check-in. `feeling` is an optional note on
 * how the week went; `includePhotos` opts the latest progress-photo analysis
 * into the review. Overwrites any existing review for the week.
 */
export async function generateWeeklyReview(
  feeling: string,
  includePhotos: boolean,
) {
  if (useWeeklyReviewStore.getState().generating) return;
  useWeeklyReviewStore.setState({
    generating: true,
    errorKey: null,
    errorHours: null,
  });

  const invoke = () =>
    supabase.functions.invoke("coach", {
      body: {
        type: "weekly_review",
        week_start: weekStartKey(),
        feeling,
        include_photos: includePhotos,
      },
    });

  let { data, error } = await invoke();
  let info = error ? await invokeErrorInfo(error) : null;

  // A single silent retry for transient server hiccups (not rate limits).
  if ((error || !data?.review) && info?.status !== 429) {
    ({ data, error } = await invoke());
    info = error ? await invokeErrorInfo(error) : null;
  }

  if (error || !data?.review) {
    useWeeklyReviewStore.setState({
      generating: false,
      errorKey:
        info?.status === 429
          ? "coach.errors.busy"
          : "review.errors.generate",
      errorHours: info?.hoursLeft,
    });
    return;
  }

  useWeeklyReviewStore.setState({
    review: data.review as WeeklyReview,
    generating: false,
  });
}

/** Clears cached review state; call on sign-out. */
export function resetWeeklyReview() {
  useWeeklyReviewStore.setState({
    review: null,
    loaded: false,
    generating: false,
    errorKey: null,
    errorHours: null,
  });
}
