/**
 * Offline RAG ingestion: reads supabase/knowledge/*.md, chunks each doc,
 * embeds the chunks with Voyage AI (voyage-3.5, 1024 dims) and upserts
 * them into public.knowledge_chunks. Idempotent per source (delete+insert).
 *
 * Required env vars (reads .env first, process.env wins):
 *   EXPO_PUBLIC_SUPABASE_URL   — already in .env
 *   SUPABASE_SERVICE_ROLE_KEY  — dashboard > Settings > API (keep secret!)
 *   VOYAGE_API_KEY             — dashboard.voyageai.com
 *
 * Run: node scripts/ingest-knowledge.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Minimal .env loader (no extra dependency).
const env = { ...process.env };
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*"?([^"\r]*)"?\s*$/);
    if (match && env[match[1]] === undefined) env[match[1]] = match[2];
  }
}

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const VOYAGE_KEY = env.VOYAGE_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !VOYAGE_KEY) {
  console.error(
    "Faltan variables: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y/o VOYAGE_API_KEY",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const KNOWLEDGE_DIR = join("supabase", "knowledge");
const MAX_CHUNK_CHARS = 1500;

function parseDoc(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("missing frontmatter");
  const meta = Object.fromEntries(
    match[1]
      .split("\n")
      .map((line) => line.split(/:\s(.*)/))
      .map(([key, value]) => [key.trim(), (value ?? "").trim()]),
  );
  return { title: meta.title, url: meta.url, body: match[2].trim() };
}

/** Greedy paragraph packing up to MAX_CHUNK_CHARS per chunk. */
function chunk(body) {
  const chunks = [];
  let current = "";
  for (const paragraph of body.split(/\n{2,}/)) {
    if (current && (current + paragraph).length > MAX_CHUNK_CHARS) {
      chunks.push(current.trim());
      current = "";
    }
    current += `${paragraph}\n\n`;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function embed(texts) {
  // Voyage's keyless free tier allows 3 requests/minute; wait out 429s.
  for (let attempt = 1; attempt <= 6; attempt++) {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VOYAGE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "voyage-3.5",
        input: texts,
        input_type: "document",
      }),
    });
    if (response.status === 429) {
      console.log("  · límite de Voyage, esperando 25 s…");
      await new Promise((resolve) => setTimeout(resolve, 25_000));
      continue;
    }
    if (!response.ok) {
      throw new Error(`Voyage ${response.status}: ${await response.text()}`);
    }
    const { data } = await response.json();
    return data.map((item) => item.embedding);
  }
  throw new Error("Voyage sigue limitando después de 6 intentos");
}

for (const file of readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"))) {
  const { title, url, body } = parseDoc(
    readFileSync(join(KNOWLEDGE_DIR, file), "utf8"),
  );
  const chunks = chunk(body);
  const embeddings = await embed(chunks);

  const { error: deleteError } = await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("source_title", title);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("knowledge_chunks").insert(
    chunks.map((content, index) => ({
      source_title: title,
      source_url: url,
      content,
      embedding: embeddings[index],
    })),
  );
  if (insertError) throw insertError;

  console.log(`${file}: ${chunks.length} chunk(s) ✓`);
}
console.log("Ingesta completa 🌿");
