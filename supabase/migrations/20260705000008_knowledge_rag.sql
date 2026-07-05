-- Phase 14: RAG knowledge base — pgvector + Voyage AI embeddings.
-- Run AFTER 20260704000007.

create extension if not exists vector;

-- Curated wellness knowledge, chunked and embedded offline by
-- scripts/ingest-knowledge.mjs (voyage-3.5, 1024 dimensions).
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_title text not null,
  source_url text not null,
  content text not null,
  embedding vector(1024) not null,
  created_at timestamptz not null default now()
);

alter table public.knowledge_chunks enable row level security;

-- Read-only for signed-in users; writes happen only through the ingestion
-- script with the service role key (which bypasses RLS).
create policy "Authenticated users can read knowledge"
  on public.knowledge_chunks for select
  to authenticated
  using (true);

-- Cosine-similarity top-k used by the coach Edge Function.
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1024),
  match_count int default 4
)
returns table (
  content text,
  source_title text,
  source_url text,
  similarity float
)
language sql
stable
as $$
  select
    kc.content,
    kc.source_title,
    kc.source_url,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;
