// Sage coach — Supabase Edge Function (Deno).
// Modes, all JWT-verified and RLS-scoped to the calling user:
//   { type: "chat", messages }   → chat reply; persists the turn to chat_messages
//                                   (with stream: true, replies via SSE deltas)
//   { type: "daily_plan", date }  → generates today's meals+exercises checklist
//                                   (structured outputs) and upserts daily_plans;
//                                   completed items are kept, only the rest is rebuilt
//   { type: "shopping_list, week_start } → weekly list; keeps checked + scanned
//                                   items, regenerates the rest within budget
//   { type: "food_photo", image } → ephemeral food-photo estimate (3/day)
//   { type: "log_food", date, meal } → logs an eaten meal and recalculates the
//                                   day's remaining meals around it
//   { type: "photo_analysis", photo_id } → progress-photo feedback
//   { type: "weekly_review", week_start } → weekly check-in with adherence,
//                                   RAG, a safe plan tweak, body-image guardrails
// Secrets required: ANTHROPIC_API_KEY (Edge Functions > Secrets).
import Anthropic from "npm:@anthropic-ai/sdk@0.72.1";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// Cost/quality knob. claude-sonnet-5 balances quality and price for a demo.
// Cheaper alternative if usage grows: claude-haiku-4-5.
const MODEL = "claude-sonnet-5";
// Sonnet 5 runs adaptive thinking when `thinking` is omitted, and thinking
// spends from max_tokens — which truncated the daily-plan JSON. Disable it
// explicitly on every call to keep outputs fast and within budget.
const THINKING = { type: "disabled" } as const;
// Sonnet 5's tokenizer yields ~30% more tokens for the same text than the
// old Opus one; budgets sized up accordingly.
const CHAT_MAX_TOKENS = 1400;
const PLAN_MAX_TOKENS = 6000;
// Hard limits so a runaway client can't rack up spend.
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 2000;
// Each generation kind is capped per rolling 24h window, on SERVER time —
// the device clock is irrelevant, so changing the phone's hour won't help.
const DAILY_GENERATION_LIMIT = 3;
const LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  training_equipment: string[] | null;
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
const EQUIPMENT_LABEL: Record<string, string> = {
  none: "solo su cuerpo (sin equipo)",
  dumbbells: "mancuernas",
  barbell: "barra y discos",
  bench: "banco",
  resistance_bands: "ligas de resistencia",
  pull_up_bar: "barra de dominadas",
  kettlebell: "pesa rusa",
  cardio_machine: "caminadora o bici fija",
  full_gym: "gimnasio completo (máquinas y pesos libres)",
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
    profile.training_equipment && profile.training_equipment.length > 0 &&
    `- Equipo disponible: ${
      profile.training_equipment
        .map((item) => EQUIPMENT_LABEL[item] ?? item)
        .join(", ")
    }`,
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
- No uses encabezados de markdown; texto plano con emojis ocasionales.
- Si hay "Base de conocimiento" abajo, apóyate en ella para dar recomendaciones con respaldo y cierra tu respuesta con una línea "Fuentes: " citando el título de las fuentes que SÍ usaste. Si no la usaste o no aplica, no inventes fuentes ni agregues esa línea.`;
}

/**
 * RAG: embeds the question with Voyage AI and pulls the top matching
 * knowledge chunks via the match_knowledge_chunks RPC. Returns "" (and the
 * chat degrades gracefully to no-RAG) when the key or table are missing.
 */
async function retrieveKnowledge(
  supabase: SupabaseClient,
  question: string,
): Promise<string> {
  const key = Deno.env.get("VOYAGE_API_KEY");
  if (!key) return "";

  try {
    const embedResponse = await fetch(
      "https://api.voyageai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "voyage-3.5",
          input: [question.slice(0, 1000)],
          input_type: "query",
        }),
      },
    );
    if (!embedResponse.ok) {
      console.error("voyage error:", embedResponse.status);
      return "";
    }
    const embedding = (await embedResponse.json())?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) return "";

    const { data: chunks, error } = await supabase.rpc(
      "match_knowledge_chunks",
      { query_embedding: embedding, match_count: 4 },
    );
    if (error || !Array.isArray(chunks) || chunks.length === 0) {
      if (error) console.error("match_knowledge_chunks error:", error);
      return "";
    }

    const relevant = chunks.filter(
      (chunk) => (chunk.similarity ?? 0) > 0.4,
    );
    if (relevant.length === 0) return "";

    const lines = relevant
      .map(
        (chunk) =>
          `- [${chunk.source_title}] (${chunk.source_url}): ${chunk.content}`,
      )
      .join("\n");
    return `\n\nBase de conocimiento (fragmentos relevantes; cita el título de las fuentes que uses):\n${lines}`;
  } catch (error) {
    console.error("rag error:", error);
    return "";
  }
}

function dailyPlanSystemPrompt(
  profile: Profile,
  kept: DailyPlanItem[],
  recentMeals: string[],
) {
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
- Usa SOLO el equipo disponible del perfil (los ejercicios de peso corporal siempre valen); si no indicó equipo, asume lo típico de su lugar de entrenamiento.
- Nombra cada ejercicio con su nombre común y estándar en español, mencionando el equipo en el título cuando aplique (p. ej. "Sentadilla goblet", "Zancadas con mancuernas", "Remo con liga", "Plancha").
- Respeta SIEMPRE sus lesiones o limitaciones físicas: jamás incluyas ejercicios contraindicados; usa alternativas seguras que no carguen la zona afectada.
- "title" corto (máx 6 palabras); "detail" con porciones o series/repeticiones concretas, en una línea.
- Nunca planes extremos: nada de ayunos agresivos ni ejercicio excesivo.`;

  if (recentMeals.length > 0) {
    prompt += `

Platillos de sus días recientes (NO los repitas hoy; varía proteínas, guarniciones y estilo de cocina respecto a esta lista):
${recentMeals.map((title) => `- ${title}`).join("\n")}`;
  }

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

/**
 * Meal-only regeneration after the user logs an off-plan meal (e.g. from a
 * food photo). The eaten meals are fixed; Sage refills only what's left of
 * the daily calorie budget so the logged meal is effectively "discounted".
 */
function mealRecalcSystemPrompt(
  profile: Profile,
  fixedMeals: DailyPlanItem[],
  recentMeals: string[],
) {
  const plan = calculatePlan(profile);
  const target = plan ? plan.calories : null;
  const fixedKcal = fixedMeals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);
  const remaining = target !== null ? target - fixedKcal : null;

  const fixedLines = fixedMeals
    .map(
      (m) => `- ${m.title} — ${m.detail}${m.kcal ? ` (${m.kcal} kcal)` : ""}`,
    )
    .join("\n");

  let prompt =
    `Eres Sage, coach de nutrición. La persona ya comió ciertos platillos hoy y necesitas RECALCULAR solo las comidas que le faltan para cerrar bien su día, en español mexicano.

Perfil:
${profileFacts(profile)}

Comidas que la persona YA comió hoy (quedan FIJAS, NO las repitas ni las modifiques; suman ${fixedKcal} kcal):
${fixedLines || "- (ninguna aún)"}

Reglas:
- Respeta SIEMPRE las alergias y restricciones de sus notas de comida.
- ${
      remaining !== null
        ? `Le quedan aproximadamente ${remaining} kcal para llegar a su objetivo diario de ${target} kcal. Genera las comidas que faltan para que el TOTAL del día (lo ya comido + lo nuevo) quede cerca de ese objetivo (±5%), en 3 o 4 comidas en total contando las fijas.`
        : "Genera 1 a 3 comidas razonables que complementen lo ya comido para un día equilibrado."
    }
- Si lo que ya comió alcanza o supera su objetivo del día, devuelve meals como arreglo vacío (no fuerces más comida).
- Prioriza buena proteína según su meta y comida real, accesible y común en México.
- No repitas el estilo ni la proteína principal de lo que ya comió; que lo nuevo complemente, no duplique.
- "title" corto (máx 6 palabras); "detail" con porciones concretas en una línea; "kcal" entero por comida.
- Nunca planes extremos ni mensajes con culpa.`;

  if (recentMeals.length > 0) {
    prompt += `

Platillos de sus días recientes (evita repetirlos; varía):
${recentMeals.map((title) => `- ${title}`).join("\n")}`;
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

function shoppingListSystemPrompt(
  profile: Profile,
  recentMeals: string[],
  kept: ShoppingItem[],
) {
  const keptMxn = kept.reduce((sum, item) => sum + (item.est_mxn ?? 0), 0);
  const budget = profile.weekly_food_budget_mxn;
  const remaining = budget !== null ? Math.max(0, budget - keptMxn) : null;

  let prompt =
    `Eres Sage, coach de nutrición. Genera la lista del súper para UNA semana de esta persona, en español mexicano.

Perfil:
${profileFacts(profile)}

Reglas:
- Ingredientes reales de supermercado mexicano (Walmart/Soriana/mercado); nada rebuscado.
- Cantidades concretas por semana en "quantity" (p. ej. "1 kg", "12 pzas", "2 L").
- "est_mxn" es el precio estimado del artículo en pesos mexicanos (entero).
- Respeta SIEMPRE las alergias y restricciones de sus notas de comida.
- ${
      remaining !== null
        ? `La persona YA tiene apartados $${keptMxn} MXN de su presupuesto semanal de $${budget} MXN. La suma de est_mxn de los artículos NUEVOS que generes debe caber en los ~$${remaining} MXN restantes (idealmente ~90% para dejar margen).`
        : "Sin presupuesto indicado: mantén la lista económica y realista."
    }
- 12 a 20 artículos: proteínas, verduras, frutas, granos y básicos que cubran la semana según su plan calculado.
- "title" corto (máx 4 palabras).`;

  if (kept.length > 0) {
    const lines = kept
      .map((item) => `- ${item.title} (${item.quantity})`)
      .join("\n");
    prompt += `

La persona YA tiene estos artículos en su lista (NO los repitas ni sugieras equivalentes; genera solo lo que falta para complementarlos):
${lines}`;
  }

  if (recentMeals.length > 0) {
    prompt += `

Platillos recientes de su plan (la lista debe alcanzar para prepararlos o variantes cercanas):
${recentMeals.map((title) => `- ${title}`).join("\n")}`;
  }

  return prompt;
}

const SHOPPING_LIST_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          quantity: { type: "string" },
          est_mxn: { type: "integer" },
        },
        required: ["title", "quantity", "est_mxn"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

const MEALS_ONLY_SCHEMA = {
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
  },
  required: ["meals"],
  additionalProperties: false,
} as const;

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

type GenerationKind = "daily_plan" | "shopping_list" | "food_photo";

/**
 * Hours until the user may generate `kind` again, or null if still allowed.
 * Counts ai_generations rows in the rolling window (RLS scopes to caller).
 */
async function generationHoursLeft(
  supabase: SupabaseClient,
  kind: GenerationKind,
) {
  const since = new Date(Date.now() - LIMIT_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from("ai_generations")
    .select("created_at")
    .eq("kind", kind)
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (!data || data.length < DAILY_GENERATION_LIMIT) return null;

  const oldest = new Date(data[0].created_at as string).getTime();
  return Math.max(
    1,
    Math.ceil((oldest + LIMIT_WINDOW_MS - Date.now()) / (60 * 60 * 1000)),
  );
}

async function recordGeneration(
  supabase: SupabaseClient,
  userId: string,
  kind: GenerationKind,
) {
  const { error } = await supabase
    .from("ai_generations")
    .insert({ user_id: userId, kind });
  if (error) console.error("generation record error:", error);
}

/** Validates the chat payload; returns the messages or null when malformed. */
function validChatMessages(messages: unknown): ChatMessage[] | null {
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
    return null;
  }
  return messages;
}

/** Persists a completed chat turn; a failure shouldn't eat the reply. */
async function persistChatTurn(
  supabase: SupabaseClient,
  userId: string,
  question: string,
  reply: string,
) {
  const { error } = await supabase.from("chat_messages").insert([
    { user_id: userId, role: "user", content: question },
    { user_id: userId, role: "assistant", content: reply },
  ]);
  if (error) console.error("chat persist error:", error);
}

async function handleChat(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  userId: string,
  profile: Profile,
  rawMessages: unknown,
  localDate: unknown,
) {
  const messages = validChatMessages(rawMessages);
  if (!messages) {
    return json({ error: "bad_request" }, 400);
  }

  const lastQuestion = messages[messages.length - 1].content;
  const [context, knowledge] = await Promise.all([
    chatContext(supabase, localDate),
    retrieveKnowledge(supabase, lastQuestion),
  ]);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: CHAT_MAX_TOKENS,
    thinking: THINKING,
    system: chatSystemPrompt(profile, context + knowledge),
    messages,
  });

  if (response.stop_reason === "refusal") {
    return json({ error: "refused" }, 502);
  }

  const reply = extractText(response);
  await persistChatTurn(supabase, userId, lastQuestion, reply);

  return json({ reply });
}

