import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import type { ProgressPhoto } from "./store";
import type { WeeklyReview } from "./weekly-store";

/**
 * Read-only weekly history. Each week bundles its check-in, its progress
 * photos and the weight recorded that week — the same things the live
 * "Tu progreso" screen shows for the current week, but archived and grouped
 * by year → month → week. Records roll off after a 90-day window (permanently
 * deleted, photos and all).
 */
export type WeekArchive = {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  review: WeeklyReview | null;
  photos: ProgressPhoto[];
  /** Last weight recorded that week, if any. */
  weightKg: number | null;
};

type HistoryState = {
  /** Newest week first. */
  weeks: WeekArchive[];
  loaded: boolean;
};

export const useHistoryStore = create<HistoryState>(() => ({
  weeks: [],
  loaded: false,
}));

const BUCKET = "progress-photos";
const SIGNED_URL_TTL = 3600;
const RETENTION_DAYS = 90;
const PURGE_GUARD_KEY = "sage.history.purge";

/** Monday (YYYY-MM-DD) of the week containing `date`, local time. */
export function weekStartOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d.toLocaleDateString("en-CA");
}

function cutoff() {
  const d = new Date();
  d.setDate(d.getDate() - RETENTION_DAYS);
  return {
    iso: d.toISOString(),
    day: d.toLocaleDateString("en-CA"),
  };
}

/**
 * Rolling 90-day purge: permanently deletes progress photos (files + rows) and
 * weekly reviews older than the window. Runs at most once per local day. RLS
 * scopes every delete to the caller.
 */
export async function purgeOldHistory() {
  const today = new Date().toLocaleDateString("en-CA");
  try {
    if ((await AsyncStorage.getItem(PURGE_GUARD_KEY)) === today) return;
  } catch {
    // Unreadable guard: fall through and purge anyway (idempotent).
  }

  const { iso, day } = cutoff();

  // Photos: remove Storage files first, then rows — removing an already-gone
  // object succeeds, so a failed row delete can be retried without orphans.
  const { data: oldPhotos } = await supabase
    .from("progress_photos")
    .select("id, storage_path")
    .lt("created_at", iso);
  if (oldPhotos && oldPhotos.length > 0) {
    await supabase.storage
      .from(BUCKET)
      .remove(oldPhotos.map((p) => p.storage_path as string));
    await supabase
      .from("progress_photos")
      .delete()
      .in("id", oldPhotos.map((p) => p.id as string));
  }

  // Weekly reviews for weeks that start before the window.
  await supabase.from("weekly_reviews").delete().lt("week_start", day);

  try {
    await AsyncStorage.setItem(PURGE_GUARD_KEY, today);
  } catch {
    // Best effort: worst case we purge again next load (idempotent).
  }
}

/** Loads the archived weeks (within the retention window) grouped by week. */
export async function loadHistory() {
  await purgeOldHistory();

  const { iso, day } = cutoff();

  const [reviewsRes, photosRes] = await Promise.all([
    supabase
      .from("weekly_reviews")
      .select("*")
      .gte("week_start", day)
      .order("week_start", { ascending: false }),
    supabase
      .from("progress_photos")
      .select("*")
      .gte("created_at", iso)
      .order("created_at", { ascending: false }),
  ]);

  const reviews = (reviewsRes.data ?? []) as WeeklyReview[];
  let photos = (photosRes.data ?? []) as ProgressPhoto[];

  if (photos.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(photos.map((p) => p.storage_path), SIGNED_URL_TTL);
    if (signed) {
      photos = photos.map((photo, index) => ({
        ...photo,
        signedUrl: signed[index]?.signedUrl ?? undefined,
      }));
    }
  }

  const byWeek = new Map<string, WeekArchive>();
  const ensure = (weekStart: string): WeekArchive => {
    let week = byWeek.get(weekStart);
    if (!week) {
      week = { weekStart, review: null, photos: [], weightKg: null };
      byWeek.set(weekStart, week);
    }
    return week;
  };

  for (const review of reviews) ensure(review.week_start).review = review;
  for (const photo of photos) {
    ensure(weekStartOf(new Date(photo.created_at))).photos.push(photo);
  }
  // Photos are newest-first, so the first with a weight is the latest that week.
  for (const week of byWeek.values()) {
    week.weightKg =
      week.photos.find((photo) => photo.weight_kg != null)?.weight_kg ?? null;
  }

  const weeks = [...byWeek.values()].sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart),
  );
  useHistoryStore.setState({ weeks, loaded: true });
}

/** Clears cached history; call on sign-out. */
export function resetHistory() {
  useHistoryStore.setState({ weeks: [], loaded: false });
}
