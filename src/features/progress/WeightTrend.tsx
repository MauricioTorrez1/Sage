import { useColorScheme } from "nativewind";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";

import type { WeightPoint } from "@/features/progress/stats";
import { tokens } from "@/theme/tokens";

const HEIGHT = 110;
const PADDING = 10;

/**
 * Weight sparkline from the weights recorded with progress photos. Points
 * are spaced evenly (readability over exact time scale) and the latest one
 * is emphasized.
 */
export function WeightTrend({ weights }: { weights: WeightPoint[] }) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const { sage, ink } = tokens.colors;
  const [width, setWidth] = useState(0);

  if (weights.length < 2) {
    return (
      <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
        {t("progress.weightEmpty")}
      </Text>
    );
  }

  const kgs = weights.map((point) => point.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const span = max - min || 1; // flat series still draws a centered line

  const points = weights.map((point, index) => {
    const x =
      PADDING + (index * (width - PADDING * 2)) / (weights.length - 1);
    const y =
      HEIGHT - PADDING - ((point.kg - min) / span) * (HEIGHT - PADDING * 2);
    return { x, y };
  });
  const first = weights[0];
  const latest = weights[weights.length - 1];
  const shortDate = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    });

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          <Polyline
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={sage[500]}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((point, index) => (
            <Circle
              key={weights[index].date}
              cx={point.x}
              cy={point.y}
              r={index === points.length - 1 ? 6 : 3.5}
              fill={index === points.length - 1 ? sage[500] : sage[300]}
              stroke={
                index === points.length - 1
                  ? dark
                    ? ink.inverse
                    : "#FFFFFF"
                  : "none"
              }
              strokeWidth={2}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height: HEIGHT }} />
      )}
      <View className="mt-1 flex-row items-center justify-between">
        <Text className="font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
          {shortDate(first.date)} · {first.kg} kg
        </Text>
        <Text className="font-nunito-bold text-sm text-sage-700 dark:text-sage-300">
          {shortDate(latest.date)} · {latest.kg} kg
        </Text>
      </View>
    </View>
  );
}
