import { z } from "zod";

/** Parses TextInput text into a bounded number ("70,5" also works). */
function numberField(min: number, max: number, errorKey: string) {
  return z
    .string()
    .trim()
    .transform((value) => Number(value.replace(",", ".")))
    .pipe(z.number({ error: errorKey }).min(min, { error: errorKey }).max(max, { error: errorKey }));
}

export const aboutYouSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, { error: "onboarding.errors.name" })
    .max(40, { error: "onboarding.errors.name" }),
  age: numberField(13, 120, "onboarding.errors.age").pipe(
    z.int({ error: "onboarding.errors.age" }),
  ),
  sex: z.enum(["male", "female"], { error: "onboarding.errors.sex" }),
});

export const bodySchema = z.object({
  heightCm: numberField(90, 250, "onboarding.errors.height").pipe(
    z.int({ error: "onboarding.errors.height" }),
  ),
  weightKg: numberField(30, 300, "onboarding.errors.weight"),
  activityLevel: z.enum(
    ["sedentary", "light", "moderate", "active", "very_active"],
    { error: "onboarding.errors.activity" },
  ),
});

export const goalSchema = z.object({
  goal: z.enum(["lose_weight", "maintain", "gain_muscle"], {
    error: "onboarding.errors.goal",
  }),
  foodNotes: z
    .string()
    .trim()
    .max(500, { error: "onboarding.errors.foodNotes" }),
});

export type AboutYouInput = z.infer<typeof aboutYouSchema>;
export type BodyInput = z.infer<typeof bodySchema>;
export type GoalInput = z.infer<typeof goalSchema>;

export type OnboardingInput = AboutYouInput & BodyInput & GoalInput;
