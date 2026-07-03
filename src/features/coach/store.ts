import { create } from "zustand";

import { supabase } from "@/lib/supabase";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type CoachState = {
  /** Newest last. In-memory only for now; persistence lands in a later phase. */
  messages: ChatMessage[];
  sending: boolean;
  /** i18n key of the last error, cleared on the next send. */
  errorKey: string | null;
};

export const useCoachStore = create<CoachState>(() => ({
  messages: [],
  sending: false,
  errorKey: null,
}));

/** Only the recent tail goes to the API; older turns stay local. */
const HISTORY_SENT = 20;
export const MAX_MESSAGE_CHARS = 2000;

export async function sendMessage(text: string) {
  const content = text.trim().slice(0, MAX_MESSAGE_CHARS);
  if (!content || useCoachStore.getState().sending) return;

  const history = [
    ...useCoachStore.getState().messages,
    { role: "user" as const, content },
  ];
  useCoachStore.setState({ messages: history, sending: true, errorKey: null });

  const { data, error } = await supabase.functions.invoke("coach", {
    body: { messages: history.slice(-HISTORY_SENT) },
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

/** Clears the conversation; call on sign-out. */
export function resetCoach() {
  useCoachStore.setState({ messages: [], sending: false, errorKey: null });
}
