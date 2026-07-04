import { Pressable, Text, View } from "react-native";

import type { Option } from "@/components/ui/OptionGroup";

type MultiOptionGroupProps<T extends string> = {
  label: string;
  options: Option<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  /**
   * Values that clear every other selection when picked (e.g. "none",
   * "everything") — and get cleared when anything else is picked.
   */
  exclusiveValues?: T[];
  /** Translated hint shown below the group. */
  hint?: string;
};

/** Wrapping row of toggleable chips (checkbox-group semantics). */
export function MultiOptionGroup<T extends string>({
  label,
  options,
  values,
  onChange,
  exclusiveValues = [],
  hint,
}: MultiOptionGroupProps<T>) {
  function toggle(value: T) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
      return;
    }
    if (exclusiveValues.includes(value)) {
      onChange([value]);
      return;
    }
    onChange([...values.filter((v) => !exclusiveValues.includes(v)), value]);
  }

  return (
    <View className="mb-4">
      <Text className="mb-2 font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggle(option.value)}
              className={`rounded-full border px-4 py-2 ${
                selected
                  ? "border-sage-500 bg-sage-100 dark:border-sage-400 dark:bg-sage-800"
                  : "border-sage-200 bg-white dark:border-sage-800 dark:bg-nightSurface"
              }`}
            >
              <Text
                className={`text-sm text-ink dark:text-ink-inverse ${
                  selected ? "font-nunito-bold" : "font-nunito-semibold"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? (
        <Text className="mt-1.5 font-nunito text-sm text-ink-soft dark:text-ink-invmuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
