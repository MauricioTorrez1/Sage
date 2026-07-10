import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdherenceRings } from "@/features/progress/AdherenceRings";
import {
  loadHistory,
  useHistoryStore,
  type WeekArchive,
} from "@/features/progress/history-store";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** "1er año", "2º año", "3er año", "4º año"… */
function relativeYearLabel(n: number): string {
  if (n === 1) return "1er año";
  if (n === 3) return "3er año";
  return `${n}º año`;
}

/** Parses a YYYY-MM-DD key into a local Date (no timezone drift). */
function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekAdherencePct(week: WeekArchive): number | null {
  const review = week.review;
  if (!review) return null;
  const total = review.meals_total + review.exercises_total;
  if (total === 0) return null;
  const done = review.meals_done + review.exercises_done;
  return Math.round((done / total) * 100);
}

type Nav =
  | { level: "years" }
  | { level: "months"; year: number }
  | { level: "weeks"; year: number; month: number }
  | { level: "week"; weekStart: string };

function Row({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-2 flex-row items-center rounded-card bg-white p-4 dark:bg-nightSurface"
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <View className="flex-1">
        <Text className="font-nunito-bold text-base text-ink dark:text-ink-inverse">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onPress ? (
        <Text className="text-xl text-sage-600 dark:text-sage-300">›</Text>
      ) : null}
    </Pressable>
  );
}

