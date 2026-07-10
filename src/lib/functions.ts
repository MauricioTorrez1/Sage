/** Utilities for reading structured errors from supabase.functions.invoke. */

export type InvokeErrorInfo = {
  status: number | null;
  /** The { error: "..." } code the coach function returns. */
  code: string | null;
  /** hours_left from rate-limit responses. */
  hoursLeft: number | null;
  /** period from per-calendar-period limit responses ("day" | "week"). */
  period: string | null;
};

/** Extracts status + body from a FunctionsHttpError without throwing. */
export async function invokeErrorInfo(
  error: unknown,
): Promise<InvokeErrorInfo> {
  const context = (error as { context?: Response })?.context;
  if (!context || typeof context.status !== "number") {
    return { status: null, code: null, hoursLeft: null, period: null };
  }

  let body:
    | { error?: string; hours_left?: number; period?: string }
    | null = null;
  try {
    // clone() keeps the body readable for anyone else holding the Response.
    body = await context.clone().json();
  } catch {
    try {
      body = await context.json();
    } catch {
      body = null;
    }
  }

  return {
    status: context.status,
    code: typeof body?.error === "string" ? body.error : null,
    hoursLeft: typeof body?.hours_left === "number" ? body.hours_left : null,
    period: typeof body?.period === "string" ? body.period : null,
  };
}
