// Sage coach — Supabase Edge Function (Deno).
// Two modes, both JWT-verified and RLS-scoped to the calling user:
//   { type: "chat", messages }  → chat reply; persists the turn to chat_messages
//   { type: "daily_plan", date }→ generates today's meals+exercises checklist
//                                 (structured outputs) and upserts daily_plans;
//                                 completed items are kept, only the rest is rebuilt
// Secrets required: ANTHROPIC_API_KEY (Edge Functions > Secrets).
import Anthropic from "npm:@anthropic-ai/sdk@0.72.1";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// Cost/quality knob. claude-sonnet-5 balances quality and price for a demo.
// Cheaper alternative if usage grows: claude-haiku-4-5.
const MODEL = "claude-sonnet-5";
const CHAT_MAX_TOKENS = 1024;
const PLAN_MAX_TOKENS = 2048;
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
  food_notes: string | null;
  supplements: string | null;
  body_type: string | null;
  training_minutes_per_day: number | null;
  training_days_per_week: number | null;
  training_place: string | null;
  weekly_food_budget_mxn: number | null;
  injuries: string | null;
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
const BODY_LABEL: Record<string, string> = {
  ectomorph: "delgado, le cuesta subir de peso (ectomorfo)",
  mesomorph: "atlético, gana músculo con facilidad (mesomorfo)",
  endomorph: "robusto, sube de peso con facilidad (endomorfo)",
};
const PLACE_LABEL: Record<string, string> = {
  home: "en casa, con poco o nada de equipo",
  gym: "en el gimnasio, con máquinas y pesas",
};

function profileFacts(profile: Profile) {
  const plan = calculatePlan(profile);
  return [
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
    profile.body_type && `- Tipo de cuerpo: ${BODY_LABEL[profile.body_type]}`,
    profile.training_minutes_per_day && profile.training_days_per_week &&
    `- Tiempo para entrenar: ${profile.training_minutes_per_day} min/día, ${profile.training_days_per_week} días/semana`,
    profile.training_place &&
    `- Lugar de entrenamiento: ${PLACE_LABEL[profile.training_place]}`,
    profile.weekly_food_budget_mxn &&
    `- Presupuesto semanal de comida: $${profile.weekly_food_budget_mxn} MXN`,
    profile.injuries &&
    `- Lesiones o limitaciones físicas: ${profile.injuries}`,
    profile.food_notes &&
    `- Notas de comida (alergias, restricciones, gustos, presupuesto): ${profile.food_notes}`,
    profile.supplements &&
    `- Suplementos que toma: ${profile.supplements}`,
  ].filter(Boolean).join("\n");
}

type DailyPlanItem = {
  id: string;
  kind: "meal" | "exercise";
  title: string;
  detail: string;
  kcal?: number;
  done: boolean;
};

