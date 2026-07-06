import { fetch as expoFetch } from "expo/fetch";
import { create } from "zustand";

import { todayKey } from "@/features/plan/daily-store";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase";

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
  /** True while the assistant reply is streaming in (last message grows). */
  streaming: boolean;
  /** i18n key of the last error, cleared on the next send. */
  errorKey: string | null;
};

export const useCoachStore = create<CoachState>(() => ({
  messages: [],
  historyLoaded: false,
  sending: false,
  streaming: false,
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

/**
 * The coach streams ASCII-only SSE (every non-ASCII char travels as a JSON
 * \uXXXX escape), so bytes map 1:1 to chars — no TextDecoder needed, and no
 * way for the platform's charset guess to garble accents.
 */
function asciiChunk(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

type StreamEvent = { delta?: string; done?: boolean; error?: string };

function errorKeyFor(error: string | undefined) {
  return error === "busy" ? "coach.errors.busy" : "coach.errors.generic";
}

/**
 * Streams the reply over SSE, growing the last assistant bubble as text
 * arrives. Returns true when the send was handled (reply or visible error);
 * false means nothing was consumed and the caller may fall back.
 */
async function streamReply(history: ChatMessage[]): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return false;

  let reply = "";
  try {
    const response = await expoFetch(`${SUPABASE_URL}/functions/v1/coach`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "chat",
        stream: true,
        messages: history.slice(-HISTORY_SENT),
        // The local date lets the server attach today's plan to the prompt.
        date: todayKey(),
      }),
    });
    if (response.status === 429) {
      useCoachStore.setState({
        sending: false,
        errorKey: "coach.errors.busy",
      });
      return true;
    }
    if (!response.ok || !response.body) return false;

    const reader = response.body.getReader();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += asciiChunk(value);

      let separator;
      while ((separator = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const dataLine = rawEvent
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) continue;

        const event = JSON.parse(dataLine.slice(6)) as StreamEvent;
        if (typeof event.delta === "string") {
          reply += event.delta;
          useCoachStore.setState({
            messages: [...history, { role: "assistant", content: reply }],
            streaming: true,
          });
        } else if (event.done) {
          useCoachStore.setState({ sending: false, streaming: false });
          return true;
        } else if (typeof event.error === "string") {
          // Terminal server error: drop any partial bubble (the turn was
          // not persisted) and keep the user's message so they can resend.
          useCoachStore.setState({
            messages: history,
            sending: false,
            streaming: false,
            errorKey: errorKeyFor(event.error),
          });
          return true;
        }
      }
    }

    // Stream ended without a terminal event (connection dropped).
    if (reply) {
      useCoachStore.setState({
        messages: history,
        sending: false,
        streaming: false,
        errorKey: "coach.errors.generic",
      });
      return true;
    }
    return false;
  } catch (error) {
    if (reply) {
      // Mid-stream network failure: same recovery as a dropped connection.
      useCoachStore.setState({
        messages: history,
        sending: false,
        streaming: false,
        errorKey: "coach.errors.generic",
      });
      return true;
    }
    console.warn("coach stream unavailable, falling back:", error);
    return false;
  }
}

/** Pre-streaming request/response send; kept as the fallback path. */
async function invokeReply(history: ChatMessage[]) {
  const { data, error } = await supabase.functions.invoke("coach", {
    body: {
      type: "chat",
      messages: history.slice(-HISTORY_SENT),
      date: todayKey(),
    },
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

export async function sendMessage(text: string) {
  const content = text.trim().slice(0, MAX_MESSAGE_CHARS);
  if (!content || useCoachStore.getState().sending) return;

  const history = [
    ...useCoachStore.getState().messages,
    { role: "user" as const, content },
  ];
  useCoachStore.setState({ messages: history, sending: true, errorKey: null });

  const handled = await streamReply(history);
  if (!handled) await invokeReply(history);
}

/** Clears the conversation cache; call on sign-out. */
export function resetCoach() {
  useCoachStore.setState({
    messages: [],
    historyLoaded: false,
    sending: false,
    streaming: false,
    errorKey: null,
  });
}
