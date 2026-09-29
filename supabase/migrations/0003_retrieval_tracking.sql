-- ===========================================================================
-- Mindrop — 0003: retrieval instrumentation columns + batched log function
--
-- Diagnostic (not user-facing): track, per entry, whether it was ever
-- surfaced again by a retrieval query, so we can answer "what % of
-- idea/reading entries ever get pulled back vs. expense entries" from
-- real usage data.
--
-- Columns:
--   entries.retrieval_count   integer NOT NULL DEFAULT 0
--   entries.last_retrieved_at timestamptz NULL
--
-- Write path (lib/ai/hybrid-search.ts → lib/ai/retrieval.ts):
--   after the final merged + ranked result set is produced, a single
--   batched UPDATE (WHERE id = ANY(p_entry_ids)) bumps retrieval_count
--   and stamps last_retrieved_at. Fired non-blocking so search latency
--   doesn't regress; failures are logged, never thrown.
--
-- Idempotent: safe to re-run in the SQL editor.
-- ===========================================================================

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS retrieval_count integer NOT NULL DEFAULT 0;

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS last_retrieved_at timestamptz NULL;

-- Single batched increment used by instrumentation. One call per retrieval
-- answer — never one query per entry.
CREATE OR REPLACE FUNCTION log_entry_retrievals(
  p_entry_ids uuid[],
  p_user_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  UPDATE entries
  SET
    retrieval_count = retrieval_count + 1,
    last_retrieved_at = now()
  WHERE id = ANY(p_entry_ids)
    AND user_id = p_user_id;
$$;

-- RPC must be callable from the authenticated web client.
GRANT EXECUTE ON FUNCTION log_entry_retrievals(uuid[], uuid)
  TO authenticated, service_role;
