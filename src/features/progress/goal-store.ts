import { create } from "zustand";

import { supabase } from "@/lib/supabase";

export type GoalPlan = {
  short: string;
  mid: string;
  long: string;
};

export type GoalVision = {
  id: string;
  storage_path: string;
  assessment: string | null;
  plan: GoalPlan | null;
  created_at: string;
  /** Short-lived display URL for the private bucket object. */
  signedUrl?: string;
};

type GoalState = {
  goal: GoalVision | null;
  loaded: boolean;
  uploading: boolean;
  analyzing: boolean;
  errorKey: string | null;
};

export const useGoalStore = create<GoalState>(() => ({
  goal: null,
  loaded: false,
  uploading: false,
  analyzing: false,
  errorKey: null,
}));

const BUCKET = "goal-photos";
const SIGNED_URL_TTL = 3600;

async function signedUrlFor(path: string): Promise<string | undefined> {
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl;
}

/** Loads the user's goal vision (if any) + a display URL. Idempotent. */
export async function loadGoal() {
  if (useGoalStore.getState().loaded) return;

  const { data, error } = await supabase
    .from("goal_vision")
    .select("*")
    .maybeSingle();

  if (error || !data) {
    useGoalStore.setState({ loaded: true });
    return;
  }

  const goal = data as GoalVision;
  goal.signedUrl = await signedUrlFor(goal.storage_path);
  useGoalStore.setState({ goal, loaded: true });
}

/**
 * Uploads the goal photo (one per user, overwriting the previous), upserts the
 * row, then asks Sage to assess it and build the phased plan.
 */
export async function setGoalPhoto(userId: string, localUri: string) {
  if (useGoalStore.getState().uploading) return;
  useGoalStore.setState({ uploading: true, errorKey: null });

  try {
    const arraybuffer = await fetch(localUri).then((res) => res.arrayBuffer());
    const path = `${userId}/goal.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, arraybuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: row, error: upsertError } = await supabase
      .from("goal_vision")
      .upsert(
        { user_id: userId, storage_path: path, assessment: null, plan: null },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (upsertError || !row) throw upsertError ?? new Error("upsert failed");

    const goal = row as GoalVision;
    goal.signedUrl = await signedUrlFor(path);
    useGoalStore.setState({ goal, uploading: false });

    await analyzeGoal();
  } catch {
    useGoalStore.setState({
      uploading: false,
      errorKey: "goal.errors.upload",
    });
  }
}

/** Asks Sage to (re)assess the goal photo and produce the phased plan. */
export async function analyzeGoal() {
  if (useGoalStore.getState().analyzing) return;
  useGoalStore.setState({ analyzing: true, errorKey: null });

  const { data, error } = await supabase.functions.invoke("coach", {
    body: { type: "goal_vision" },
  });

  if (error || !data?.goal) {
    useGoalStore.setState({
      analyzing: false,
      errorKey: "goal.errors.analyze",
    });
    return;
  }

  useGoalStore.setState((state) => ({
    goal: {
      ...(data.goal as GoalVision),
      // Keep the display URL we already have; the server response has none.
      signedUrl: state.goal?.signedUrl,
    },
    analyzing: false,
  }));
}

/** Clears cached goal state; call on sign-out. */
export function resetGoal() {
  useGoalStore.setState({
    goal: null,
    loaded: false,
    uploading: false,
    analyzing: false,
    errorKey: null,
  });
}
