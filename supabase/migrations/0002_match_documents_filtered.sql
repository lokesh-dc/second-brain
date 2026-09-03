-- ===========================================================================
-- Mindrop — 0002: match_documents_filtered RPC
--
-- Called from lib/ai/hybrid-search.ts as:
--   sb.rpc("match_documents_filtered", {
--     query_embedding, match_threshold, match_count, p_user_id,
--     p_category?, p_from?, p_to?, p_entity_name?
--   })
--
-- Return shape mirrors lib/types Entry (types/index.ts):
-- flat columns + category_id/category_name + an aggregated `entities` jsonb
-- array ([{id, name, type}]) so the TypeScript side can reconstruct
-- Entry.category and Entry.entities. Kept in sync with the copy embedded in
-- 0001_full_schema.sql.
--
-- SECURITY INVOKER (default): RLS applies — callers only ever see their own
-- rows. search_path pinned per Supabase convention (<=> lives in extensions).
--
-- Idempotent: safe to re-run in the SQL editor.
-- ===========================================================================

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
  user_id uuid,
  raw_text text,
  category_id uuid,
  category_name text,
  category_user_id uuid,
  category_icon text,
  category_is_default boolean,
  summary text,
  amount numeric,
  currency text,
  "timestamp" timestamptz,
  tags text[],
  embedding_doc text,
  entities jsonb,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    e.id,
    e.user_id,
    e.raw_text,
    e.category_id,
    c.name AS category_name,
    c.user_id AS category_user_id,
    c.icon AS category_icon,
    c.is_default AS category_is_default,
    e.summary,
    e.amount,
    e.currency,
    e."timestamp",
    e.tags,
    e.embedding_doc,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', en.id,
          'user_id', en.user_id,
          'name', en.name,
          'type', en.type
        )
      )
      FROM entry_entities ee
      JOIN entities en ON en.id = ee.entity_id
      WHERE ee.entry_id = e.id
    ), '[]'::jsonb) AS entities,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM entries e
  LEFT JOIN categories c ON c.id = e.category_id
  WHERE e.user_id = p_user_id
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
    AND (p_category IS NULL OR c.name ILIKE '%' || p_category || '%')
    AND (p_from IS NULL OR e."timestamp" >= p_from)
    AND (p_to   IS NULL OR e."timestamp" <= p_to)
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
