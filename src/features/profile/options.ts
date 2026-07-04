import type { TFunction } from "i18next";

import type { Option } from "@/components/ui/OptionGroup";

import type {
  ActivityLevel,
  BodyType,
  Goal,
  Sex,
  TrainingPlace,
} from "./types";

/** Shared option lists for the onboarding wizard and the profile editor. */

export function sexOptions(t: TFunction): Option<Sex>[] {
  return [
    { value: "female", label: t("onboarding.female") },
    { value: "male", label: t("onboarding.male") },
  ];
}

export function activityOptions(t: TFunction): Option<ActivityLevel>[] {
  return [
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
  ];
}

export function bodyTypeOptions(t: TFunction): Option<BodyType>[] {
  return [
    {
      value: "ectomorph",
      label: t("onboarding.bodyEcto"),
      description: t("onboarding.bodyEctoDesc"),
    },
    {
      value: "mesomorph",
      label: t("onboarding.bodyMeso"),
      description: t("onboarding.bodyMesoDesc"),
    },
    {
      value: "endomorph",
      label: t("onboarding.bodyEndo"),
      description: t("onboarding.bodyEndoDesc"),
    },
  ];
}

export function trainingPlaceOptions(t: TFunction): Option<TrainingPlace>[] {
  return [
    {
      value: "home",
      label: t("onboarding.placeHome"),
      description: t("onboarding.placeHomeDesc"),
    },
    {
      value: "gym",
      label: t("onboarding.placeGym"),
      description: t("onboarding.placeGymDesc"),
    },
  ];
}

export function goalOptions(t: TFunction): Option<Goal>[] {
  return [
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
  ];
}
