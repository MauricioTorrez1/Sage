import { Pressable, Text, View } from "react-native";

export type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type OptionGroupProps<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Translated message shown below the group. */
  error?: string;
};

/** Vertical list of selectable cards (radio-group semantics). */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: OptionGroupProps<T>) {
  return (
    <View className="mb-4">
      <Text className="mb-2 font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
        {label}
      </Text>
      <View className="gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              className={`rounded-button border px-4 py-3.5 ${
                selected
                  ? "border-sage-500 bg-sage-100 dark:border-sage-400 dark:bg-sage-800"
                  : "border-sage-200 bg-white dark:border-sage-800 dark:bg-nightSurface"
              }`}
            >
              <Text
                className={`text-base text-ink dark:text-ink-inverse ${
                  selected ? "font-nunito-bold" : "font-nunito-semibold"
                }`}
              >
                {option.label}
              </Text>
              {option.description ? (
                <Text className="mt-0.5 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                  {option.description}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text className="mt-1.5 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
