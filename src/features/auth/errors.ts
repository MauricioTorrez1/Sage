import { isAuthApiError } from "@supabase/supabase-js";

/**
 * Maps Supabase auth error codes to i18n keys with friendly Spanish copy.
 * Anything unknown falls back to a generic, non-technical message.
 */
const errorCodeToKey: Record<string, string> = {
  invalid_credentials: "auth.errors.invalidCredentials",
  email_not_confirmed: "auth.errors.emailNotConfirmed",
  user_already_exists: "auth.errors.emailTaken",
  email_exists: "auth.errors.emailTaken",
  weak_password: "auth.errors.passwordTooShort",
  otp_expired: "auth.errors.codeExpired",
  otp_disabled: "auth.errors.codeInvalid",
  over_email_send_rate_limit: "auth.errors.tooManyAttempts",
  over_request_rate_limit: "auth.errors.tooManyAttempts",
  same_password: "auth.errors.samePassword",
};

export function authErrorKey(error: unknown): string {
  if (isAuthApiError(error) && error.code && errorCodeToKey[error.code]) {
    return errorCodeToKey[error.code];
  }
  if (error instanceof Error && error.message === "Network request failed") {
    return "auth.errors.network";
  }
  return "auth.errors.generic";
}
