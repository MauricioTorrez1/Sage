import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { tokens } from "@/theme/tokens";

type ShapeProps = {
  size: number;
  /** Position, color, opacity and borderRadius of the shape. */
  style: ViewStyle;
  /** Vertical float amplitude in px. */
  drift: number;
  /** Rocking rotation range in degrees, e.g. [10, 26]. */
  rotateRange: [number, number];
  duration: number;
  delay?: number;
};

/** One decorative shape drifting, rocking and breathing in a slow loop. */
function FloatingShape({
  size,
  style,
  drift,
  rotateRange,
  duration,
  delay = 0,
}: ShapeProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-drift, drift]) },
      {
        rotate: `${
          interpolate(progress.value, [0, 1], [rotateRange[0], rotateRange[1]])
        }deg`,
      },
      { scale: interpolate(progress.value, [0, 1], [1, 1.07]) },
    ],
  }));

  // Reanimated components drop className on web, so styling is inline.
  return (
    <Animated.View
      style={[
        { position: "absolute", width: size, height: size },
        style,
        animatedStyle,
      ]}
    />
  );
}

/**
 * Full-bleed decorative background: bold organic shapes floating slowly
 * behind the screen content. Render it as the first child of the screen
 * container; it ignores touches and adapts to the active color scheme.
 */
export function AnimatedBlobs() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const { sage, terracotta } = tokens.colors;

  return (
    <View
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
      pointerEvents="none"
    >
      {/* Big sage circle peeking from the top-right corner. */}
      <FloatingShape
        size={280}
        style={{
          top: -90,
          right: -80,
          borderRadius: 140,
          backgroundColor: dark ? sage[800] : sage[200],
          opacity: dark ? 0.45 : 0.55,
        }}
        drift={16}
        rotateRange={[0, 0]}
        duration={7000}
      />
      {/* Thick terracotta ring rising from the bottom-left. */}
      <FloatingShape
        size={210}
        style={{
          bottom: -70,
          left: -80,
          borderRadius: 105,
          borderWidth: 30,
          borderColor: dark ? terracotta[800] : terracotta[200],
          opacity: dark ? 0.5 : 0.55,
        }}
        drift={14}
        rotateRange={[0, 0]}
        duration={9000}
        delay={400}
      />
      {/* Rocking squircle on the left edge. */}
      <FloatingShape
        size={110}
        style={{
          top: 260,
          left: -44,
          borderRadius: 34,
          backgroundColor: dark ? sage[900] : sage[300],
          opacity: dark ? 0.55 : 0.35,
        }}
        drift={10}
        rotateRange={[8, 34]}
        duration={11000}
        delay={200}
      />
      {/* Small terracotta dot bouncing mid-right. */}
      <FloatingShape
        size={56}
        style={{
          top: 170,
          right: 34,
          borderRadius: 28,
          backgroundColor: dark ? terracotta[700] : terracotta[300],
          opacity: dark ? 0.4 : 0.45,
        }}
        drift={22}
        rotateRange={[0, 0]}
        duration={6000}
        delay={800}
      />
    </View>
  );
}
