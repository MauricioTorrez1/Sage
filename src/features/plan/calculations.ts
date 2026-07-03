import type { ActivityLevel, Goal, Profile } from "@/features/profile/types";

export type NutritionPlan = {
  /** Daily energy target, kcal. */
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

/** Standard TDEE multipliers over BMR. */
const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Gentle adjustments: Sage never prescribes aggressive deficits. */
const GOAL_FACTOR: Record<Goal, number> = {
  lose_weight: 0.85,
  maintain: 1,
  gain_muscle: 1.1,
};

/** Protein targets in g per kg of body weight, by goal. */
const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose_weight: 2.0,
  maintain: 1.6,
  gain_muscle: 1.8,
};

/** Safety floor: never recommend eating below this. */
const MIN_CALORIES = 1200;

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

/**
 * Daily calories and macros from a completed profile.
 * BMR via Mifflin-St Jeor, scaled by activity, adjusted by goal.
 * Fat is 30% of calories; carbs take the remainder.
 * Returns null while any required profile field is missing.
 */
export function calculatePlan(profile: Profile): NutritionPlan | null {
  const { age, sex, height_cm, weight_kg, activity_level, goal } = profile;
  if (!age || !sex || !height_cm || !weight_kg || !activity_level || !goal) {
    return null;
  }

  const bmr =
    10 * weight_kg +
    6.25 * height_cm -
    5 * age +
    (sex === "male" ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTOR[activity_level];
  const calories = Math.max(
    MIN_CALORIES,
    roundTo(tdee * GOAL_FACTOR[goal], 50),
  );

  const proteinG = roundTo(weight_kg * PROTEIN_G_PER_KG[goal], 5);
  const fatG = roundTo((calories * 0.3) / 9, 5);
  const carbsG = Math.max(
    0,
    roundTo((calories - proteinG * 4 - fatG * 9) / 4, 5),
  );

  return { calories, proteinG, fatG, carbsG };
}
