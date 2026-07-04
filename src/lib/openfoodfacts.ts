import { z } from "zod";

/**
 * Open Food Facts client — free, open database with good coverage of
 * Mexican products. No API key; they ask for an identifying User-Agent.
 */

const OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/";
const OFF_FIELDS =
  "product_name,product_name_es,brands,nutriments,serving_size";
const USER_AGENT = "Sage/1.0 (open-source portfolio app)";

const offResponseSchema = z.object({
  status: z.number(),
  product: z
    .object({
      product_name: z.string().optional(),
      product_name_es: z.string().optional(),
      brands: z.string().optional(),
      serving_size: z.string().optional(),
      nutriments: z
        .object({
          "energy-kcal_100g": z.number().optional(),
          proteins_100g: z.number().optional(),
          carbohydrates_100g: z.number().optional(),
          fat_100g: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type FoodProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  servingSize: string | null;
  /** Per 100 g/ml; null when the database lacks the value. */
  kcal100g: number | null;
  protein100g: number | null;
  carbs100g: number | null;
  fat100g: number | null;
};

/** Looks a barcode up on Open Food Facts; null = not in the database. */
export async function fetchProductByBarcode(
  barcode: string,
): Promise<FoodProduct | null> {
  const response = await fetch(
    `${OFF_PRODUCT_URL}${encodeURIComponent(barcode)}?fields=${OFF_FIELDS}`,
    { headers: { "User-Agent": USER_AGENT } },
  );
  if (!response.ok) return null;

  const parsed = offResponseSchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) {
    return null;
  }

  const product = parsed.data.product;
  const name = product.product_name_es || product.product_name;
  if (!name) return null;

  return {
    barcode,
    name,
    brand: product.brands ?? null,
    servingSize: product.serving_size ?? null,
    kcal100g: product.nutriments?.["energy-kcal_100g"] ?? null,
    protein100g: product.nutriments?.proteins_100g ?? null,
    carbs100g: product.nutriments?.carbohydrates_100g ?? null,
    fat100g: product.nutriments?.fat_100g ?? null,
  };
}
