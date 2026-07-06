import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";

import { supabase } from "@/lib/supabase";

// No-op on native; on web it closes the popup once the redirect lands.
WebBrowser.maybeCompleteAuthSession();

export type OAuthResult = "success" | "cancelled" | "failed";

/** Supabase's implicit flow returns the tokens in the URL fragment. */
function fragmentParams(url: string) {
  const hashIndex = url.indexOf("#");
  return new URLSearchParams(hashIndex >= 0 ? url.slice(hashIndex + 1) : "");
}

/**
 * Turns a redirect URL carrying Supabase auth tokens into a session.
 * Returns "failed" on a malformed/token-less URL, so callers can tell a
 * broken redirect apart from a successful sign-in.
 */
async function createSessionFromUrl(url: string): Promise<OAuthResult> {
  const params = fragmentParams(url);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return "failed";

  // The auth listener picks the session up and routes into the app.
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return error ? "failed" : "success";
}

/**
 * Safety net for redirects that arrive as a deep link instead of through
 * openAuthSessionAsync — e.g. when the exp:// callback makes Expo Go reload
 * the project, killing the promise that was waiting for it. Mounted once at
 * the root; quietly ignores every URL that carries no auth tokens.
 */
export function useAuthDeepLinks() {
  const url = Linking.useURL();
  useEffect(() => {
    if (url && url.includes("access_token=")) {
      void createSessionFromUrl(url);
    }
  }, [url]);
}

/**
 * Google sign-in via the system browser: Supabase builds the provider URL,
 * the browser session ends on our deep link, and the tokens in its fragment
 * become the session. The redirect URL (exp://<host>/--/auth-callback in
 * Expo Go, sage://auth-callback in builds) must be allowlisted in Supabase
 * Auth → URL Configuration, and the Google provider must be enabled there.
 */
export async function signInWithGoogle(): Promise<OAuthResult> {
  const redirectTo = Linking.createURL("auth-callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return "failed";

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "cancel" || result.type === "dismiss") {
    return "cancelled";
  }
  if (result.type !== "success") return "failed";

  return createSessionFromUrl(result.url);
}
