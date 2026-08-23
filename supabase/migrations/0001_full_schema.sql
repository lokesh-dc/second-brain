-- ===========================================================================
-- Mindrop — consolidated Supabase schema for the Next.js rebuild
--
-- Includes everything from the original RN app's supabase_schema.sql +
-- supabase_functions.sql, plus the pieces that were MISSING from the repo
-- (found during migration exploration):
--   * entries.tags and entries.embedding_doc columns (used by code, absent from SQL)
--   * digests table (used by lib/ai/digest.ts)
--   * match_documents_filtered RPC (used by lib/ai/hybrid-search.ts)
--
-- Run this in the SQL editor of your Supabase project.
-- If migrating the existing database, only run sections marked [NEW].
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  icon text,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  raw_text text not null,
  category_id uuid references categories(id),
  summary text,
  amount numeric,
  currency text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  embedding vector(3072),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- [NEW] used by classifier + backfill but missing from original schema file
  tags text[],
  embedding_doc text
);

create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  type text, -- check constraint dropped by original migration 007; dynamic types allowed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, name, type)
);

create table if not exists entry_entities (
  entry_id uuid references entries(id) on delete cascade not null,
  entity_id uuid references entities(id) on delete cascade not null,
  primary key (entry_id, entity_id)
);

create table if not exists user_profiles (
  id uuid primary key references auth.users not null,
  full_name text,
  setup_complete boolean default false,
  default_categories text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- [NEW] digests table — read/written by useDigest / lib/ai/digest.ts
-- but never included in the original repo's migrations.
create table if not exists digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  period text not null check (period in ('today', 'week', 'month')),
  generated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  narrative text not null default '',
  raw_data jsonb not null default '{}'::jsonb,
  unique(user_id, period)
);

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

alter table categories enable row level security;
drop policy if exists "Users can only access their own categories" on categories;
create policy "Users can only access their own categories" on categories
  for all using (auth.uid() = user_id);

alter table entries enable row level security;
drop policy if exists "Users can only access their own entries" on entries;
create policy "Users can only access their own entries" on entries
  for all using (auth.uid() = user_id);

alter table entities enable row level security;
drop policy if exists "Users can only access their own entities" on entities;
create policy "Users can only access their own entities" on entities
  for all using (auth.uid() = user_id);

alter table entry_entities enable row level security;
drop policy if exists "Users can only access their own entry_entities" on entry_entities;
create policy "Users can only access their own entry_entities" on entry_entities
  for all using (
    exists (
      select 1 from entries
      where entries.id = entry_entities.entry_id
      and entries.user_id = auth.uid()
    )
  );

alter table user_profiles enable row level security;
drop policy if exists "Users can only access their own profile" on user_profiles;
create policy "Users can only access their own profile" on user_profiles
  for all using (auth.uid() = id);

alter table digests enable row level security;
drop policy if exists "Users can only access their own digests" on digests;
create policy "Users can only access their own digests" on digests
  for all using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- New-user trigger
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------------------------------------------------------------------
-- Vector search functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(3072), -- Aligned with gemini-embedding-2
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE(
  id uuid,
  raw_text text,
  category text,
  summary text,
  amount numeric,
  currency text,
  entry_timestamp timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.id,
    e.raw_text,
    c.name as category,
    e.summary,
    e.amount,
    e.currency,
    e.timestamp as entry_timestamp,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM entries e
  LEFT JOIN categories c ON e.category_id = c.id
  WHERE e.user_id = p_user_id
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- [NEW] filtered variant used by hybridSearch (was referenced by the RN app's
-- lib/hybridSearch.ts but never defined anywhere in the repo).
CREATE OR REPLACE FUNCTION match_documents_filtered(
  query_embedding vector(3072),
  match_threshold float,
  match_count int,
  p_user_id uuid,
  p_category text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_entity_name text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  raw_text text,
  category text,
  summary text,
  amount numeric,
  currency text,
  entry_timestamp timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.id,
    e.raw_text,
    c.name as category,
    e.summary,
    e.amount,
    e.currency,
    e.timestamp as entry_timestamp,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM entries e
  LEFT JOIN categories c ON e.category_id = c.id
  WHERE e.user_id = p_user_id
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
    AND (p_category IS NULL OR c.name ILIKE '%' || p_category || '%')
    AND (p_from IS NULL OR e.timestamp >= p_from)
    AND (p_to   IS NULL OR e.timestamp <= p_to)
    AND (
      p_entity_name IS NULL OR EXISTS (
        SELECT 1
        FROM entry_entities ee
        JOIN entities en ON en.id = ee.entity_id
        WHERE ee.entry_id = e.id
          AND en.name ILIKE '%' || p_entity_name || '%'
      )
    )
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ---------------------------------------------------------------------------
-- Optional: IVFFlat index for faster similarity search at scale.
-- Requires data to exist before creation. Uncomment when needed:
--
-- create index on entries using ivfflat (embedding vector_cosine_ops) with (lists = 100);
-- ---------------------------------------------------------------------------
