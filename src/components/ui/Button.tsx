import { ActivityIndicator, Pressable, Text } from "react-native";

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** primary = terracotta CTA; ghost = borderless text button. */
  variant?: "primary" | "ghost";
};

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
}: ButtonProps) {
  const inactive = disabled || loading;

  if (variant === "ghost") {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={inactive}
        className="items-center py-3"
        style={({ pressed }) => ({ opacity: pressed || inactive ? 0.6 : 1 })}
      >
        <Text className="font-nunito-bold text-base text-sage-700 dark:text-sage-300">
          {title}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      className="items-center rounded-button bg-terracotta-500 py-4"
      style={({ pressed }) => ({ opacity: pressed || inactive ? 0.7 : 1 })}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text className="font-nunito-bold text-lg text-white">{title}</Text>
      )}
    </Pressable>
  );
}