/** Today's checklist + latest photo analysis, so the chat can reference them. */
async function chatContext(supabase: SupabaseClient, localDate: unknown) {
  let context = "";

  if (typeof localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    const { data: plan } = await supabase
      .from("daily_plans")
      .select("items")
      .eq("plan_date", localDate)
      .maybeSingle();
    const items = (plan?.items ?? []) as DailyPlanItem[];
    if (items.length > 0) {
      const lines = items
        .map(
          (item) =>
            `- [${item.done ? "x" : " "}] ${
              item.kind === "meal" ? "Comida" : "Ejercicio"
            }: ${item.title} — ${item.detail}${
              item.kcal ? ` (${item.kcal} kcal)` : ""
            }`,
        )
        .join("\n");
      context +=
        `\n\nPlan de HOY (${localDate}); [x] = ya lo completó:\n${lines}`;
    }
  }

  const { data: photo } = await supabase
    .from("progress_photos")
    .select("created_at, analysis")
    .not("analysis", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (photo?.analysis) {
    context += `\n\nÚltimo análisis de progreso (foto del ${
      photo.created_at.slice(0, 10)
    }):\n${photo.analysis}`;
  }

  return context;
}

function chatSystemPrompt(profile: Profile, context: string) {
  return `Eres Sage 🌿, coach de nutrición y entrenamiento de la app Sage. Hablas español mexicano cálido y cercano, sin tecnicismos innecesarios. Tu filosofía: constancia amable, sin culpas, un día a la vez. Nunca promueves dietas extremas, ayunos agresivos ni déficits severos.

Perfil de la persona:
${profileFacts(profile)}${context}

Reglas:
- Responde corto: 2 a 5 oraciones para preguntas simples; usa listas breves solo cuando ayuden de verdad.
- Si tienes su plan de HOY, úsalo para dar consejos concretos: qué le falta por comer o entrenar, ajustes si ya se salió del plan, y reconoce lo que ya completó.
- Si tienes su último análisis de progreso, úsalo cuando pregunte cómo va o qué mejorar.
- Respeta SIEMPRE las alergias y restricciones de sus notas de comida: jamás sugieras un alimento que las viole. Ajusta también a sus gustos y presupuesto.
- Basa tus recomendaciones de comida y entrenamiento en su plan diario y su meta. Sugiere comida accesible y común en México.
- No eres profesional de la salud. Ante síntomas, lesiones, embarazo, trastornos alimenticios o condiciones médicas, recomienda con calidez consultar a un profesional y no des tratamiento.
- Si detectas una relación dañina con la comida o el ejercicio, prioriza el bienestar sobre la meta.
- Solo hablas de nutrición, entrenamiento, hábitos, descanso y bienestar. Si preguntan otra cosa, redirige con humor ligero a tu terreno.
- No uses encabezados de markdown; texto plano con emojis ocasionales.`;
}

function dailyPlanSystemPrompt(profile: Profile, kept: DailyPlanItem[]) {
  let prompt =
    `Eres Sage, coach de nutrición y entrenamiento. Genera el plan de HOY para esta persona, en español mexicano.

Perfil:
${profileFacts(profile)}

Reglas:
- Respeta SIEMPRE las alergias y restricciones de sus notas de comida: jamás incluyas un alimento que las viole. Ajusta también a sus gustos.
- Si indicó presupuesto semanal, las comidas del día deben caber en ~1/7 de ese presupuesto.
- Si toma suplementos, intégralos al plan donde tengan sentido (p. ej. batido de proteína post-entreno, creatina con una comida) contando sus kcal; no recomiendes suplementos nuevos.
- 3 o 4 comidas cuyas kcal sumen aproximadamente su objetivo diario (±5%), con buena proteína según su meta.
- Comida real, accesible y común en México; nada rebuscado ni caro.
- 2 a 4 ejercicios/actividades realistas para su nivel; el entrenamiento completo debe caber en sus minutos disponibles y hacerse en su lugar de entrenamiento (si entrena en casa, sin máquinas de gimnasio).
- Respeta SIEMPRE sus lesiones o limitaciones físicas: jamás incluyas ejercicios contraindicados; usa alternativas seguras que no carguen la zona afectada.
- "title" corto (máx 6 palabras); "detail" con porciones o series/repeticiones concretas, en una línea.
- Nunca planes extremos: nada de ayunos agresivos ni ejercicio excesivo.`;

  if (kept.length > 0) {
    const keptKcal = kept.reduce((sum, item) => sum + (item.kcal ?? 0), 0);
    const lines = kept
      .map(
        (item) =>
          `- ${item.kind === "meal" ? "Comida" : "Ejercicio"}: ${item.title} — ${item.detail}${item.kcal ? ` (${item.kcal} kcal)` : ""}`,
      )
      .join("\n");
    prompt += `

La persona YA completó hoy estos elementos (quedan fijos, NO los repitas ni los sustituyas):
${lines}

- Genera SOLO lo que falta del día: comidas nuevas para que el total (las completadas suman ${keptKcal} kcal) quede en 3 o 4 comidas y cerca de su objetivo diario, y ejercicios nuevos hasta completar 2 a 4 en total.
- Si una categoría ya quedó completa, devuelve su array vacío.
- Lo nuevo debe complementar lo ya hecho (no repitas el mismo grupo muscular ni la misma comida).`;
  }

  return prompt;
}

function photoAnalysisSystemPrompt(profile: Profile) {
  return `Eres Sage 🌿, coach de nutrición y entrenamiento. Evalúa el progreso físico de la persona a partir de sus fotos, en español mexicano cálido.

Perfil:
${profileFacts(profile)}

Reglas:
- 3 a 6 oraciones, texto plano, sin encabezados.
- Sé honesto pero amable: reconoce lo que sí avanza y sugiere 1 o 2 enfoques concretos alineados a su meta.
- Si solo hay una foto, descríbela como punto de partida y di qué observar en las siguientes.
- Las fotos caseras varían en luz, ángulo y ropa: no saques conclusiones tajantes ni compares milímetros.
- Nada de diagnósticos médicos ni porcentajes de grasa exactos. Si algo requiere atención médica, recomiéndalo con calidez.`;
}

const DAILY_PLAN_SCHEMA = {
  type: "object",
  properties: {
    meals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          kcal: { type: "integer" },
        },
        required: ["title", "detail", "kcal"],
        additionalProperties: false,
      },
    },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
        additionalProperties: false,
      },
    },
  },
  required: ["meals", "exercises"],
  additionalProperties: false,
} as const;

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

