import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text } from "react-native";

import { AuthLayout } from "@/components/ui/AuthLayout";
import { Button } from "@/components/ui/Button";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { TextField } from "@/components/ui/TextField";
import { useAuthStore } from "@/features/auth/store";
import {
  activityOptions,
  bodyTypeOptions,
  goalOptions,
  sexOptions,
  trainingPlaceOptions,
} from "@/features/profile/options";
import {
  aboutYouSchema,
  bodySchema,
  goalSchema,
  trainingSchema,
} from "@/features/profile/schemas";
import { updateProfile, useProfileStore } from "@/features/profile/store";
import type {
  ActivityLevel,
  BodyType,
  Goal,
  Sex,
  TrainingPlace,
} from "@/features/profile/types";
import type { ThemePreference } from "@/features/theme/store";
import { setThemePreference, useThemeStore } from "@/features/theme/store";
import { fieldErrors } from "@/lib/forms";

// Donations are optional and never gate anything; the card only renders
// when a URL is configured (Ko-fi, BuyMeACoffee, etc.).
const DONATION_URL = process.env.EXPO_PUBLIC_DONATION_URL;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const profile = useProfileStore((state) => state.profile);
  const themePreference = useThemeStore((state) => state.preference);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [age, setAge] = useState(profile?.age ? String(profile.age) : "");
  const [sex, setSex] = useState<Sex | null>(profile?.sex ?? null);
  const [heightCm, setHeightCm] = useState(
    profile?.height_cm ? String(profile.height_cm) : "",
  );
  const [weightKg, setWeightKg] = useState(
    profile?.weight_kg ? String(profile.weight_kg) : "",
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    profile?.activity_level ?? null,
  );
  const [goal, setGoal] = useState<Goal | null>(profile?.goal ?? null);
  const [bodyType, setBodyType] = useState<BodyType | null>(
    profile?.body_type ?? null,
  );
  const [trainingMinutes, setTrainingMinutes] = useState(
    profile?.training_minutes_per_day
      ? String(profile.training_minutes_per_day)
      : "",
  );
  const [trainingDays, setTrainingDays] = useState(
    profile?.training_days_per_week
      ? String(profile.training_days_per_week)
      : "",
  );
  const [trainingPlace, setTrainingPlace] = useState<TrainingPlace | null>(
    profile?.training_place ?? null,
  );
  const [injuries, setInjuries] = useState(profile?.injuries ?? "");
  const [weeklyBudget, setWeeklyBudget] = useState(
    profile?.weekly_food_budget_mxn
      ? String(profile.weekly_food_budget_mxn)
      : "",
  );
  const [foodNotes, setFoodNotes] = useState(profile?.food_notes ?? "");
  const [supplements, setSupplements] = useState(profile?.supplements ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setFormError(null);
    const aboutYou = aboutYouSchema.safeParse({ displayName, age, sex });
    const body = bodySchema.safeParse({ heightCm, weightKg, activityLevel });
    const training = trainingSchema.safeParse({
      bodyType,
      trainingMinutesPerDay: trainingMinutes,
      trainingDaysPerWeek: trainingDays,
      trainingPlace,
      injuries,
    });
    const goalParsed = goalSchema.safeParse({
      goal,
      weeklyBudgetMxn: weeklyBudget,
      foodNotes,
      supplements,
    });
    if (
      !aboutYou.success ||
      !body.success ||
      !training.success ||
      !goalParsed.success
    ) {
      setErrors({
        ...(aboutYou.success ? {} : fieldErrors(aboutYou.error)),
        ...(body.success ? {} : fieldErrors(body.error)),
        ...(training.success ? {} : fieldErrors(training.error)),
        ...(goalParsed.success ? {} : fieldErrors(goalParsed.error)),
      });
      return;
    }
    setErrors({});
    if (!session) return;
    setSaving(true);
    try {
      await updateProfile(session.user.id, {
        ...aboutYou.data,
        ...body.data,
        ...training.data,
        ...goalParsed.data,
      });
      router.back();
    } catch {
      setSaving(false);
      setFormError(t("auth.errors.generic"));
    }
  }

  return (
    <AuthLayout
      title={t("profile.title")}
      subtitle={t("profile.subtitle")}
    >
      <TextField
        label={t("onboarding.name")}
        placeholder={t("onboarding.namePlaceholder")}
        value={displayName}
        onChangeText={setDisplayName}
        error={errors.displayName ? t(errors.displayName) : undefined}
        autoComplete="name"
        textContentType="givenName"
      />
      <TextField
        label={t("onboarding.age")}
        placeholder={t("onboarding.agePlaceholder")}
        value={age}
        onChangeText={setAge}
        error={errors.age ? t(errors.age) : undefined}
        keyboardType="number-pad"
        maxLength={3}
      />
      <OptionGroup
        label={t("onboarding.sex")}
        options={sexOptions(t)}
        value={sex}
        onChange={setSex}
        error={errors.sex ? t(errors.sex) : undefined}
      />
      <TextField
        label={t("onboarding.height")}
        placeholder={t("onboarding.heightPlaceholder")}
        value={heightCm}
        onChangeText={setHeightCm}
        error={errors.heightCm ? t(errors.heightCm) : undefined}
        keyboardType="number-pad"
        maxLength={3}
      />
      <TextField
        label={t("onboarding.weight")}
        placeholder={t("onboarding.weightPlaceholder")}
        value={weightKg}
        onChangeText={setWeightKg}
        error={errors.weightKg ? t(errors.weightKg) : undefined}
        keyboardType="decimal-pad"
        maxLength={5}
      />
      <OptionGroup
        label={t("onboarding.activity")}
        options={activityOptions(t)}
        value={activityLevel}
        onChange={setActivityLevel}
        error={errors.activityLevel ? t(errors.activityLevel) : undefined}
      />
      <OptionGroup
        label={t("onboarding.bodyType")}
        options={bodyTypeOptions(t)}
        value={bodyType}
        onChange={setBodyType}
        error={errors.bodyType ? t(errors.bodyType) : undefined}
      />
      <TextField
        label={t("onboarding.trainingMinutes")}
        placeholder={t("onboarding.trainingMinutesPlaceholder")}
        value={trainingMinutes}
        onChangeText={setTrainingMinutes}
        error={
          errors.trainingMinutesPerDay
            ? t(errors.trainingMinutesPerDay)
            : undefined
        }
        keyboardType="number-pad"
        maxLength={3}
      />
      <TextField
        label={t("onboarding.trainingDays")}
        placeholder={t("onboarding.trainingDaysPlaceholder")}
        value={trainingDays}
        onChangeText={setTrainingDays}
        error={
          errors.trainingDaysPerWeek ? t(errors.trainingDaysPerWeek) : undefined
        }
        keyboardType="number-pad"
        maxLength={1}
      />
      <OptionGroup
        label={t("onboarding.trainingPlace")}
        options={trainingPlaceOptions(t)}
        value={trainingPlace}
        onChange={setTrainingPlace}
        error={errors.trainingPlace ? t(errors.trainingPlace) : undefined}
      />
      <TextField
        label={t("onboarding.injuries")}
        placeholder={t("onboarding.injuriesPlaceholder")}
        value={injuries}
        onChangeText={setInjuries}
        error={errors.injuries ? t(errors.injuries) : undefined}
        multiline
        numberOfLines={2}
        maxLength={500}
      />
      <OptionGroup
        label={t("onboarding.goal")}
        options={goalOptions(t)}
        value={goal}
        onChange={setGoal}
        error={errors.goal ? t(errors.goal) : undefined}
      />
      <TextField
        label={t("onboarding.weeklyBudget")}
        placeholder={t("onboarding.weeklyBudgetPlaceholder")}
        value={weeklyBudget}
        onChangeText={setWeeklyBudget}
        error={errors.weeklyBudgetMxn ? t(errors.weeklyBudgetMxn) : undefined}
        keyboardType="number-pad"
        maxLength={5}
      />
      <TextField
        label={t("onboarding.foodNotes")}
        placeholder={t("onboarding.foodNotesPlaceholder")}
        value={foodNotes}
        onChangeText={setFoodNotes}
        error={errors.foodNotes ? t(errors.foodNotes) : undefined}
        multiline
        numberOfLines={3}
        maxLength={500}
      />
      <TextField
        label={t("onboarding.supplements")}
        placeholder={t("onboarding.supplementsPlaceholder")}
        value={supplements}
        onChangeText={setSupplements}
        error={errors.supplements ? t(errors.supplements) : undefined}
        multiline
        numberOfLines={2}
        maxLength={500}
      />

      {/* Device-local; applies immediately, no save needed. */}
      <OptionGroup<ThemePreference>
        label={t("profile.theme")}
        options={[
          {
            value: "system",
            label: t("profile.themeSystem"),
            description: t("profile.themeSystemDesc"),
          },
          { value: "light", label: t("profile.themeLight") },
          { value: "dark", label: t("profile.themeDark") },
        ]}
        value={themePreference}
        onChange={setThemePreference}
      />

      {formError ? (
        <Text className="mb-4 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
          {formError}
        </Text>
      ) : null}

      <Button title={t("profile.save")} onPress={handleSave} loading={saving} />
      <Button
        title={t("profile.cancel")}
        onPress={() => router.back()}
        variant="ghost"
        disabled={saving}
      />

      {DONATION_URL ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(DONATION_URL)}
          className="mt-6 items-center rounded-card bg-sage-50 p-5 dark:bg-sage-900"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Text className="font-nunito-bold text-base text-sage-800 dark:text-sage-100">
            {t("profile.donateTitle")}
          </Text>
          <Text className="mt-1 text-center font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
            {t("profile.donateSubtitle")}
          </Text>
        </Pressable>
      ) : null}
    </AuthLayout>
  );
}
