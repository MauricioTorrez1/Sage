import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { tokens } from "@/theme/tokens";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 132;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 56;
const INNER_RADIUS = 40;
const STROKE = 13;

type RingProps = {
  radius: number;
  color: string;
  trackColor: string;
  /** 0..1 */
  progress: number;
  delay: number;
};

function Ring({ radius, color, trackColor, progress, delay }: RingProps) {
  const circumference = 2 * Math.PI * radius;
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = withDelay(
      delay,
      withTiming(progress, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [animated, progress, delay]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value),
  }));

  return (
    <>
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={trackColor}
        strokeWidth={STROKE}
        fill="none"
      />
      <AnimatedCircle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
      />
    </>
  );
}

type LegendRowProps = {
  color: string;
  label: string;
  done: number;
  total: number;
};

function LegendRow({ color, label, done, total }: LegendRowProps) {
  return (
    <View className="flex-row items-center gap-2">
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: color,
        }}
      />
      <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
        {label}
      </Text>
      <Text className="font-nunito-bold text-sm text-ink dark:text-ink-inverse">
        {done}/{total}
      </Text>
    </View>
  );
}

type AdherenceRingsProps = {
  mealsDone: number;
  mealsTotal: number;
  exercisesDone: number;
  exercisesTotal: number;
};

/**
 * Apple-Fitness-style pair of rings for today's checklist: outer ring is
 * meals (sage), inner ring is exercise (terracotta).
 */
export function AdherenceRings({
  mealsDone,
  mealsTotal,
  exercisesDone,
  exercisesTotal,
}: AdherenceRingsProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const { sage, terracotta } = tokens.colors;

  const total = mealsTotal + exercisesTotal;
  const done = mealsDone + exercisesDone;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <View className="flex-row items-center gap-5">
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <Ring
            radius={OUTER_RADIUS}
            color={sage[500]}
            trackColor={dark ? sage[900] : sage[100]}
            progress={mealsTotal > 0 ? mealsDone / mealsTotal : 0}
            delay={0}
          />
          <Ring
            radius={INNER_RADIUS}
            color={terracotta[500]}
            trackColor={dark ? terracotta[900] : terracotta[100]}
            progress={exercisesTotal > 0 ? exercisesDone / exercisesTotal : 0}
            delay={150}
          />
        </Svg>
        <View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center"
        >
          <Text className="font-nunito-extrabold text-xl text-ink dark:text-ink-inverse">
            {percent}%
          </Text>
        </View>
      </View>
      <View className="flex-1 gap-2">
        <LegendRow
          color={sage[500]}
          label={t("dailyPlan.meals")}
          done={mealsDone}
          total={mealsTotal}
        />
        <LegendRow
          color={terracotta[500]}
          label={t("dailyPlan.exercises")}
          done={exercisesDone}
          total={exercisesTotal}
        />
      </View>
    </View>
  );
}
