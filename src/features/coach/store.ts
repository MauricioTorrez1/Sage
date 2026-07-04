import { create } from "zustand";

import { supabase } from "@/lib/supabase";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type CoachState = {
  /** Newest last. Persisted server-side by the coach Edge Function. */
  messages: ChatMessage[];
  /** True once history has been fetched for the current user. */
  historyLoaded: boolean;
  sending: boolean;
  /** i18n key of the last error, cleared on the next send. */
  errorKey: string | null;
};

export const useCoachStore = create<CoachState>(() => ({
  messages: [],
  historyLoaded: false,
  sending: false,
  errorKey: null,
}));

/** Only the recent tail goes to the API; older turns stay local. */
const HISTORY_SENT = 20;
/** How much persisted history to pull when opening the chat. */
const HISTORY_LOADED = 50;
export const MAX_MESSAGE_CHARS = 2000;

/** Fetches the persisted conversation tail. Idempotent per session. */
export async function loadHistory() {
  if (useCoachStore.getState().historyLoaded) return;

  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content")
    .order("created_at", { ascending: false })
    .limit(HISTORY_LOADED);

  if (error) {
    // Start empty rather than blocking the chat; sending still works.
    useCoachStore.setState({ historyLoaded: true });
    return;
  }
  useCoachStore.setState({
    messages: (data as ChatMessage[]).reverse(),
    historyLoaded: true,
  });
}

export async function sendMessage(text: string) {
  const content = text.trim().slice(0, MAX_MESSAGE_CHARS);
  if (!content || useCoachStore.getState().sending) return;

  const history = [
    ...useCoachStore.getState().messages,
    { role: "user" as const, content },
  ];
  useCoachStore.setState({ messages: history, sending: true, errorKey: null });

  const { data, error } = await supabase.functions.invoke("coach", {
    body: { type: "chat", messages: history.slice(-HISTORY_SENT) },
  });

  if (error || typeof data?.reply !== "string") {
    // Keep the user's message so they can just hit send again.
    const busy = (error as { context?: Response })?.context?.status === 429;
    useCoachStore.setState({
      sending: false,
      errorKey: busy ? "coach.errors.busy" : "coach.errors.generic",
    });
    return;
  }

  useCoachStore.setState({
    messages: [...history, { role: "assistant", content: data.reply }],
    sending: false,
  });
}

/** Clears the conversation cache; call on sign-out. */
export function resetCoach() {
  useCoachStore.setState({
    messages: [],
    historyLoaded: false,
    sending: false,
    errorKey: null,
  });
}
