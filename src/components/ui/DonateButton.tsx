import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** Buy Me a Coffee donation link for Sage. */
const DONATE_URL = "https://buymeacoffee.com/sagemx";
const GOLD = "#F5B301";
const GOLD_INK = "#2A2205";

/**
 * Eye-catching gold donation button with a pulsing glow. `compact` is the
 * small pill used in the home header; the full size is used elsewhere.
 */
export function DonateButton({ compact = false }: { compact?: boolean }) {
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + glow.value * 0.5,
    transform: [{ scale: 1 + glow.value * 0.14 }],
  }));

  return (
    <View style={{ position: "relative" }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: -5,
            bottom: -5,
            left: -5,
            right: -5,
            borderRadius: 999,
            backgroundColor: GOLD,
          },
          glowStyle,
        ]}
      />
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Buy me a coffee"
        onPress={() => WebBrowser.openBrowserAsync(DONATE_URL).catch(() => {})}
        style={({ pressed }) => ({
          backgroundColor: GOLD,
          borderRadius: 999,
          paddingVertical: compact ? 8 : 14,
          paddingHorizontal: compact ? 14 : 24,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
          shadowColor: GOLD,
          shadowOpacity: 0.9,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        })}
      >
        <Text
          className="font-nunito-extrabold"
          style={{ color: GOLD_INK, fontSize: compact ? 13 : 16 }}
        >
          ☕ Buy me a coffee
        </Text>
      </Pressable>
    </View>
  );
}
