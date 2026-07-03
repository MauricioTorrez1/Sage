import type { ZodError } from "zod";

/**
 * Flattens a ZodError into { fieldName: i18nKey } keeping only the first
 * issue per field, which is what the inputs display.
 */
export function fieldErrors(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "root");
    if (!(field in result)) {
      result[field] = issue.message;
    }
  }
  return result;
}
