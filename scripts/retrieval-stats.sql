-- ===========================================================================
-- Mindrop — retrieval resurfacing report (one-off, internal, no UI)
--
-- Answers: "what % of idea/reading entries ever get pulled back vs. what %
-- of expense entries get aggregated into a digest query" from real usage.
--
-- Run in the Supabase SQL editor. Scoped to entries created in the last
-- :days days (default 30) — very recent entries haven't had a chance to be
-- retrieved yet and would skew "never resurfaced" artificially high.
--
-- Per-category output:
--   total entries | never resurfaced (retrieval_count = 0) |
--   % never resurfaced | avg retrieval_count among retrieved (>= 1)
-- ===========================================================================

-- Per-user (RLS applies when run as an authenticated user):
SELECT
  COALESCE(c.name, 'uncategorized') AS category,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE e.retrieval_count = 0) AS never_retrieved,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE e.retrieval_count = 0) / NULLIF(COUNT(*), 0),
    1
  ) AS pct_never_retrieved,
  ROUND(
    AVG(e.retrieval_count) FILTER (WHERE e.retrieval_count > 0),
    2
  ) AS avg_retrievals_when_retrieved
FROM entries e
LEFT JOIN categories c ON c.id = e.category_id
WHERE e.created_at >= now() - interval '30 days'
GROUP BY COALESCE(c.name, 'uncategorized')
ORDER BY total DESC;

-- Acceptance check (replace the UUID): after logging a mix of expense and
-- idea/reading entries and running a few retrieval queries, confirm the
-- surfaced entries — and only those — were bumped:
-- SELECT id, summary, retrieval_count, last_retrieved_at
-- FROM entries
-- WHERE user_id = 'YOUR_USER_ID'
-- ORDER BY last_retrieved_at DESC NULLS LAST
-- LIMIT 20;
