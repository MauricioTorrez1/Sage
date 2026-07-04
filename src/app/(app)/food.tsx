import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { BarcodeScanner } from "@/features/food/BarcodeScanner";
import type { ShoppingItem } from "@/features/food/shopping-store";
import {
  addShoppingItem,
  generateShoppingList,
  loadShoppingList,
  toggleShoppingItem,
  useShoppingStore,
} from "@/features/food/shopping-store";
import { useProfileStore } from "@/features/profile/store";
import type { FoodProduct } from "@/lib/openfoodfacts";
import { fetchProductByBarcode } from "@/lib/openfoodfacts";
import { tokens } from "@/theme/tokens";

function ShoppingRow({ item }: { item: ShoppingItem }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.done }}
      onPress={() => toggleShoppingItem(item.id)}
      className="flex-row items-center py-2"
    >
      <View
        className={`mr-3 h-6 w-6 items-center justify-center rounded-md border ${
          item.done
            ? "border-sage-500 bg-sage-500"
            : "border-sage-300 dark:border-sage-700"
        }`}
      >
        {item.done ? <Text className="text-xs text-white">✓</Text> : null}
      </View>
      <View className="flex-1">
        <Text
          className={`font-nunito-semibold text-base ${
            item.done
              ? "text-ink-soft line-through dark:text-ink-invmuted"
              : "text-ink dark:text-ink-inverse"
          }`}
        >
          {item.title}
        </Text>
        <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
          {item.quantity}
        </Text>
      </View>
      {item.est_mxn > 0 ? (
        <Text className="ml-2 font-nunito-semibold text-xs text-ink-soft dark:text-ink-invmuted">
          ~${item.est_mxn}
        </Text>
      ) : null}
    </Pressable>
  );
}

function MacroCell({ label, value }: { label: string; value: number | null }) {
  return (
    <View className="flex-1 items-center rounded-button bg-sage-50 py-2 dark:bg-sage-900">
      <Text className="font-nunito-extrabold text-base text-ink dark:text-ink-inverse">
        {value !== null ? Math.round(value * 10) / 10 : "—"}
      </Text>
      <Text className="font-nunito text-xs text-ink-muted dark:text-ink-invmuted">
        {label}
      </Text>
    </View>
  );
}

