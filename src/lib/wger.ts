import { z } from "zod";

/**
 * wger client — open exercise database (CC-BY-SA). The old search endpoint
 * is gone, so Sage matches exercises against a curated local catalog (see
 * features/plan/wger-catalog.ts) and only fetches the detail here.
 */

const WGER_INFO_URL = "https://wger.de/api/v2/exerciseinfo/";
const SPANISH = 4;
const ENGLISH = 2;

const infoSchema = z.object({
  translations: z.array(
    z.object({
      language: z.number(),
      name: z.string(),
      description: z.string(),
    }),
  ),
  images: z.array(
    z.object({
      image: z.string(),
      is_main: z.boolean(),
    }),
  ),
});

export type WgerExercise = {
  name: string;
  /** Plain-text instructions (wger stores HTML). */
  description: string;
  imageUrl: string | null;
};

function stripHtml(html: string) {
  return html
    .replace(/<\/(p|li|br)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Fetches one exercise sheet; Spanish translation first, English fallback. */
export async function fetchWgerExercise(
  exerciseId: number,
): Promise<WgerExercise | null> {
  const response = await fetch(`${WGER_INFO_URL}${exerciseId}/?format=json`);
  if (!response.ok) return null;

  const parsed = infoSchema.safeParse(await response.json());
  if (!parsed.success) return null;

  const { translations, images } = parsed.data;
  const translation =
    translations.find((item) => item.language === SPANISH) ??
    translations.find((item) => item.language === ENGLISH) ??
    translations[0];
  if (!translation) return null;

  const image = images.find((item) => item.is_main) ?? images[0];

  return {
    name: translation.name,
    description: stripHtml(translation.description),
    imageUrl: image?.image ?? null,
  };
}
