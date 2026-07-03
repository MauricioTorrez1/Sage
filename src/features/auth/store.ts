import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";

type AuthState = {
  session: Session | null;
  /** True once the persisted session has been restored from storage. */
  initialized: boolean;
};

export const useAuthStore = create<AuthState>(() => ({
  session: null,
  initialized: false,
}));

let listenerStarted = false;

/** Restores the persisted session and keeps the store in sync. Idempotent. */
export function startAuthListener() {
  if (listenerStarted) return;
  listenerStarted = true;

  supabase.auth.getSession().then(({ data }) => {
    useAuthStore.setState({ session: data.session, initialized: true });
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({ session, initialized: true });
  });
}
