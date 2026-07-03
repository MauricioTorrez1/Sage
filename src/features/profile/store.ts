import { create } from "zustand";

import { supabase } from "@/lib/supabase";

import type { OnboardingInput } from "./schemas";
import type { Profile } from "./types";

type ProfileState = {
  profile: Profile | null;
  /** True once the initial fetch for the current user has finished. */
  loaded: boolean;
};

export const useProfileStore = create<ProfileState>(() => ({
  profile: null,
  loaded: false,
}));

/** Fetches the signed-in user's profile row (created by DB trigger on signup). */
export async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  useProfileStore.setState({ profile: data as Profile, loaded: true });
}

/** Saves the onboarding answers and stamps onboarded_at. */
export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName,
      age: input.age,
      sex: input.sex,
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      activity_level: input.activityLevel,
      goal: input.goal,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  useProfileStore.setState({ profile: data as Profile });
}

/** Clears cached profile state; call when the user signs out. */
export function resetProfile() {
  useProfileStore.setState({ profile: null, loaded: false });
}
