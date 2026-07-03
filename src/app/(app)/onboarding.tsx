import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { TextField } from "@/components/ui/TextField";
import { useAuthStore } from "@/features/auth/store";
import {
  aboutYouSchema,
  bodySchema,
  goalSchema,
} from "@/features/profile/schemas";
import { completeOnboarding } from "@/features/profile/store";
import type { ActivityLevel, Goal, Sex } from "@/features/profile/types";
import { fieldErrors } from "@/lib/forms";

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    null,
  );
  const [goal, setGoal] = useState<Goal | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleNext() {
    const schema = step === 1 ? aboutYouSchema : bodySchema;
    const values =
      step === 1
        ? { displayName, age, sex }
        : { heightCm, weightKg, activityLevel };
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setStep(step + 1);
  }

  async function handleFinish() {
    setFormError(null);
    const parsedGoal = goalSchema.safeParse({ goal });
    if (!parsedGoal.success) {
      setErrors(fieldErrors(parsedGoal.error));
      return;
    }
    setErrors({});
    // Steps 1 and 2 were validated on the way in; re-parse to get typed values.
    const aboutYou = aboutYouSchema.parse({ displayName, age, sex });
    const body = bodySchema.parse({ heightCm, weightKg, activityLevel });
    if (!session) return;
    setSaving(true);
    try {
      // On success the profile store updates and the (app) layout swaps
      // this screen for home automatically.
      await completeOnboarding(session.user.id, {
        ...aboutYou,
        ...body,
        ...parsedGoal.data,
      });
    } catch {
      setSaving(false);
      setFormError(t("auth.errors.generic"));
    }
  }

  const titles: Record<number, { title: string; subtitle: string }> = {
    1: { title: t("onboarding.step1Title"), subtitle: t("onboarding.step1Subtitle") },
    2: { title: t("onboarding.step2Title"), subtitle: t("onboarding.step2Subtitle") },
    3: { title: t("onboarding.step3Title"), subtitle: t("onboarding.step3Subtitle") },
  };

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-night">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6 flex-row items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <View
                key={index}
                className={`h-1.5 flex-1 rounded-full ${
                  index < step
                    ? "bg-sage-500"
                    : "bg-sage-200 dark:bg-sage-800"
                }`}
              />
            ))}
          </View>
          <Text className="font-nunito text-sm text-ink-soft dark:text-ink-invmuted">
            {t("onboarding.stepOf", { current: step, total: TOTAL_STEPS })}
          </Text>
          <Text className="mt-1 font-nunito-extrabold text-3xl text-ink dark:text-ink-inverse">
            {titles[step].title}
          </Text>
          <Text className="mb-8 mt-2 font-nunito text-base text-ink-muted dark:text-ink-invmuted">
            {titles[step].subtitle}
          </Text>

          {step === 1 && (
            <>
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
                options={[
                  { value: "female", label: t("onboarding.female") },
                  { value: "male", label: t("onboarding.male") },
                ]}
                value={sex}
                onChange={setSex}
                error={errors.sex ? t(errors.sex) : undefined}
              />
              <Text className="mb-4 font-nunito text-sm text-ink-soft dark:text-ink-invmuted">
                {t("onboarding.sexHint")}
              </Text>
            </>
          )}

          {step === 2 && (
            <>
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
                options={[
                  {
                    value: "sedentary",
                    label: t("onboarding.activitySedentary"),
                    description: t("onboarding.activitySedentaryDesc"),
                  },
                  {
                    value: "light",
                    label: t("onboarding.activityLight"),
                    description: t("onboarding.activityLightDesc"),
                  },
                  {
                    value: "moderate",
                    label: t("onboarding.activityModerate"),
                    description: t("onboarding.activityModerateDesc"),
                  },
                  {
                    value: "active",
                    label: t("onboarding.activityActive"),
                    description: t("onboarding.activityActiveDesc"),
                  },
                  {
                    value: "very_active",
                    label: t("onboarding.activityVeryActive"),
                    description: t("onboarding.activityVeryActiveDesc"),
                  },
                ]}
                value={activityLevel}
                onChange={setActivityLevel}
                error={errors.activityLevel ? t(errors.activityLevel) : undefined}
              />
            </>
          )}

          {step === 3 && (
            <OptionGroup
              label={t("onboarding.goal")}
              options={[
                {
                  value: "lose_weight",
                  label: t("onboarding.goalLose"),
                  description: t("onboarding.goalLoseDesc"),
                },
                {
                  value: "maintain",
                  label: t("onboarding.goalMaintain"),
                  description: t("onboarding.goalMaintainDesc"),
                },
                {
                  value: "gain_muscle",
                  label: t("onboarding.goalGain"),
                  description: t("onboarding.goalGainDesc"),
                },
              ]}
              value={goal}
              onChange={setGoal}
              error={errors.goal ? t(errors.goal) : undefined}
            />
          )}

          {formError ? (
            <Text className="mb-4 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
              {formError}
            </Text>
          ) : null}

          <View className="mt-auto pt-6">
            {step < TOTAL_STEPS ? (
              <Button title={t("onboarding.next")} onPress={handleNext} />
            ) : (
              <Button
                title={t("onboarding.finish")}
                onPress={handleFinish}
                loading={saving}
              />
            )}
            {step > 1 && (
              <Button
                title={t("onboarding.back")}
                onPress={() => setStep(step - 1)}
                variant="ghost"
                disabled={saving}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