function json(body: unknown, status = 200) {
  return new Response(toAsciiJson(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function extractText(response: Anthropic.Message) {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

async function handleChat(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  userId: string,
  profile: Profile,
  messages: unknown,
  localDate: unknown,
) {
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

  const context = await chatContext(supabase, localDate);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: CHAT_MAX_TOKENS,
    system: chatSystemPrompt(profile, context),
    messages,
  });

  if (response.stop_reason === "refusal") {
    return json({ error: "refused" }, 502);
  }

  const reply = extractText(response);

  // Persist the completed turn. RLS scopes the insert to this user; a
  // failure here shouldn't eat the reply the user is waiting for.
  const { error: insertError } = await supabase.from("chat_messages").insert([
    {
      user_id: userId,
      role: "user",
      content: messages[messages.length - 1].content,
    },
    { user_id: userId, role: "assistant", content: reply },
  ]);
  if (insertError) console.error("chat persist error:", insertError);

  return json({ reply });
}

async function handleDailyPlan(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  userId: string,
  profile: Profile,
  date: unknown,
) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: "bad_request" }, 400);
  }

  // Completed items survive regeneration: only the unchecked part of the
  // day is rebuilt. RLS scopes the read to the caller's own row.
  const { data: existing } = await supabase
    .from("daily_plans")
    .select("items")
    .eq("plan_date", date)
    .maybeSingle();
  const kept = ((existing?.items ?? []) as DailyPlanItem[]).filter(
    (item) => item.done,
  );

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: PLAN_MAX_TOKENS,
    system: dailyPlanSystemPrompt(profile, kept),
    messages: [{ role: "user", content: `Genera mi plan del día ${date}.` }],
    output_config: {
      format: { type: "json_schema", schema: DAILY_PLAN_SCHEMA },
    },
  });

  if (response.stop_reason === "refusal") {
    return json({ error: "refused" }, 502);
  }

  const generated = JSON.parse(extractText(response)) as {
    meals: { title: string; detail: string; kcal: number }[];
    exercises: { title: string; detail: string }[];
  };

  const items = [
    ...kept.filter((item) => item.kind === "meal"),
    ...generated.meals.map((meal) => ({
      id: crypto.randomUUID(),
      kind: "meal",
      title: meal.title,
      detail: meal.detail,
      kcal: meal.kcal,
      done: false,
    })),
    ...kept.filter((item) => item.kind === "exercise"),
    ...generated.exercises.map((exercise) => ({
      id: crypto.randomUUID(),
      kind: "exercise",
      title: exercise.title,
      detail: exercise.detail,
      done: false,
    })),
  ];

  // Regenerating rebuilds only the unchecked part of the day.
  const { data: plan, error: upsertError } = await supabase
    .from("daily_plans")
    .upsert(
      { user_id: userId, plan_date: date, items },
      { onConflict: "user_id,plan_date" },
    )
    .select()
    .single();
  if (upsertError || !plan) {
    console.error("daily plan upsert error:", upsertError);
    return json({ error: "internal" }, 500);
  }

  return json({ plan });
}

async function handlePhotoAnalysis(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  profile: Profile,
  photoId: unknown,
) {
  if (typeof photoId !== "string" || photoId.length > 64) {
    return json({ error: "bad_request" }, 400);
  }

  // RLS guarantees these rows belong to the caller.
  const { data: photo, error: photoError } = await supabase
    .from("progress_photos")
    .select("*")
    .eq("id", photoId)
    .single();
  if (photoError || !photo) {
    return json({ error: "photo_not_found" }, 404);
  }

  const { data: previous } = await supabase
    .from("progress_photos")
    .select("*")
    .lt("created_at", photo.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const signedUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("progress-photos")
      .createSignedUrl(path, 600);
    if (error || !data) throw error ?? new Error("sign failed");
    return data.signedUrl;
  };

  const content: Anthropic.ContentBlockParam[] = [];
  if (previous) {
    content.push(
      {
        type: "text",
        text: `Foto ANTERIOR (${previous.created_at.slice(0, 10)}${
          previous.weight_kg ? `, ${previous.weight_kg} kg` : ""
        }):`,
      },
      {
        type: "image",
        source: { type: "url", url: await signedUrl(previous.storage_path) },
      },
    );
  }
  content.push(
    {
      type: "text",
      text: `Foto NUEVA (${photo.created_at.slice(0, 10)}${
        photo.weight_kg ? `, ${photo.weight_kg} kg` : ""
      }):`,
    },
    {
      type: "image",
      source: { type: "url", url: await signedUrl(photo.storage_path) },
    },
    {
      type: "text",
      text: previous
        ? "Evalúa mi progreso entre estas dos fotos."
        : "Esta es mi primera foto: descríbela como mi punto de partida.",
    },
  );

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: photoAnalysisSystemPrompt(profile),
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    return json({ error: "refused" }, 502);
  }

  const analysis = extractText(response);

  const { error: updateError } = await supabase
    .from("progress_photos")
    .update({ analysis })
    .eq("id", photoId);
  if (updateError) console.error("analysis save error:", updateError);

  return json({ analysis });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    if (!body) return json({ error: "bad_request" }, 400);

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

    // Default to chat for backwards compatibility with older app builds.
    const type = body.type ?? "chat";
    if (type === "chat") {
      return await handleChat(
        supabase,
        anthropic,
        userData.user.id,
        profile as Profile,
        body.messages,
        body.date,
      );
    }
    if (type === "daily_plan") {
      return await handleDailyPlan(
        supabase,
        anthropic,
        userData.user.id,
        profile as Profile,
        body.date,
      );
    }
    if (type === "photo_analysis") {
      return await handlePhotoAnalysis(
        supabase,
        anthropic,
        profile as Profile,
        body.photo_id,
      );
    }
    return json({ error: "bad_request" }, 400);
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
