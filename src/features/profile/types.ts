export type Sex = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type Goal = "lose_weight" | "maintain" | "gain_muscle";

export type BodyType = "ectomorph" | "mesomorph" | "endomorph";

export type TrainingPlace = "home" | "gym";

/** Row shape of public.profiles (snake_case, straight from Supabase). */
export type Profile = {
  id: string;
  display_name: string | null;
  age: number | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  food_notes: string | null;
  supplements: string | null;
  body_type: BodyType | null;
  training_minutes_per_day: number | null;
  training_days_per_week: number | null;
  training_place: TrainingPlace | null;
  weekly_food_budget_mxn: number | null;
  injuries: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};