/**
 * Streaming chat (body.stream === true): same prompt as handleChat, but the
 * reply goes out as Server-Sent Events while the model generates it —
 *   data: {"delta":"..."}   text as it arrives
 *   data: {"done":true}     the turn finished and was persisted
 *   data: {"error":"..."}   busy | refused | internal (terminal)
 * Every event's JSON is ASCII-escaped (see toAsciiJson), so the client can
 * decode the bytes safely no matter what charset it assumes.
 */
async function handleChatStream(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  userId: string,
  profile: Profile,
  rawMessages: unknown,
  localDate: unknown,
) {
  const messages = validChatMessages(rawMessages);
  if (!messages) {
    return json({ error: "bad_request" }, 400);
  }

  const lastQuestion = messages[messages.length - 1].content;
  const [context, knowledge] = await Promise.all([
    chatContext(supabase, localDate),
    retrieveKnowledge(supabase, lastQuestion),
  ]);

  const encoder = new TextEncoder();
  const sse = (payload: unknown) =>
    encoder.encode(`data: ${toAsciiJson(payload)}\n\n`);

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Errors here happen after the 200 header is sent, so they travel as
      // terminal SSE events instead of HTTP statuses.
      try {
        const events = await anthropic.messages.create({
          model: MODEL,
          max_tokens: CHAT_MAX_TOKENS,
          thinking: THINKING,
          system: chatSystemPrompt(profile, context + knowledge),
          messages,
          stream: true,
        });

        let reply = "";
        let refused = false;
        for await (const event of events) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            reply += event.delta.text;
            controller.enqueue(sse({ delta: event.delta.text }));
          } else if (
            event.type === "message_delta" &&
            event.delta.stop_reason === "refusal"
          ) {
            refused = true;
          }
        }

        if (refused || reply.length === 0) {
          controller.enqueue(sse({ error: "refused" }));
        } else {
          await persistChatTurn(supabase, userId, lastQuestion, reply);
          controller.enqueue(sse({ done: true }));
        }
      } catch (error) {
        const busy = error instanceof Anthropic.RateLimitError ||
          (error instanceof Anthropic.APIError && error.status === 529);
        if (!busy) console.error("chat stream error:", error);
        controller.enqueue(sse({ error: busy ? "busy" : "internal" }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
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

  const hoursLeft = await generationHoursLeft(supabase, "daily_plan");
  if (hoursLeft !== null) {
    return json({ error: "limit", hours_left: hoursLeft }, 429);
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

  // Meal titles from the last week feed the prompt so days don't repeat
  // the same dishes (RLS scopes the read to the caller's own rows).
  const recentMeals = await recentMealTitles(supabase, date);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: PLAN_MAX_TOKENS,
    thinking: THINKING,
    system: dailyPlanSystemPrompt(profile, kept, recentMeals),
    messages: [{ role: "user", content: `Genera mi plan del día ${date}.` }],
    output_config: {
      format: { type: "json_schema", schema: DAILY_PLAN_SCHEMA },
    },
  });

  if (response.stop_reason === "refusal") {
    return json({ error: "refused" }, 502);
  }
  if (response.stop_reason === "max_tokens") {
    // Truncated JSON would make JSON.parse throw into the generic catch;
    // fail here so the logs say what actually happened.
    console.error("daily plan truncated at", PLAN_MAX_TOKENS, "tokens");
    return json({ error: "internal" }, 500);
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

  await recordGeneration(supabase, userId, "daily_plan");
  return json({ plan });
}

const FOOD_PHOTO_SCHEMA = {
  type: "object",
  properties: {
    foods: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          grams: { type: "integer" },
          kcal: { type: "integer" },
          protein_g: { type: "integer" },
        },
        required: ["name", "grams", "kcal", "protein_g"],
        additionalProperties: false,
      },
    },
    total_kcal: { type: "integer" },
    note: { type: "string" },
  },
  required: ["foods", "total_kcal", "note"],
  additionalProperties: false,
} as const;