export default function HistoryScreen() {
  const { t } = useTranslation();
  const weeks = useHistoryStore((state) => state.weeks);
  const loaded = useHistoryStore((state) => state.loaded);
  const [nav, setNav] = useState<Nav>({ level: "years" });

  useEffect(() => {
    loadHistory();
  }, []);

  const earliestYear = useMemo(() => {
    if (weeks.length === 0) return new Date().getFullYear();
    return Math.min(...weeks.map((w) => parseKey(w.weekStart).getFullYear()));
  }, [weeks]);

  // Distinct calendar years present, newest first.
  const years = useMemo(() => {
    const set = new Set(weeks.map((w) => parseKey(w.weekStart).getFullYear()));
    return [...set].sort((a, b) => b - a);
  }, [weeks]);

  function monthsOf(year: number) {
    const set = new Set(
      weeks
        .filter((w) => parseKey(w.weekStart).getFullYear() === year)
        .map((w) => parseKey(w.weekStart).getMonth()),
    );
    return [...set].sort((a, b) => b - a);
  }

  function weeksOf(year: number, month: number) {
    return weeks.filter((w) => {
      const date = parseKey(w.weekStart);
      return date.getFullYear() === year && date.getMonth() === month;
    });
  }

  function goBack() {
    if (nav.level === "years") {
      router.back();
    } else if (nav.level === "months") {
      setNav({ level: "years" });
    } else if (nav.level === "weeks") {
      setNav({ level: "months", year: nav.year });
    } else {
      const date = parseKey(nav.weekStart);
      setNav({
        level: "weeks",
        year: date.getFullYear(),
        month: date.getMonth(),
      });
    }
  }

  const headerTitle =
    nav.level === "years"
      ? t("history.title")
      : nav.level === "months"
        ? relativeYearLabel(nav.year - earliestYear + 1)
        : nav.level === "weeks"
          ? MONTHS[nav.month]
          : t("history.weekTitle");

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-night">
      <View className="flex-row items-center border-b border-sage-100 px-4 py-3 dark:border-sage-800">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("coach.back")}
          onPress={goBack}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full"
        >
          <Text className="text-xl text-ink dark:text-ink-inverse">‹</Text>
        </Pressable>
        <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
          {headerTitle}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-6 py-6">
        {!loaded ? null : weeks.length === 0 ? (
          <Text className="mt-8 text-center font-nunito text-base text-ink-muted dark:text-ink-invmuted">
            {t("history.empty")}
          </Text>
        ) : nav.level === "years" ? (
          <>
            <Text className="mb-3 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
              {t("history.retentionNote")}
            </Text>
            {years.map((year) => {
              const count = weeks.filter(
                (w) => parseKey(w.weekStart).getFullYear() === year,
              ).length;
              return (
                <Row
                  key={year}
                  title={relativeYearLabel(year - earliestYear + 1)}
                  subtitle={t("history.weekCount", { count })}
                  onPress={() => setNav({ level: "months", year })}
                />
              );
            })}
          </>
        ) : nav.level === "months" ? (
          monthsOf(nav.year).map((month) => {
            const count = weeksOf(nav.year, month).length;
            return (
              <Row
                key={month}
                title={MONTHS[month]}
                subtitle={t("history.weekCount", { count })}
                onPress={() =>
                  setNav({ level: "weeks", year: nav.year, month })
                }
              />
            );
          })
        ) : nav.level === "weeks" ? (
          weeksOf(nav.year, nav.month).map((week) => {
            const day = parseKey(week.weekStart).getDate();
            const pct = weekAdherencePct(week);
            return (
              <Row
                key={week.weekStart}
                title={t("history.weekOf", {
                  day,
                  month: MONTHS[nav.month],
                })}
                subtitle={
                  pct !== null
                    ? t("history.weekSummary", {
                        pct,
                        photos: week.photos.length,
                      })
                    : t("history.weekSummaryNoReview", {
                        photos: week.photos.length,
                      })
                }
                onPress={() =>
                  setNav({ level: "week", weekStart: week.weekStart })
                }
              />
            );
          })
        ) : (
          <WeekDetail
            week={weeks.find((w) => w.weekStart === nav.weekStart) ?? null}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WeekDetail({ week }: { week: WeekArchive | null }) {
  const { t } = useTranslation();
  if (!week) return null;

  const review = week.review;

  return (
    <View>
      <Text className="mb-3 font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
        {t("history.readonly")}
      </Text>

      {review ? (
        <View className="mb-4 rounded-card bg-white p-5 dark:bg-nightSurface">
          <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
            {t("history.ringTitle")}
          </Text>
          <View className="mt-4">
            <AdherenceRings
              mealsDone={review.meals_done}
              mealsTotal={review.meals_total}
              exercisesDone={review.exercises_done}
              exercisesTotal={review.exercises_total}
            />
          </View>
          {week.weightKg != null ? (
            <Text className="mt-4 font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
              {t("history.weightLabel", { kg: week.weightKg })}
            </Text>
          ) : null}
          {review.feeling ? (
            <Text className="mt-3 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
              {t("history.feelingLabel", { feeling: review.feeling })}
            </Text>
          ) : null}
          <Text className="mt-3 font-nunito text-sm text-ink dark:text-ink-inverse">
            {review.summary}
          </Text>
        </View>
      ) : week.weightKg != null ? (
        <View className="mb-4 rounded-card bg-white p-5 dark:bg-nightSurface">
          <Text className="font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
            {t("history.weightLabel", { kg: week.weightKg })}
          </Text>
        </View>
      ) : null}

      {week.photos.length > 0 ? (
        <View className="mb-4 rounded-card bg-white p-5 dark:bg-nightSurface">
          <Text className="mb-3 font-nunito-bold text-lg text-ink dark:text-ink-inverse">
            {t("history.photosTitle")}
          </Text>
          {week.photos.map((photo) => (
            <View key={photo.id} className="mb-4 flex-row gap-3">
              {photo.signedUrl ? (
                <Image
                  source={{ uri: photo.signedUrl }}
                  style={{ width: 96, height: 128, borderRadius: 12 }}
                  contentFit="cover"
                />
              ) : null}
              <View className="flex-1">
                <Text className="font-nunito-semibold text-xs text-ink-muted dark:text-ink-invmuted">
                  {new Date(photo.created_at).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "long",
                  })}
                  {photo.weight_kg ? ` · ${photo.weight_kg} kg` : ""}
                </Text>
                {photo.analysis ? (
                  <Text className="mt-1 font-nunito text-sm text-ink dark:text-ink-inverse">
                    {photo.analysis}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!review && week.photos.length === 0 ? (
        <Text className="mt-8 text-center font-nunito text-base text-ink-muted dark:text-ink-invmuted">
          {t("history.weekEmpty")}
        </Text>
      ) : null}
    </View>
  );
}