export default function FoodScreen() {
  const { t } = useTranslation();
  const profile = useProfileStore((state) => state.profile);
  const list = useShoppingStore((state) => state.list);
  const loaded = useShoppingStore((state) => state.loaded);
  const generating = useShoppingStore((state) => state.generating);
  const errorKey = useShoppingStore((state) => state.errorKey);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadShoppingList();
  }, []);

  async function handleScanned(barcode: string) {
    setScannerVisible(false);
    setProduct(null);
    setNotFound(false);
    setLookingUp(true);
    try {
      const found = await fetchProductByBarcode(barcode);
      if (found) setProduct(found);
      else setNotFound(true);
    } catch {
      setNotFound(true);
    } finally {
      setLookingUp(false);
    }
  }

  const total = list?.items.reduce((sum, item) => sum + item.est_mxn, 0) ?? 0;
  const budget = profile?.weekly_food_budget_mxn ?? null;

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-night">
      <View className="flex-row items-center border-b border-sage-100 px-4 py-3 dark:border-sage-800">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("coach.back")}
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full"
        >
          <Text className="text-xl text-ink dark:text-ink-inverse">‹</Text>
        </Pressable>
        <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
          {t("food.title")}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-6 py-6">
        {/* Weekly shopping list */}
        <View className="rounded-card bg-white p-5 dark:bg-nightSurface">
          <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
            {t("food.shoppingTitle")}
          </Text>
          {!loaded ? (
            <View className="items-center py-6">
              <ActivityIndicator color={tokens.colors.sage[500]} />
            </View>
          ) : !list ? (
            <>
              <Text className="mb-4 mt-2 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                {t("food.shoppingEmpty")}
              </Text>
              <Button
                title={t("food.generate")}
                onPress={generateShoppingList}
                loading={generating}
              />
            </>
          ) : (
            <>
              <View className="mt-2">
                {list.items.map((item) => (
                  <ShoppingRow key={item.id} item={item} />
                ))}
              </View>
              <View className="mt-3 flex-row items-baseline justify-between border-t border-sage-100 pt-3 dark:border-sage-800">
                <Text className="font-nunito-semibold text-sm text-ink dark:text-ink-inverse">
                  {t("food.total", { total })}
                </Text>
                {budget ? (
                  <Text
                    className={`font-nunito text-xs ${
                      total > budget
                        ? "text-terracotta-600 dark:text-terracotta-300"
                        : "text-ink-soft dark:text-ink-invmuted"
                    }`}
                  >
                    {t("food.budget", { budget })}
                  </Text>
                ) : null}
              </View>
              <Button
                title={t("food.regenerate")}
                onPress={generateShoppingList}
                loading={generating}
                variant="ghost"
              />
            </>
          )}
          {errorKey ? (
            <Text className="mt-2 font-nunito text-sm text-terracotta-600 dark:text-terracotta-300">
              {t(errorKey)}
            </Text>
          ) : null}
        </View>

        {/* Barcode lookup */}
        <View className="mt-4 rounded-card bg-white p-5 dark:bg-nightSurface">
          <Text className="font-nunito-bold text-lg text-ink dark:text-ink-inverse">
            {t("food.scanTitle")}
          </Text>
          <Text className="mb-4 mt-2 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
            {t("food.scanSubtitle")}
          </Text>
          <Button
            title={t("food.scan")}
            onPress={() => setScannerVisible(true)}
            disabled={lookingUp}
          />

          {lookingUp ? (
            <View className="mt-4 flex-row items-center gap-2">
              <ActivityIndicator
                size="small"
                color={tokens.colors.sage[500]}
              />
              <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                {t("food.lookingUp")}
              </Text>
            </View>
          ) : null}

          {notFound ? (
            <Text className="mt-4 font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
              {t("food.notFound")}
            </Text>
          ) : null}

          {product ? (
            <View className="mt-4 rounded-button border border-sage-200 p-4 dark:border-sage-800">
              <Text className="font-nunito-bold text-base text-ink dark:text-ink-inverse">
                {product.name}
              </Text>
              {product.brand ? (
                <Text className="font-nunito text-sm text-ink-muted dark:text-ink-invmuted">
                  {product.brand}
                </Text>
              ) : null}
              <Text className="mt-3 font-nunito-semibold text-xs uppercase tracking-wide text-sage-700 dark:text-sage-300">
                {t("food.per100g")}
              </Text>
              <View className="mt-2 flex-row gap-2">
                <MacroCell label={t("food.kcal")} value={product.kcal100g} />
                <MacroCell
                  label={t("plan.protein")}
                  value={product.protein100g}
                />
                <MacroCell label={t("plan.carbs")} value={product.carbs100g} />
                <MacroCell label={t("plan.fat")} value={product.fat100g} />
              </View>
              {list ? (
                <Button
                  title={t("food.addToList")}
                  onPress={() => {
                    addShoppingItem(product.name);
                    setProduct(null);
                  }}
                  variant="ghost"
                />
              ) : (
                <Text className="mt-3 font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
                  {t("food.addNeedsList")}
                </Text>
              )}
            </View>
          ) : null}
        </View>

        <Text className="mt-4 font-nunito text-xs text-ink-soft dark:text-ink-invmuted">
          {t("food.offCredit")}
        </Text>
      </ScrollView>

      <BarcodeScanner
        visible={scannerVisible}
        onScanned={handleScanned}
        onClose={() => setScannerVisible(false)}
      />
    </SafeAreaView>
  );
}