const FOOD_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Food photo → structured estimate. EPHEMERAL by design: the image lives
 * only in this request — it is never written to Storage or the database.
 * Capped at 3 scans/day (server clock) like the other AI generations, so a
 * misread photo can't be re-run indefinitely on our dime.
 */
async function handleFoodPhoto(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  userId: string,
  image: unknown,
  mediaType: unknown,
) {
  if (
    typeof image !== "string" ||
    image.length === 0 ||
    image.length > 7_000_000 || // ~5 MB of base64
    typeof mediaType !== "string" ||
    !FOOD_MEDIA_TYPES.includes(mediaType)
  ) {
    return json({ error: "bad_request" }, 400);
  }

  const hoursLeft = await generationHoursLeft(supabase, "food_photo");
  if (hoursLeft !== null) {
    return json({ error: "limit", hours_left: hoursLeft }, 429);
  }

  // Sonnet (not Haiku): food ID from home photos needs the better eyes —
  // Haiku confused a strawberry cheesecake with a ham tart in testing.
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    thinking: THINKING,
    system:
      `Eres Sage, coach de nutrición. Identifica los alimentos de la foto y estima porciones, en español mexicano.

Reglas:
- Observa con cuidado colores, texturas y contexto antes de decidir: distingue lo dulce (postres, frutas, mermeladas, crema) de lo salado (carnes, embutidos, quesos curados). Si dudas entre dos platillos, elige el más probable y dilo en "note".
- Son ESTIMACIONES aproximadas a partir de una foto casera; sé razonable, no exacto.
- "name" corto por alimento; "grams", "kcal" y "protein_g" enteros estimados.
- "total_kcal" es la suma de las kcal.
- "note" es UNA oración amable y neutral sobre el platillo (jamás culposa ni alarmista).
- Si la foto no muestra comida, devuelve foods vacío, total_kcal 0 y explícalo en note.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
              data: image,
            },
          },
          { type: "text", text: "¿Qué comida hay en esta foto?" },
        ],
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: FOOD_PHOTO_SCHEMA },
    },
  });

  if (response.stop_reason === "refusal") {
    return json({ error: "refused" }, 502);
  }
  if (response.stop_reason === "max_tokens") {
    console.error("food photo output truncated");
    return json({ error: "internal" }, 500);
  }

  // Only a scan that actually produced an estimate counts against the limit.
  await recordGeneration(supabase, userId, "food_photo");
  return json({ meal: JSON.parse(extractText(response)) });
}

/** Meal titles from the last week (excluding `date`), newest plans first. */
async function recentMealTitles(
  supabase: SupabaseClient,
  date: string,
): Promise<string[]> {
  const { data: recentPlans } = await supabase
    .from("daily_plans")
    .select("items")
    .lt("plan_date", date)
    .order("plan_date", { ascending: false })
    .limit(7);
  return [
    ...new Set(
      (recentPlans ?? []).flatMap((row) =>
        ((row.items ?? []) as DailyPlanItem[])
          .filter((item) => item.kind === "meal")
          .map((item) => item.title),
      ),
    ),
  ];
}

/**
 * Logs an off-plan meal the user actually ate (e.g. from a food photo) into
 * today's plan and recalculates the day: the eaten meal is added as done,
 * and the still-unchecked meals are rebuilt to fit whatever calories remain.
 * Exercises and already-completed meals are left untouched. If the recalc
 * model call fails, the meal is still appended so the log is never lost.
 */
async function handleLogFood(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  userId: string,
  profile: Profile,
  date: unknown,
  meal: unknown,
) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: "bad_request" }, 400);
  }
  const m = meal as { title?: unknown; detail?: unknown; kcal?: unknown };
  if (
    !m ||
    typeof m.title !== "string" ||
    m.title.length === 0 ||
    m.title.length > 120 ||
    typeof m.detail !== "string" ||
    m.detail.length > 400 ||
    typeof m.kcal !== "number" ||
    !Number.isFinite(m.kcal) ||
    m.kcal < 0 ||
    m.kcal > 10000
  ) {
    return json({ error: "bad_request" }, 400);
  }

  const { data: existing } = await supabase
    .from("daily_plans")
    .select("id, items")
    .eq("plan_date", date)
    .maybeSingle();
  if (!existing) {
    return json({ error: "no_plan" }, 409);
  }
  const items = (existing.items ?? []) as DailyPlanItem[];

  const loggedMeal: DailyPlanItem = {
    id: crypto.randomUUID(),
    kind: "meal",
    title: m.title,
    detail: m.detail,
    kcal: Math.round(m.kcal),
    done: true, // photographed on the plate — already eaten
  };

  const exercises = items.filter((item) => item.kind === "exercise");
  const doneMeals = items.filter(
    (item) => item.kind === "meal" && item.done,
  );
  const fixedMeals = [...doneMeals, loggedMeal];

  // Rebuild only the still-unchecked meals to fit the remaining calories.
  let recalcMeals: DailyPlanItem[] = [];
  let recalcOk = false;
  try {
    const recentMeals = await recentMealTitles(supabase, date);
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: PLAN_MAX_TOKENS,
      thinking: THINKING,
      system: mealRecalcSystemPrompt(profile, fixedMeals, recentMeals),
      messages: [
        { role: "user", content: "Recalcula las comidas que me faltan hoy." },
      ],
      output_config: {
        format: { type: "json_schema", schema: MEALS_ONLY_SCHEMA },
      },
    });
    if (
      response.stop_reason !== "refusal" &&
      response.stop_reason !== "max_tokens"
    ) {
      const generated = JSON.parse(extractText(response)) as {
        meals: { title: string; detail: string; kcal: number }[];
      };
      recalcMeals = generated.meals.map((gen) => ({
        id: crypto.randomUUID(),
        kind: "meal" as const,
        title: gen.title,
        detail: gen.detail,
        kcal: gen.kcal,
        done: false,
      }));
      recalcOk = true;
    }
  } catch (error) {
    console.error("meal recalc failed, appending only:", error);
  }

  // When the recalc succeeds we swap the unchecked meals for the new ones;
  // otherwise we keep them so a model hiccup doesn't wipe the day's plan.
  const keptUncheckedMeals = recalcOk
    ? []
    : items.filter((item) => item.kind === "meal" && !item.done);

  const nextItems: DailyPlanItem[] = [
    ...doneMeals,
    loggedMeal,
    ...keptUncheckedMeals,
    ...recalcMeals,
    ...exercises,
  ];

  const { data: plan, error: updateError } = await supabase
    .from("daily_plans")
    .update({ items: nextItems })
    .eq("id", existing.id)
    .select()
    .single();
  if (updateError || !plan) {
    console.error("log food update error:", updateError);
    return json({ error: "internal" }, 500);
  }

  return json({ plan, recalculated: recalcOk });
}

type ShoppingItem = {
  id: string;
  title: string;
  quantity: string;
  est_mxn: number;
  done: boolean;
};

/**
 * Items the user added by hand (e.g. a scanned product) carry a "manual-"
 * id; AI-generated items get a UUID. Manual items survive regeneration and
 * are the only ones the client lets the user delete.
 */
function isManualItem(id: string) {
  return typeof id === "string" && id.startsWith("manual-");
}

async function handleShoppingList(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  userId: string,
  profile: Profile,
  weekStart: unknown,
) {
  if (typeof weekStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return json({ error: "bad_request" }, 400);
  }

  const hoursLeft = await generationHoursLeft(supabase, "shopping_list");
  if (hoursLeft !== null) {
    return json({ error: "limit", hours_left: hoursLeft }, 429);
  }

  // Regenerating rebuilds only the not-yet-checked AI items. Checked items
  // (already bought) and scanned products the user added by hand survive
  // verbatim; only the rest is replaced, fitted to the leftover budget.
  const { data: existing } = await supabase
    .from("shopping_lists")
    .select("items")
    .eq("week_start", weekStart)
    .maybeSingle();
  const kept = ((existing?.items ?? []) as ShoppingItem[]).filter(
    (item) => item.done || isManualItem(item.id),
  );

  // Recent meals keep the list aligned with what the plan actually serves.
  const { data: recentPlans } = await supabase
    .from("daily_plans")
    .select("items")
    .order("plan_date", { ascending: false })
    .limit(7);
  const recentMeals = [
    ...new Set(
      (recentPlans ?? []).flatMap((row) =>
        ((row.items ?? []) as DailyPlanItem[])
          .filter((item) => item.kind === "meal")
          .map((item) => item.title),
      ),
    ),
  ];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: PLAN_MAX_TOKENS,
    thinking: THINKING,
    system: shoppingListSystemPrompt(profile, recentMeals, kept),
    messages: [
      {
        role: "user",
        content: `Genera mi lista del súper para la semana del ${weekStart}.`,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: SHOPPING_LIST_SCHEMA },
    },
  });

  if (response.stop_reason === "refusal") {
    return json({ error: "refused" }, 502);
  }
  if (response.stop_reason === "max_tokens") {
    console.error("shopping list truncated at", PLAN_MAX_TOKENS, "tokens");
    return json({ error: "internal" }, 500);
  }

  const generated = JSON.parse(extractText(response)) as {
    items: { title: string; quantity: string; est_mxn: number }[];
  };

  const items: ShoppingItem[] = [
    ...kept,
    ...generated.items.map((item) => ({
      id: crypto.randomUUID(),
      title: item.title,
      quantity: item.quantity,
      est_mxn: item.est_mxn,
      done: false,
    })),
  ];

  const { data: list, error: upsertError } = await supabase
    .from("shopping_lists")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        items,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_start" },
    )
    .select()
    .single();
  if (upsertError || !list) {
    console.error("shopping list upsert error:", upsertError);
    return json({ error: "internal" }, 500);
  }

  await recordGeneration(supabase, userId, "shopping_list");
  return json({ list });
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

  // Compare against the previous photo of the SAME pose — a back photo
  // against a front one would read as fake progress. Photos from before
  // poses existed (null) count as front.
  const pose = (photo.pose ?? "front") as string;
  const { data: candidates } = await supabase
    .from("progress_photos")
    .select("*")
    .lt("created_at", photo.created_at)
    .order("created_at", { ascending: false })
    .limit(20);
  const previous = (candidates ?? []).find(
    (p) => ((p.pose ?? "front") as string) === pose,
  ) ?? null;

  const signedUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("progress-photos")
      .createSignedUrl(path, 600);
    if (error || !data) throw error ?? new Error("sign failed");
    return data.signedUrl;
  };

  const POSE_LABEL: Record<string, string> = {
    front: "de frente",
    back: "de espalda",
    side: "de perfil",
  };
  const poseLabel = POSE_LABEL[pose] ?? POSE_LABEL.front;

  const content: Anthropic.ContentBlockParam[] = [];
  if (previous) {
    content.push(
      {
        type: "text",
        text: `Foto ANTERIOR ${poseLabel} (${
          previous.created_at.slice(0, 10)
        }${previous.weight_kg ? `, ${previous.weight_kg} kg` : ""}):`,
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
      text: `Foto NUEVA ${poseLabel} (${photo.created_at.slice(0, 10)}${
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
        ? `Evalúa mi progreso entre estas dos fotos ${poseLabel}.`
        : `Esta es mi primera foto ${poseLabel}: descríbela como mi punto de partida.`,
    },
  );

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    thinking: THINKING,
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

type WeekAdherence = {
  days: number;
  mealsDone: number;
  mealsTotal: number;
  exercisesDone: number;
  exercisesTotal: number;
};

function weeklyReviewSystemPrompt(
  profile: Profile,
  adherence: WeekAdherence,
  weightNote: string,
  photoNote: string,
  knowledge: string,
) {
  const mealPct = adherence.mealsTotal > 0
    ? Math.round((adherence.mealsDone / adherence.mealsTotal) * 100)
    : 0;
  const exPct = adherence.exercisesTotal > 0
    ? Math.round((adherence.exercisesDone / adherence.exercisesTotal) * 100)
    : 0;

  return `Eres Sage 🌿, coach de nutrición y entrenamiento. Haz el resumen semanal (check-in) de la persona en español mexicano cálido y cercano. Tu filosofía: constancia amable, sin culpas, un paso a la vez.

Perfil:
${profileFacts(profile)}

Adherencia de esta semana:
- Días con plan: ${adherence.days}
- Comidas completadas: ${adherence.mealsDone} de ${adherence.mealsTotal} (${mealPct}%)
- Ejercicios completados: ${adherence.exercisesDone} de ${adherence.exercisesTotal} (${exPct}%)${weightNote}${photoNote}

Reglas:
- 4 a 7 oraciones, texto plano, sin encabezados de markdown, con emojis ocasionales.
- Empieza reconociendo lo que SÍ logró (por poco que sea); luego señala con cariño 1 o 2 cosas para mejorar.
- Propón UN solo ajuste concreto, pequeño y seguro para la próxima semana, alineado a su meta. Jamás sugieras déficits agresivos, ayunos, ni más ejercicio del que su tiempo permite.
- GUARDARRAÍLES de imagen corporal: no juzgues su cuerpo ni hables de "verse bien o mal". Enfócate en hábitos, energía, fuerza, descanso y cómo se siente. Si notas señales de una relación dañina con la comida o el ejercicio (obsesión, castigo, culpa), prioriza su bienestar sobre la meta y sugiere con calidez apoyo profesional.
- No eres profesional de la salud: ante temas médicos, embarazo o trastornos alimenticios, recomienda con calidez consultar a un profesional.
- Si hay "Base de conocimiento" abajo, apóyate en ella y cierra con una línea "Fuentes: " citando el título de las fuentes que SÍ usaste; si no la usaste, no agregues esa línea.${knowledge}`;
}

/**
 * Weekly check-in: computes the week's adherence from daily_plans, optionally
 * folds in recent progress photos, retrieves RAG knowledge, and asks Sage for
 * warm feedback plus one safe plan tweak. Persists to weekly_reviews.
 */
async function handleWeeklyReview(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  userId: string,
  profile: Profile,
  weekStart: unknown,
  feeling: unknown,
  includePhotos: unknown,
) {
  if (typeof weekStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return json({ error: "bad_request" }, 400);
  }
  const feelingText =
    typeof feeling === "string" ? feeling.slice(0, 500).trim() : "";

  // The 7-day window [weekStart, weekStart+7).
  const start = new Date(`${weekStart}T00:00:00Z`);
  const weekEnd = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: plans } = await supabase
    .from("daily_plans")
    .select("items")
    .gte("plan_date", weekStart)
    .lt("plan_date", weekEnd);

  const adherence: WeekAdherence = {
    days: plans?.length ?? 0,
    mealsDone: 0,
    mealsTotal: 0,
    exercisesDone: 0,
    exercisesTotal: 0,
  };
  for (const row of plans ?? []) {
    for (const item of (row.items ?? []) as DailyPlanItem[]) {
      if (item.kind === "meal") {
        adherence.mealsTotal++;
        if (item.done) adherence.mealsDone++;
      } else {
        adherence.exercisesTotal++;
        if (item.done) adherence.exercisesDone++;
      }
    }
  }

  // Weight delta across the week's progress photos, when available.
  let weightNote = "";
  const { data: weights } = await supabase
    .from("progress_photos")
    .select("created_at, weight_kg")
    .not("weight_kg", "is", null)
    .order("created_at", { ascending: true })
    .limit(60);
  if (weights && weights.length > 0) {
    const first = weights[0];
    const last = weights[weights.length - 1];
    if (weights.length >= 2 && first.weight_kg !== last.weight_kg) {
      const delta =
        Math.round(((last.weight_kg as number) - (first.weight_kg as number)) *
          10) / 10;
      weightNote =
        `\n- Peso registrado: de ${first.weight_kg} kg a ${last.weight_kg} kg (${
          delta > 0 ? "+" : ""
        }${delta} kg en el periodo registrado)`;
    } else {
      weightNote = `\n- Último peso registrado: ${last.weight_kg} kg`;
    }
  }

  // Opt-in: fold the latest progress-photo analysis in as text context. We
  // reuse the already-computed analysis rather than re-running vision.
  let photoNote = "";
  if (includePhotos === true) {
    const { data: photo } = await supabase
      .from("progress_photos")
      .select("created_at, analysis")
      .not("analysis", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (photo?.analysis) {
      photoNote = `\n- Último análisis de foto de progreso (${
        photo.created_at.slice(0, 10)
      }): ${photo.analysis}`;
    }
  }

  const knowledge = await retrieveKnowledge(
    supabase,
    `progreso semanal, ${GOAL_LABEL[profile.goal ?? ""] ?? ""} ${feelingText}`,
  );

  const userMsg = feelingText
    ? `Este es mi check-in de la semana. Cómo me sentí: ${feelingText}`
    : "Dame mi resumen de la semana.";

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: CHAT_MAX_TOKENS,
    thinking: THINKING,
    system: weeklyReviewSystemPrompt(
      profile,
      adherence,
      weightNote,
      photoNote,
      knowledge,
    ),
    messages: [{ role: "user", content: userMsg }],
  });

  if (response.stop_reason === "refusal") {
    return json({ error: "refused" }, 502);
  }
  const summary = extractText(response);

  const { data: review, error: upsertError } = await supabase
    .from("weekly_reviews")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        feeling: feelingText || null,
        summary,
        meals_done: adherence.mealsDone,
        meals_total: adherence.mealsTotal,
        exercises_done: adherence.exercisesDone,
        exercises_total: adherence.exercisesTotal,
      },
      { onConflict: "user_id,week_start" },
    )
    .select()
    .single();
  if (upsertError || !review) {
    console.error("weekly review upsert error:", upsertError);
    return json({ error: "internal" }, 500);
  }

  return json({ review });
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
    if (type === "chat" && body.stream === true) {
      return await handleChatStream(
        supabase,
        anthropic,
        userData.user.id,
        profile as Profile,
        body.messages,
        body.date,
      );
    }
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
    if (type === "shopping_list") {
      return await handleShoppingList(
        supabase,
        anthropic,
        userData.user.id,
        profile as Profile,
        body.week_start,
      );
    }
    if (type === "food_photo") {
      return await handleFoodPhoto(
        supabase,
        anthropic,
        userData.user.id,
        body.image,
        body.media_type,
      );
    }
    if (type === "log_food") {
      return await handleLogFood(
        supabase,
        anthropic,
        userData.user.id,
        profile as Profile,
        body.date,
        body.meal,
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
    if (type === "weekly_review") {
      return await handleWeeklyReview(
        supabase,
        anthropic,
        userData.user.id,
        profile as Profile,
        body.week_start,
        body.feeling,
        body.include_photos,
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
