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

function toRow(input: OnboardingInput) {
  return {
    display_name: input.displayName,
    age: input.age,
    sex: input.sex,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    activity_level: input.activityLevel,
    goal: input.goal,
    food_notes: input.foodNotes || null,
    supplements: input.supplements || null,
    body_type: input.bodyType,
    training_minutes_per_day: input.trainingMinutesPerDay,
    training_days_per_week: input.trainingDaysPerWeek,
    training_place: input.trainingPlace,
    training_equipment:
      input.trainingEquipment.length > 0 ? input.trainingEquipment : null,
    weekly_food_budget_mxn: input.weeklyBudgetMxn,
    injuries: input.injuries || null,
  };
}

async function saveProfile(userId: string, row: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("profiles")
    .update(row)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  useProfileStore.setState({ profile: data as Profile });
}

/** Saves the onboarding answers and stamps onboarded_at. */
export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
) {
  await saveProfile(userId, {
    ...toRow(input),
    onboarded_at: new Date().toISOString(),
  });
}

/** Updates an existing profile; the plan recomputes from the store. */
export async function updateProfile(userId: string, input: OnboardingInput) {
  await saveProfile(userId, toRow(input));
}

/** Clears cached profile state; call when the user signs out. */
export function resetProfile() {
  useProfileStore.setState({ profile: null, loaded: false });
}
