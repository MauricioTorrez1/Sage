// Sage coach — Supabase Edge Function (Deno).
// Verifies the caller's JWT, loads their profile (RLS-scoped), builds a
// system prompt with their data + daily plan, and relays the chat to Claude.
// Secrets required: ANTHROPIC_API_KEY (Edge Functions > Secrets).
import Anthropic from "npm:@anthropic-ai/sdk@0.72.1";
import { createClient } from "npm:@supabase/supabase-js@2";

// Cost/quality knob. claude-opus-4-8: $5/$25 per MTok.
// Cheaper alternative if usage grows: claude-haiku-4-5 ($1/$5 per MTok).
const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 1024;
// Hard limits so a runaway client can't rack up spend.
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 2000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type Profile = {
  display_name: string | null;
  age: number | null;
  sex: "male" | "female" | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string | null;
  goal: string | null;
};

// Keep in sync with src/features/plan/calculations.ts.
const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};
const GOAL_FACTOR: Record<string, number> = {
  lose_weight: 0.85,
  maintain: 1,
  gain_muscle: 1.1,
};
const PROTEIN_G_PER_KG: Record<string, number> = {
  lose_weight: 2.0,
  maintain: 1.6,
  gain_muscle: 1.8,
};

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function calculatePlan(p: Profile) {
  if (
    !p.age || !p.sex || !p.height_cm || !p.weight_kg ||
    !p.activity_level || !p.goal
  ) {
    return null;
  }
  const bmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age +
    (p.sex === "male" ? 5 : -161);
  const calories = Math.max(
    1200,
    roundTo(bmr * ACTIVITY_FACTOR[p.activity_level] * GOAL_FACTOR[p.goal], 50),
  );
  const proteinG = roundTo(p.weight_kg * PROTEIN_G_PER_KG[p.goal], 5);
  const fatG = roundTo((calories * 0.3) / 9, 5);
  const carbsG = Math.max(
    0,
    roundTo((calories - proteinG * 4 - fatG * 9) / 4, 5),
  );
  return { calories, proteinG, fatG, carbsG };
}

const GOAL_LABEL: Record<string, string> = {
  lose_weight: "bajar grasa",
  maintain: "mantener su peso",
  gain_muscle: "ganar músculo",
};
const ACTIVITY_LABEL: Record<string, string> = {
  sedentary: "casi nada de actividad",
  light: "actividad ligera (1-2 veces/semana)",
  moderate: "actividad moderada (3-4 veces/semana)",
  active: "bastante actividad (5-6 veces/semana)",
  very_active: "actividad intensa diaria",
};

function buildSystemPrompt(profile: Profile) {
  const plan = calculatePlan(profile);
  const facts = [
    profile.display_name && `- Nombre: ${profile.display_name}`,
    profile.age && `- Edad: ${profile.age} años`,
    profile.sex && `- Sexo: ${profile.sex === "male" ? "hombre" : "mujer"}`,
    profile.height_cm && `- Estatura: ${profile.height_cm} cm`,
    profile.weight_kg && `- Peso: ${profile.weight_kg} kg`,
    profile.activity_level &&
    `- Actividad: ${ACTIVITY_LABEL[profile.activity_level]}`,
    profile.goal && `- Meta: ${GOAL_LABEL[profile.goal]}`,
    plan &&
    `- Plan diario calculado: ${plan.calories} kcal, ${plan.proteinG} g proteína, ${plan.fatG} g grasas, ${plan.carbsG} g carbohidratos`,
  ].filter(Boolean).join("\n");

  return `Eres Sage 🌿, coach de nutrición y entrenamiento de la app Sage. Hablas español mexicano cálido y cercano, sin tecnicismos innecesarios. Tu filosofía: constancia amable, sin culpas, un día a la vez. Nunca promueves dietas extremas, ayunos agresivos ni déficits severos.

Perfil de la persona:
${facts}

Reglas:
- Responde corto: 2 a 5 oraciones para preguntas simples; usa listas breves solo cuando ayuden de verdad.
- Basa tus recomendaciones de comida y entrenamiento en su plan diario y su meta. Sugiere comida accesible y común en México.
- No eres profesional de la salud. Ante síntomas, lesiones, embarazo, trastornos alimenticios o condiciones médicas, recomienda con calidez consultar a un profesional y no des tratamiento.
- Si detectas una relación dañina con la comida o el ejercicio, prioriza el bienestar sobre la meta.
- Solo hablas de nutrición, entrenamiento, hábitos, descanso y bienestar. Si preguntan otra cosa, redirige con humor ligero a tu terreno.
- No uses encabezados de markdown; texto plano con emojis ocasionales.`;
}

/**
 * Escapes every non-ASCII UTF-16 code unit of the serialized JSON as a
 * backslash-u sequence, making the response body pure ASCII. React Native on
 * iOS decodes bodies without an explicit charset as Latin-1, which garbles
 * accented characters; an ASCII-only body is immune however it gets decoded.
 */
function toAsciiJson(body: unknown): string {
  const raw = JSON.stringify(body);
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    out += code < 128 ? raw[i] : "\\u" + code.toString(16).padStart(4, "0");
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(toAsciiJson(body), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
      },
    });

  try {
    // RLS-scoped client: acts as the calling user.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => null);
    const messages: unknown = body?.messages;
    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > MAX_MESSAGES ||
      !messages.every(
        (m): m is ChatMessage =>
          (m?.role === "user" || m?.role === "assistant") &&
          typeof m?.content === "string" &&
          m.content.length > 0 &&
          m.content.length <= MAX_MESSAGE_CHARS,
      ) ||
      messages[messages.length - 1].role !== "user"
    ) {
      return json({ error: "bad_request" }, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .single();
    if (profileError || !profile) {
      return json({ error: "profile_not_found" }, 400);
    }

    const anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
    });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(profile as Profile),
      messages,
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "refused" }, 502);
    }

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    return json({ reply });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: "busy" }, 429);
    }
    if (error instanceof Anthropic.APIError && error.status === 529) {
      return json({ error: "busy" }, 429);
    }
    console.error("coach error:", error);
    return json({ error: "internal" }, 500);
  }
});
