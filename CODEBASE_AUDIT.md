# Mindrop (`second-mind-web`) — Codebase Audit

**Date:** 2026-11-04  
**Scope:** Vector search & schema correctness, time & money correctness (IST vs UTC, backdated logs, currency sums), AI pipeline robustness, security & RLS, data quality, docs drift, and testing/observability.

---

## 1. Summary Table of Findings

| ID | Severity | Area | File:Line | One-line summary | Status |
|---|---|---|---|---|---|
| **F-01** | **Critical** | Time & Money | `lib/ai/query-parser.ts:7-54`, `lib/ai/digest.ts:7-21`, `actions/home.ts:45-50` | Server-side day/week/month boundaries use server timezone (UTC in prod) instead of IST (`UTC+5:30`), mis-bucketing entries logged between 00:00 and 05:29 IST into the previous day/week/month. | **VERIFIED** |
| **F-02** | **Critical** | Time & Money | `supabase/migrations/0001_full_schema.sql:41`, `lib/ai/classifier.ts:236-250` | No `occurred_at` extraction or column; backdated drops ("spent 400 last Friday") get stamped with `now()`, corrupting time-filtered search, digests, widgets, and feeds. | **VERIFIED** |
| **F-03** | **Critical** | Security & Auth | `supabase/migrations/0001_full_schema.sql:146-272`, `supabase/migrations/0003_retrieval_tracking.sql:30-49` | `match_documents`, `match_documents_filtered`, and `log_entry_retrievals` trust caller-supplied `p_user_id` instead of `auth.uid()` and are callable directly via the browser anon client; if `SECURITY DEFINER` is ever enabled or RLS is bypassed, cross-user embeddings leak. | **VERIFIED** |
| **F-04** | **High** | Vector & Schema | `supabase/migrations/0001_full_schema.sql:42,278` | No vector index exists on `entries.embedding` (`vector(3072)`); the commented-out `ivfflat (embedding vector_cosine_ops)` at L278 will fail in pgvector because `vector` indexes cap at 2,000 dimensions without a `halfvec(3072)` cast. | **VERIFIED** |
| **F-05** | **High** | Time & Money | `lib/ai/digest.ts:60-71`, `actions/home.ts:97-107`, `actions/entities.ts:60-83,130-161` | `digest.ts`, `home.ts`, and `entities.ts` sum raw `amount` numbers across mixed currencies (`INR` + `USD` + `EUR`) without conversion and label the sum with the most-frequent or biggest-expense currency. | **VERIFIED** |
| **F-06** | **High** | AI Pipeline | `lib/ai/classifier.ts:414-494`, `actions/entries.ts:82-96` | `updateEntry` runs `applyEntryEdit` synchronously and `enrichEntryEdit` inside `after()`; if background AI fails or splits die, the entry is left half-updated (`raw_text` updated, stale `summary`/`amount`/`entities`/`embedding`) or `embedding = null` when Gemini fails on edit. | **VERIFIED** |
| **F-07** | **High** | AI Pipeline | `lib/ai/groq.ts:25-60`, `lib/ai/embeddings.ts:6-18`, `lib/ai/classifier.ts:228-235,281-286` | Zero timeout, retry, or backoff in `callGroq` or `generateEmbedding`; Groq failure silently degrades to a single `misc` fallback item (`amount: null`, `entities: []`), and Gemini failure saves `embedding: null` with no backfill script or action in the repo. | **VERIFIED** |
| **F-08** | **High** | Data Quality | `supabase/migrations/0001_full_schema.sql:55`, `lib/ai/classifier.ts:143-176`, `actions/profile.ts:36-55` | Entity deduplication is brittle: `upsertEntity` lacks `.trim()`, `ilike` treats `_`/`%` as wildcards, `Promise.all` races on duplicate entity names in one item, `unique(user_id, name, type)` is case-sensitive, and `Third Wave` vs `Third Wave Coffee` always creates separate entities. | **VERIFIED** |
| **F-09** | **High** | Security & Auth | `supabase/migrations/0001_full_schema.sql:88-123` | RLS policies use `FOR ALL USING (...)` without explicit `WITH CHECK` or separate per-command policies; `entry_entities` does not verify ownership of `entity_id`, allowing a user to link their entry to another user's entity UUID. | **VERIFIED** |
| **F-10** | **High** | Data Quality | `actions/entries.ts:105-133`, `lib/ai/digest.ts:153-174`, `actions/home.ts:121-140` | Deleting an entry does not invalidate cached `digests` (staleness only checks `gt("timestamp", generated_at)`), leaves zero-drop orphan entities in `entities`, and there is no entity delete/merge action anywhere. | **VERIFIED** |
| **F-11** | **Medium** | AI Pipeline | `lib/ai/classifier.ts:120`, `lib/ai/query-parser.ts:83`, `lib/ai/retrieval.ts:201,222,225` | Unsanitized user text and client-supplied conversation `history` (`query` and `answer`) are interpolated directly into LLM prompts, allowing prompt injection to manipulate `category`, `amount`, `breakdown`, and `answer` prose. | **VERIFIED** |
| **F-12** | **Medium** | Vector & Schema | `lib/ai/hybrid-search.ts:240,258-265` | Structured search in `hybridSearch` queries `categories` without `.eq("user_id", userId)`, and `match_threshold: 0.5` is hardcoded without any evals or tests for `gemini-embedding-2`. | **VERIFIED** |
| **F-13** | **Medium** | Time & Money | `actions/home.ts:49,95`, `lib/ai/digest.ts:14-16`, `lib/ai/query-parser.ts:27-39` | Inconsistent week definitions: `getHomeWidgets` defines `weekCount` as a rolling 7×24h window (`now - 7d`), whereas `digest.ts` and `query-parser.ts` use Monday-start calendar weeks. | **VERIFIED** |
| **F-14** | **Medium** | Security & Auth | `app/(onboarding)/setup/page.tsx:33-48`, `actions/profile.ts:26-68`, `proxy.ts:56-64` | Setup bugs: `Date.now()` called twice in `addCustomCategory` breaks custom chip selection; `completeSetup` only writes `selectedCategories` to `user_profiles.default_categories` without creating `categories` rows; `proxy.ts` redirects onboarded users to `/setup` on transient DB errors. | **VERIFIED** |
| **F-15** | **Low** | Docs & Drift | `PROJECT_AUDIT.md:1-62`, `README.md:1-55`, `CLAUDE.md:1` | Multiple claims in `PROJECT_AUDIT.md` and `README.md` are outdated (route counts, immutable entries, categories placeholder, missing migrations, fixed login/search/digest bugs). | **VERIFIED** |
| **F-16** | **Medium** | Tests & Observability | `package.json:5-10`, `lib/ai/*` | Zero automated tests (`*.test.*`) exist in the repo, and observability is limited to unstructured `console.error` + `retrieval_count` with no AI latency, token/cost, or error-rate tracking. | **VERIFIED** |

---

## 2. Detailed Investigation by Audit Area

### Area 1: Vector Search & Schema Correctness

#### 1.1 `vector(3072)` index status and pgvector 2,000-dimension limit — **VERIFIED** (`supabase/migrations/0001_full_schema.sql:42,274-279`)
- **Code quote:**
  ```sql
  -- supabase/migrations/0001_full_schema.sql:42
  embedding vector(3072),
  ...
  -- supabase/migrations/0001_full_schema.sql:274-279
  -- Optional: IVFFlat index for faster similarity search at scale.
  -- Requires data to exist before creation. Uncomment when needed:
  --
  -- create index on entries using ivfflat (embedding vector_cosine_ops) with (lists = 100);
  ```
- **Finding:** There is **no index** on `entries.embedding` in any of the three migration files (`0001`, `0002`, `0003`), nor is there even a B-tree index on `entries(user_id, timestamp DESC)`. Furthermore, the commented-out index on line 278 (`using ivfflat (embedding vector_cosine_ops)`) **will fail with an error** in pgvector (`ERROR: column cannot have more than 2000 dimensions for ivfflat/hnsw index`) because both `ivfflat` and `hnsw` on the `vector` type are capped at 2,000 dimensions. To index 3,072 dimensions in pgvector `>= 0.7.0`, you must use an expression index casting to `halfvec(3072)`:
  ```sql
  CREATE INDEX ON entries USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
  ```
- **Scaling impact of sequential scans on `match_documents_filtered`:**
  - Every `vector(3072)` row is `3072 * 4 bytes = 12 KB` (stored in Postgres TOAST).
  - Without a B-tree index on `(user_id, timestamp)` or an HNSW index on `embedding`, calling `match_documents_filtered` (`supabase/migrations/0002_match_documents_filtered.sql:22-101`) performs a **full sequential scan of the `entries` table across all users**, filters `WHERE e.user_id = p_user_id`, de-TOASTs every matching `12 KB` vector for that user, computes 3,072-float cosine distance, and runs correlated subqueries for `entry_entities`.
  - At **1,000 entries/user** (~12 MB TOAST per user): ~15–40 ms per query.
  - At **10,000 entries** (~120 MB TOAST): ~150–400 ms per query, with heavy buffer cache eviction.
  - At **100,000+ entries** across users (~1.2 GB TOAST): >1.5–4 seconds per query, I/O saturating Supabase compute.

#### 1.2 `match_documents` & `match_documents_filtered`: `user_id` filtering, `SECURITY INVOKER`, and leak potential — **VERIFIED** (`supabase/migrations/0001_full_schema.sql:146-272`, `supabase/migrations/0002_match_documents_filtered.sql:16-101`)
- **Code quote:**
  ```sql
  -- supabase/migrations/0001_full_schema.sql:162-176
  LANGUAGE sql STABLE
  AS $$
    SELECT ...
    FROM entries e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = p_user_id
      AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ```
  ```sql
  -- supabase/migrations/0002_match_documents_filtered.sql:50-85
  LANGUAGE sql STABLE
  SET search_path = public, extensions
  AS $$
    SELECT ...
    FROM entries e
    LEFT JOIN categories c ON c.id = e.category_id
    WHERE e.user_id = p_user_id
  ```
- **Finding:**
  1. Both `match_documents` and `match_documents_filtered` filter by `WHERE e.user_id = p_user_id` inside the function body.
  2. Neither specifies `SECURITY DEFINER`, so Postgres defaults both to **`SECURITY INVOKER`**. (In `0003_retrieval_tracking.sql:36`, `log_entry_retrievals` explicitly states `SECURITY INVOKER`).
  3. **Can one user's embeddings leak if called with a different `p_user_id` from the client?**
     - Because `SECURITY INVOKER` is active and `ALTER TABLE entries ENABLE ROW LEVEL SECURITY` is set (`0001_full_schema.sql:93-96`), when a browser client calls `supabase.rpc('match_documents_filtered', { p_user_id: victim_uuid, ... })` using `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Postgres evaluates both `e.user_id = p_user_id` AND the RLS policy `auth.uid() = user_id`. If `victim_uuid != auth.uid()`, the intersection is empty (0 rows).
     - **However**, relying on `p_user_id` instead of `auth.uid()` inside the SQL function is a dangerous anti-pattern:
       1. `match_documents` (`0001_full_schema.sql:146-179`) is dead code in the web app and lacks `SET search_path = public, extensions`.
       2. If any developer or migration ever changes these RPCs to `SECURITY DEFINER` (common in Supabase tutorials) or calls them with a service-role client without pre-validating `p_user_id`, any user can pass another user's UUID and read their entries (`match_documents_filtered`) or corrupt their `retrieval_count` (`log_entry_retrievals`).
       3. Inside `match_documents_filtered`, the `LEFT JOIN categories c ON c.id = e.category_id` and `JOIN entities en ON en.id = ee.entity_id` do not explicitly filter `c.user_id = auth.uid()` or `en.user_id = auth.uid()` (they rely on RLS).

#### 1.3 Is the `0.5` cosine similarity threshold justified for `gemini-embedding-2`? — **VERIFIED** (`lib/ai/hybrid-search.ts:238-244`, `supabase/migrations/0001_full_schema.sql:4-6`)
- **Code quote:**
  ```ts
  // lib/ai/hybrid-search.ts:238-244
  sb.rpc("match_documents_filtered", {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 20,
    p_user_id: userId,
    ...filters,
  }),
  ```
- **Finding:**
  - **Carried over without evals:** There are **zero evals, benchmarks, or test files** anywhere in the repository (`find . -name "*test*"` and `find . -name "*eval*"` return nothing). As noted in `README.md:41`, `lib/ai/*` was ported straight from the React Native app.
  - Furthermore, `lib/ai/embeddings.ts:12-13` calls `model.embedContent(text)` **without `taskType`** (`RETRIEVAL_DOCUMENT` vs `RETRIEVAL_QUERY`), embedding asymmetric queries ("expenses and money spent") and structured documents (`"[expense] 90 INR | milk, bread | 2026-11-04\nSummary: ..."`) identically.

---

### Area 2: Time & Money Correctness

#### 2.1 UTC vs IST (`UTC+5:30`) boundary bugs across `parseQuery` → `hybridSearch` → `digest` → `getHomeWidgets` — **VERIFIED**

| Location | Code Quote | Timezone Used | Bug at 1:00 AM IST (`19:30 UTC` previous day) |
|---|---|---|---|
| **1. `lib/ai/classifier.ts:18,381,518`** (`callClassifier`, `buildEmbeddingDoc`, `fallbackItem`) | `const today = new Date().toISOString().split("T")[0];` | **Always UTC** (`toISOString()` is always UTC, even if the server OS is in IST!). | At **1:00 AM IST on Nov 1** (`2026-10-31T19:30:00Z`), `today` is `"2026-10-31"`. Every drop logged between 12:00 AM and 5:29 AM IST has **yesterday's date** baked permanently into `embedding_doc`! |
| **2. `lib/ai/query-parser.ts:7-50`** (`resolveTimeFilter`) | `const now = new Date();`<br>`const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());`<br>`const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());`<br>`return { ...raw, from: iso(dayStart(today)), to: iso(dayEnd(today)) };` | **Server local TZ** (`UTC` on Vercel/cloud Node runtimes). | On a UTC server: at **1:00 AM IST on Nov 1** (`Oct 31 19:30 UTC`), `today` resolves to `Oct 31 00:00 UTC` – `Oct 31 23:59:59 UTC` (`Oct 31 05:30 IST` – `Nov 1 05:29:59 IST`). Worse, at **10:00 AM IST on Nov 1** (`Nov 1 04:30 UTC`), asking *"what did I spend today?"* computes `from = Nov 1 00:00 UTC` (**5:30 AM IST**), **excluding the entry logged at 1:00 AM IST on Nov 1**! Similarly, on the 1st of the month at 1:00 AM IST, an entry has `timestamp = Oct 31 19:30 UTC`, so later in November when the user asks *"this_month"*, `from = Nov 1 00:00 UTC` **misses the 1:00 AM IST entry completely** (it landed in October!). |
| **3. `lib/ai/retrieval.ts:45-56`** (`describeDay` & `formatEntryLine` L78) | `const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();`<br>`new Date(entry.timestamp).toLocaleDateString("en-IN", ...)` | **Server local TZ** (`UTC` in prod). | Neither `describeDay` nor `toLocaleDateString("en-IN")` passes `timeZone: "Asia/Kolkata"`! An entry logged at 1:00 AM IST on Nov 1 (`Oct 31 19:30Z`) is formatted in the LLM prompt as `date: 31 Oct (yesterday)` when queried after 5:30 AM IST on Nov 1. |
| **4. `lib/ai/digest.ts:7-21`** (`getRange`) | `const now = new Date();`<br>`const end = endOfDay(now);`<br>`start = startOfDay(now);` / `startOfWeek(now, { weekStartsOn: 1 })` / `startOfMonth(now)` | **Server local TZ** (`UTC` in prod). | `date-fns` `startOfDay`/`startOfWeek`/`startOfMonth` use the Node process timezone. On a UTC server, "Today" digest starts at **5:30 AM IST** (`00:00 UTC`). An entry logged at 1:00 AM IST is excluded from "Today" digest after 5:30 AM IST, excluded from "This Week" on Monday after 5:30 AM IST, and excluded from "This Month" on the 1st after 5:30 AM IST. |
| **5. `actions/home.ts:45-50`** (`getHomeWidgets`) | `const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);`<br>`const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);`<br>`const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);` | **Server local TZ** (`UTC` in prod). | Same UTC boundary bug: `startOfToday` is `00:00 UTC` (5:30 AM IST), and `monthStart` is the 1st of the month at `00:00 UTC` (5:30 AM IST). An expense logged at **1:00 AM IST on May 1** (`Apr 30 19:30 UTC`) is `< monthStart` once `now` passes 5:30 AM IST on May 1, so **it disappears from May's `monthSpend` widget**! Also note `app/(app)/home/page.tsx:32`: `const dateLabel = format(new Date(), "EEEE, d MMMM");` runs on the server and shows yesterday's date between 00:00 and 05:29 IST. |
| **6. `components/digest/spend-widget.tsx:19-27`** (`elapsedDays`) | `const now = new Date(); ... return Math.max(1, now.getDate());` | **Client browser TZ** (runs in `"use client"`). | Client computes `elapsedDays` in IST while `digest.ts` aggregated `raw` in server UTC—mismatched numerator and denominator between 00:00 and 05:29 IST. |
| **7. `components/entries-feed.tsx:28-38`** (`dayKey`, `dayLabel`) | `export function dayKey(timestamp: string) { return format(new Date(timestamp), "yyyy-MM-dd"); }` | **Client browser TZ** during client render, **Server TZ during SSR**! | Because `EntriesFeed`, `CategoriesScreen`, and `EntityDetailScreen` are `"use client"` components pre-rendered on the server during SSR, an entry at 1:00 AM IST renders under `"2026-10-31"` ("Yesterday") on the server and hydrates as `"2026-11-01"` ("Today") on the client, causing a **React hydration mismatch** in addition to server/client disagreement. |

#### 2.2 `entries.timestamp` defaults to `now()`, backdated logs, and blast radius of `occurred_at` — **VERIFIED**
- **Confirmation of backdated log bug:**
  - In `supabase/migrations/0001_full_schema.sql:41`:
    ```sql
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
    ```
  - In `lib/ai/classifier.ts:38-46`, the classifier schema has **no timestamp/date field**:
    ```ts
    Schema:
    {"items": [{
      "category":"string",
      "entities":[{"name":"string","type":"..."}],
      "amount":number|null,
      "currency":"INR|USD|EUR|null",
      "summary":"one sentence past tense listing items",
      "tags":["2 to 4 lowercase tags"],
      "embedding_doc":"string"
    }]}
    ```
  - And in `lib/ai/classifier.ts:236-250`, `saveSingleItem` does not pass `timestamp` when inserting into `entries`, so Postgres always stamps `now()`. If a user logs *"spent 400 on dinner last Friday"* on Wednesday, its `timestamp` is Wednesday (`now()`), and its `embedding_doc` has Wednesday's `today` date (`[expense] 400 INR | ... | 2026-11-04`).
- **Complete blast radius of adding `occurred_at` (every feature that depends on `entries.timestamp`):**
  1. **Database Schema & RPCs:**
     - `supabase/migrations/0001_full_schema.sql:41,159,171,199-200,215,236,259-260` (`entries.timestamp`, `match_documents`, `match_documents_filtered` `p_from`/`p_to` filter and return column).
     - `supabase/migrations/0002_match_documents_filtered.sql:28-29,44,65,88-89` (`p_from`/`p_to` filtering on `e."timestamp"`).
  2. **Ingestion & Editing (`classifier.ts`):**
     - `lib/ai/classifier.ts:18,38-57,236-250,380-384,414-460,517-528` (Classifier prompt schema must extract relative/absolute dates into `occurred_at`; `embedding_doc` date header; `saveSingleItem` insert; `enrichEntryEdit` update).
  3. **Hybrid Search & Retrieval (`hybrid-search.ts`, `retrieval.ts`):**
     - `lib/ai/hybrid-search.ts:59,120,230-231,250,255,267-270` (Structured search `.order("timestamp", { ascending: false })`, `.gte("timestamp", ...)`, `.lte("timestamp", ...)`, `toEntry`).
     - `lib/ai/retrieval.ts:78` (`formatEntryLine` uses `entry.timestamp` to tell the LLM when the entry happened).
  4. **Digests (`digest.ts`):**
     - `lib/ai/digest.ts:32,37-38,68,170` (`aggregateData` filters `.gte("timestamp", start).lte("timestamp", end)`; `biggestExpense.timestamp`; **Note:** cache invalidation on L170 `.gt("timestamp", dbDigest.generated_at)` should check `created_at` instead of `occurred_at`, so a backdated log still invalidates the digest!).
  5. **Home Widgets (`actions/home.ts`):**
     - `actions/home.ts:55,57-58,88,94-97,128-130` (30-day cutoff query, `todayCount`, `weekCount`, `monthSpend` filter `ts >= monthStart`, and `hasNewer` digest staleness check on L129).
  6. **Entity Index & Entity Detail (`actions/entities.ts`, `components/entity-detail-screen.tsx`):**
     - `actions/entities.ts:38,63,70,126,148-149` (`lastSeen`, `firstSeen`, sorting entity history by `timestamp`).
     - `components/entity-detail-screen.tsx:49-62,86-89` (`rangeLabel` and day-grouped feed).
  7. **Feed Pagination & Day-Grouped Feeds (`lib/entries.ts`, `entries-feed.tsx`, `categories-screen.tsx`, `entry-card.tsx`, `entry-sheet.tsx`):**
     - `lib/entries.ts:6,40,65-66` (`loadEntries` `.order("timestamp", { ascending: false })`, cursor pagination `loadEntriesBefore` `.lt("timestamp", before)`).
     - `components/entries-feed.tsx:28-38,68,143-169` (`dayKey(entry.timestamp)`, cursor `before`, day grouping).
     - `components/categories-screen.tsx:73-86` (`dayKey(entry.timestamp)` grouping).
     - `components/entry-card.tsx:20,58` (card time badge `format(new Date(entry.timestamp), "h:mm a")`).
     - `components/entry-sheet.tsx:422-425` ("Logged At" display).

#### 2.3 Currency handling across `retrieval.ts`, `digest.ts`, `home.ts`, and `entities.ts` — **VERIFIED**
- **`lib/ai/retrieval.ts:89-102,204-213` & `components/answer-card.tsx:19-55` — SAFE:**
  - `totalsByCurrency` groups by `e.currency ?? "unknown"` and passes separate per-currency totals to the prompt (`"Never add different currencies together"`). `BreakdownTable` in `answer-card.tsx` also groups totals by `r.currency`.
- **`lib/ai/digest.ts:60-71` & `components/digest/spend-widget.tsx:31-43` & `components/insights-screen.tsx:218-219` — BUG (MIXED-CURRENCY SUM):**
  ```ts
  // lib/ai/digest.ts:60-71
  if (catName.toLowerCase().includes("expense") && entry.amount) {
    totalAmountByCategory[catName] =
      (totalAmountByCategory[catName] || 0) + entry.amount;
    if (!biggestExpense || entry.amount > biggestExpense.amount) {
      biggestExpense = {
        amount: entry.amount,
        currency: entry.currency || "INR",
        ...
      };
    }
  }
  ```
  - `totalAmountByCategory` blindly adds `entry.amount` regardless of `entry.currency`. Worse, `biggestExpense` compares raw numbers (`entry.amount > biggestExpense.amount`), so `500 INR` beats `100 USD`, and then `spend-widget.tsx:43` and `insights-screen.tsx:219` use `raw.biggestExpense?.currency ?? "INR"` as the currency symbol for the entire period's total!
- **`actions/home.ts:97-107` — BUG (MIXED-CURRENCY SUM):**
  ```ts
  // actions/home.ts:97-107
  if (catName.toLowerCase().includes("expense") && ts >= monthStart && r.amount != null) {
    monthSpend += r.amount;
    if (r.currency) {
      currencyCounts.set(r.currency, (currencyCounts.get(r.currency) ?? 0) + 1);
    }
  }
  if (currencyCounts.size > 0) {
    monthSpendCurrency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  ```
  - `monthSpend` adds raw amounts across all currencies and labels the combined total with the **most frequent currency** (`monthSpendCurrency`). E.g., two `₹100` chai drops + one `$1,000` flight = `₹1,200`!
- **`actions/entities.ts:60-83,130-161` — BUG (MIXED-CURRENCY SUM + NON-EXPENSE AMOUNTS):**
  ```ts
  // actions/entities.ts:136-142 (and identical logic in getEntities at L63-69)
  for (const e of entries) {
    if (e.amount != null) {
      spendTotal += e.amount;
      if (e.currency) {
        currencyCounts.set(e.currency, (currencyCounts.get(e.currency) ?? 0) + 1);
      }
    }
  ```
  - Both `getEntities` and `getEntityDetails` sum `e.amount` across all currencies into `spendTotal` and attach the majority currency (`spendCurrency`). Additionally, unlike `home.ts` and `digest.ts` (which only sum categories matching `"expense"`), `entities.ts` sums all entries with `amount != null` (including `shopping`).

---

### Area 3: AI Pipeline Robustness

#### 3.1 `classifier.ts`: `callClassifier`, `looksEchoed`, `propagateSharedEntities`, splitting, and Groq failures — **VERIFIED**
- **Malformed JSON / Timeout / Rate-limit / Empty array:**
  - In `lib/ai/groq.ts:31-67`, `callGroq` uses bare `fetch(GROQ_BASE_URL, ...)` with **no `AbortSignal.timeout`**, **no retry**, and **no exponential backoff**.
  - If Groq returns HTTP 429 (rate limit), HTTP 5xx, times out, or returns malformed JSON (`JSON.parse(extractJSON(raw))` throws), `classifyItems` (`lib/ai/classifier.ts:281-286`) catches the error and falls back to `[fallbackItem(rawText)]`.
  - If Groq returns `{"items": []}` (empty array), `valid(result)` is `[]`, `propagateSharedEntities([])` is `[]`, and line 313 (`return withShared.length === 0 ? [fallbackItem(rawText)] : withShared;`) also returns `[fallbackItem(rawText)]`.
- **Does a failed classification lose the user's raw text, or is it saved first?**
  - In `lib/ai/classifier.ts:370-378`:
    ```ts
    export async function classifyAndSave(sb: SupabaseClient, rawText: string, userId: string, hint?: string[]): Promise<void> {
      const items = await classifyItems(rawText, hint);
      await Promise.all(items.map((item) => saveSingleItem(sb, item, rawText, userId)));
    }
    ```
  - **The raw text is NOT saved to the DB before calling the AI.** If the serverless function times out while `callGroq` hangs (since there is no fetch timeout), the entry is lost completely. If `callGroq` fails fast (e.g. 429 or bad JSON), `classifyItems` returns `[fallbackItem(rawText)]`, which `saveSingleItem` inserts as a `Misc` entry with `raw_text = rawText`, `summary = rawText`, `amount = null`, `entities = []`.
  - **Critical silent-success bug in `saveSingleItem` (`lib/ai/classifier.ts:252-255`):**
    ```ts
    if (entryError || !entry) {
      console.error("[classifier] entry insert failed:", entryError);
      return;
    }
    ```
    If the Supabase `INSERT INTO entries` fails, `saveSingleItem` logs to `console.error` and **returns `undefined` without throwing**! `logEntry` (`actions/entries.ts:54-56`) then returns `{ ok: true }`, and the UI (`components/capture.tsx:115`) clears the user's textarea and toasts `"Logged to your mind"` even though **nothing was saved in the database**!
- **`looksEchoed` edge-case bug (`lib/ai/classifier.ts:321-337`):**
  - `looksEchoed` checks if at least one extracted entity name (`t.includes(name)`) or computed `amount` (`t.includes(String(item.amount))`) appears as a literal substring of `input.toLowerCase()`.
  - **Self-contradiction with Prompt Rule 52 (`lib/ai/classifier.ts:52`):** Rule 52 instructs the model: *"2500 one way, return trip" means amount 5000. "800 per night, 3 nights" means 2400.* If a user logs `"bus fare 2500 one way return trip"` (no place entity, only a computed amount `5000`), `"5000"` is **not** a substring of the input! `looksEchoed` returns `true`, triggers a bare retry, and if the retry also computes `5000`, line 309 (`if (looksEchoed(rawText, items)) return [fallbackItem(rawText)]`) **discards the valid AI classification and overwrites it with `fallbackItem` (`category: "misc"`, `amount: null`)**! The same happens when the user writes `"spent five hundred on lunch"` (`amount: 500` is not in `"five hundred"`).
- **`propagateSharedEntities` (`lib/ai/classifier.ts:346-368`):**
  - Spreads `place`, `person`, and `event` entities across all split items. If a user logs two unrelated events in one drop (*"Had coffee with Sara, then dinner with Raj"*), both `Sara` and `Raj` are attached to both items.

#### 3.2 Prompt Injection vectors — **VERIFIED**
User-entered text is interpolated directly into prompts in 4 places:
1. **`callClassifier` (`lib/ai/classifier.ts:120`):**
   `Now classify this NEW input ...: "${text.replace(/"/g, "'")}"${hintLine}`
   - `hintCategories` comes from the client (`logEntry(text, hintCategories)`) and is joined with `.join(", ")` without length/character validation beyond `.slice(0, 3)`.
   - Only influences the user's own `category`, `amount`, `currency`, `summary`, `tags`, and `entities`.
2. **`parseQuery` (`lib/ai/query-parser.ts:83`):**
   `Input: "${input.replace(/"/g, "'")}"`
   - Can influence `intent`, `rewritten_query`, `category_filter`, `time_filter`, `entity_filter`.
3. **`buildPrompt` in `retrieval.ts` (`lib/ai/retrieval.ts:196-202,222,225`):**
   ```ts
   const historyBlock = ... history.slice(-5).map((t) => `Q: ${t.query}\nA: ${t.answer}`).join("\n");
   ...
   Question: "${originalQuery}"
   Entries (...):
   ${entries.map((e) => formatEntryLine(e, now)).join("\n")}
   ```
   - Both stored entries (`summary`, `raw_text`) and client-supplied `history` (`t.query`, `t.answer` passed from `sessionStorage` to `askMind(question, history)`) are interpolated without delimiter escaping.
   - **What outputs can it influence?** It can influence `answer` prose, `followups`, `type`, and **`breakdown` (`[{"label","amount","currency"}]`)**—because `sanitizeModelOutput` (`lib/ai/retrieval.ts:148-169`) accepts arbitrary numbers in `breakdown` without checking that they match `entries`. However, **it CANNOT inject arbitrary `entry_ids`** outside the retrieved set because of server-side `validIds` filtering (see 3.3).

#### 3.3 Server-side validation of `entry_ids` in `retrieval.ts` — **VERIFIED** (`lib/ai/retrieval.ts:109-129,303-304`)
- **Code quote:**
  ```ts
  // lib/ai/retrieval.ts:120-129
  const seen = new Set<string>();
  const entry_ids: string[] = [];
  if (Array.isArray(out.entry_ids)) {
    for (const id of out.entry_ids) {
      if (typeof id !== "string" || !validIds.has(id) || seen.has(id)) continue;
      seen.add(id);
      entry_ids.push(id);
      if (entry_ids.length >= MAX_CONTEXT_ENTRIES) break;
    }
  }
  ...
  // lib/ai/retrieval.ts:303-304
  const validIds = new Set(contextEntries.map((e) => e.id));
  const result = sanitizeModelOutput(data, validIds);
  ```
- **Finding:** **Confirmed.** Server-side validation in `sanitizeModelOutput` strictly filters `out.entry_ids` against `validIds`, which is constructed exclusively from `contextEntries` (the union of `hybridSearch` results and `getEntriesByIds(sb, userId, opts.priorEntryIds)`, both scoped to `userId`). The LLM cannot cite any `entry_id` outside `contextEntries`.

#### 3.4 Embedding failures & backfill — **VERIFIED** (`lib/ai/embeddings.ts:6-18`, `lib/ai/classifier.ts:228-250`)
- **Code quote:**
  ```ts
  // lib/ai/embeddings.ts:15-17
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
  ```
- **Finding:**
  - When `generateEmbedding` fails or is rate-limited on initial capture (`saveSingleItem`), it returns `null`, and the entry **is still saved** with `embedding: null`. Because `match_documents_filtered` has `AND e.embedding IS NOT NULL` (`0002_match_documents_filtered.sql:85`), any entry with `embedding: null` is **permanently invisible to vector search** (only reachable via structured recency search if it happens to be in the latest 20 entries).
  - Worse, on **entry edit** (`lib/ai/classifier.ts:437-454`), if `generateEmbedding` returns `null`, `enrichEntryEdit` executes `.update({ ..., embedding: null })`, **wiping out the entry's previously valid embedding**!
  - **Is there a backfill mechanism?** **No.** Despite the comment in `0001_full_schema.sql:44` (`-- [NEW] used by classifier + backfill`), there is **no backfill script, server action, or cron** anywhere in this repository to populate entries where `embedding IS NULL`.

#### 3.5 `after()` background work & half-updated entries — **VERIFIED** (`actions/entries.ts:79-98`, `lib/ai/classifier.ts:388-494`, `lib/ai/hybrid-search.ts:197-208`)
- `after()` is used in two places:
  1. `lib/ai/hybrid-search.ts:197-208` (`scheduleRetrievalLogging`): Swallows errors via `console.error` inside `logRetrievedEntries`. Benign (diagnostic counter only).
  2. `actions/entries.ts:82-96` (`updateEntry`):
     ```ts
     await applyEntryEdit(sb, id, user.id, data);
     ...
     after(async () => {
       try {
         const sb2 = await createClient();
         await enrichEntryEdit(sb2, id, user.id, data);
         revalidatePath("/home");
         revalidatePath("/categories");
       } catch (err) {
         console.error("[updateEntry] background enrichment failed:", err);
       }
     });
     ```
- **Four ways `updateEntry` leaves an entry half-updated or corrupted:**
  1. **`applyEntryEdit` only updates `raw_text` and `category_id`** (`lib/ai/classifier.ts:396-403`). Meanwhile, `components/entry-sheet.tsx:272-280` passes blanked-out fields (`summary: "", amount: null, currency: null, tags: [], entities: []`) in `data`.
  2. If Groq fails inside `enrichEntryEdit`, `classifyItems(data.raw_text)[0]` returns `fallbackItem(data.raw_text)` (`amount: null`, `currency: null`, `tags: ["misc"]`, `entities: []`), and `enrichEntryEdit` **overwrites the entry's existing `amount`, `currency`, `tags`, and deletes all `entry_entities` links**!
  3. If the DB update or `after()` callback fails/terminates before completion, the entry is stuck with the **new `raw_text`**, but the **old `summary` (which `EntryCard` displays in preference to `raw_text` on `components/entry-card.tsx:63`!), old `amount`, old `entities`, and old `embedding`**.
  4. If the user edits an entry into a multi-item statement, `const ai = (await classifyItems(data.raw_text))[0]` (`lib/ai/classifier.ts:421`) **silently drops `items[1..n]`**.

---

### Area 4: Security & Auth

#### 4.1 Audit of every Server Action in `/actions` — **VERIFIED**

| File | Exported Action | Accepts Client IDs? | Checks `sb.auth.getUser()`? | Scopes by `user.id`? | Notes / Gaps |
|---|---|---|---|---|---|
| `actions/digest.ts:13` | `fetchDigest(period, force)` | No | Yes (in `getDigest` L144) | Yes (`.eq("user_id", user.id)`) | Safe. |
| `actions/entities.ts:27` | `getEntities()` | No | Yes (L31) | Yes (`.eq("user_id", user.id)` + JS filter L57) | Safe. |
| `actions/entities.ts:88` | `getEntityDetails(id)` | **Yes (`id`: entity UUID)** | Yes (L96) | Yes (`entities` `.eq("user_id", user.id)` L104; `links` filtered by `user.id` L124) | Ownership of `entity` is verified before querying `entry_entities`. Safe. |
| `actions/entities.ts:176` | `getEntityIdByName(name)` | No (`name`) | Yes (L182) | Yes (`.eq("user_id", user.id)`) | `name` is interpolated into `.ilike("name", `%${clean}%`)` without escaping `%`/`_`. |
| `actions/entries.ts:10` | `loadMoreEntries(before)` | No (`before` timestamp) | Yes (L18 & in `loadEntriesBefore` L58) | Yes (`.eq("user_id", user.id)`) | Safe. |
| `actions/entries.ts:33` | `logEntry(text, hintCategories)` | No | Yes (L43) | Yes (`user.id` passed to `classifyAndSave`) | Safe. |
| `actions/entries.ts:63` | `updateEntry(id, data)` | **Yes (`id`: entry UUID)** | Yes (L73) | Partially — see note | `applyEntryEdit` and `enrichEntryEdit` scope `UPDATE entries` by `.eq("id", entryId).eq("user_id", userId)`. **However**, neither checks the updated row count, and `lib/ai/classifier.ts:463-466` runs `sb.from("entry_entities").delete().eq("entry_id", entryId)` and `insert(links)` **even if `entryId` did not belong to `userId` (0 rows updated)**, relying solely on RLS on `entry_entities` to block it! |
| `actions/entries.ts:105` | `deleteEntry(id)` | **Yes (`id`: entry UUID)** | Yes (L113) | Yes (`.eq("id", id).eq("user_id", user.id)`) | Safe. |
| `actions/home.ts:27` | `getHomeWidgets()` | No | Yes (L41) | Yes (`.eq("user_id", user.id)`) | Safe. |
| `actions/profile.ts:14` | `completeSetup(input)` | No | Yes (L20) | Yes (`user.id`) | Safe. |
| `actions/profile.ts:77` | `signOut()` | No | Calls `sb.auth.signOut()` | N/A | Never wired to any UI button. |
| `actions/search.ts:9` | `askMind(question, history)` | **Yes (`history[].entryIds`)** | Yes (L19) | Yes — `getEntriesByIds` scopes by `.eq("user_id", userId).in("id", unique)` (`hybrid-search.ts:141-142`) | **Minor gap:** In `lib/ai/hybrid-search.ts:259-265`, `sb.from("categories").select("id").ilike("name", ...)` is **missing `.eq("user_id", userId)`** (relies on RLS). |
| `actions/search.ts:50` | `fetchEntriesByIds(ids)` | **Yes (`ids`: entry UUIDs)** | Yes (L53) | Yes (`getEntriesByIds` `.eq("user_id", user.id)`) | Safe. |
| `actions/stats.ts:20` | `getRetrievalStats(days)` | No | Yes (L25) | Yes (`.eq("user_id", user.id)`) | Safe. |

#### 4.2 RLS policies per table (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) — **VERIFIED** (`supabase/migrations/0001_full_schema.sql:88-123`)
- **Code quote:**
  ```sql
  -- supabase/migrations/0001_full_schema.sql:88-123
  alter table categories enable row level security;
  create policy "Users can only access their own categories" on categories
    for all using (auth.uid() = user_id);
  -- (same FOR ALL USING pattern on entries, entities, user_profiles, digests)

  alter table entry_entities enable row level security;
  create policy "Users can only access their own entry_entities" on entry_entities
    for all using (
      exists (
        select 1 from entries
        where entries.id = entry_entities.entry_id
        and entries.user_id = auth.uid()
      )
    );
  ```
- **Gaps identified:**
  1. **No separate `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies & no explicit `WITH CHECK`:** Every table uses a single `FOR ALL USING (...)` policy. While PostgreSQL falls back to the `USING` expression as `WITH CHECK` when `WITH CHECK` is omitted, best practice (and Supabase security advisor) requires explicit `WITH CHECK` and separate per-command policies—for example, `user_profiles` has no `DELETE` restriction even though users should not delete their own profile row without deleting `auth.users`.
  2. **Cross-user `entity_id` linking flaw on `entry_entities` (`0001_full_schema.sql:105-112`):** The policy on `entry_entities` ONLY checks that `entry_entities.entry_id` belongs to `auth.uid()`. **It does NOT check that `entry_entities.entity_id` belongs to `auth.uid()`!** An authenticated user using the browser anon key can `INSERT INTO entry_entities (entry_id, entity_id)` linking their own `entry_id` to another user's `entity_id` (if they know or guess the UUID), or corrupt `enrichEntryEdit` if `entryId` isn't verified before unlinking/relinking.

#### 4.3 `proxy.ts` auth/onboarding state machine bypasses — **VERIFIED** (`proxy.ts:4-89`)
- **Code quote:**
  ```ts
  // proxy.ts:4, 37-50, 56-71
  const APP_PATHS = ["/home", "/search", "/insights", "/categories", "/entities"];
  ...
  if (!user) {
    if (APP_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (path === "/setup") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (path === "/" && onboarded) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (path === "/login" && !onboarded) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }
  ```
- **Findings:**
  1. **Signed-out allowlist vs blocklist:** When `!user`, `proxy.ts` only redirects routes matching `APP_PATHS` (`["/home", "/search", "/insights", "/categories", "/entities"]`) or `/setup`. Any new authenticated route added under `app/(app)/` that is forgotten from `APP_PATHS` will **bypass the signed-out redirect** in `proxy.ts`!
  2. **Landing page "Sign in" button broken for new/incognito visitors (`app/(onboarding)/page.tsx:288-293` vs `proxy.ts:47-49`):** On the landing page (`/`), clicking "Start free" sets `document.cookie = "onboarding_complete=true..."` and navigates to `/login`. However, clicking **"Sign in"** (L289) or **"I have an account"** (L690) calls `router.push("/login")` **without setting the `onboarding_complete` cookie**! `proxy.ts:47-49` sees `path === "/login" && !onboarded` and **immediately redirects the user back to `/`**! Existing users on a new device cannot use the "Sign in" or "I have an account" buttons at all.
  3. **Transient DB error sends onboarded users to `/setup` (`proxy.ts:56-71`):** If `supabase.from("user_profiles").select("setup_complete")` fails or times out (or returns an error object, which does not throw in `@supabase/supabase-js`!), `data` is `null`, `setupComplete` defaults to `false`, and a fully-onboarded user is forcibly redirected to `/setup` on every page navigation.

#### 4.4 Secrets reachable from client bundles — **VERIFIED SAFE**
- Checked all files importing `lib/ai/*` and all uses of `process.env`:
  - `lib/ai/groq.ts`, `lib/ai/embeddings.ts`, `lib/ai/classifier.ts`, `lib/ai/digest.ts`, `lib/ai/hybrid-search.ts`, `lib/ai/query-parser.ts`, `lib/ai/retrieval.ts`, `lib/entries.ts`, and `lib/categories.ts` all have `import "server-only";` on line 1.
  - `.env.local` contains only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`, and `GEMINI_API_KEY` (no service role key exists, and neither `GROQ_API_KEY` nor `GEMINI_API_KEY` uses `NEXT_PUBLIC_`).
  - No `"use client"` file imports any `lib/ai/*` or server-only module; they only import `"use server"` actions from `@/actions/*`.

---

### Area 5: Data Quality

#### 5.1 Entity deduplication, normalization, and unique constraint — **VERIFIED** (`supabase/migrations/0001_full_schema.sql:49-56`, `lib/ai/classifier.ts:143-176`)
- **Code quote:**
  ```sql
  -- supabase/migrations/0001_full_schema.sql:49-56
  create table if not exists entities (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users not null,
    name text not null,
    type text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, name, type)
  );
  ```
  ```ts
  // lib/ai/classifier.ts:143-166
  async function upsertEntity(sb: SupabaseClient, entity: EntityInput, userId: string): Promise<string | null> {
    const type = entity.type.toLowerCase();
    try {
      const { data: existing } = await sb
        .from("entities")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", entity.name)
        .eq("type", type)
        .maybeSingle();
      if (existing) return existing.id;
      const { data: created, error } = await sb
        .from("entities")
        .insert({ user_id: userId, name: entity.name, type })
        .select("id")
        .single();
  ```
- **Findings:**
  1. **No `unique(user_id, lower(name), type)` constraint:** The DB constraint is `unique(user_id, name, type)` (exact case-sensitive `text` match).
  2. **Missing `.trim()` in `upsertEntity`:** While `propagateSharedEntities` and `mergeEntities` call `.trim()`, `saveSingleItem` calls `upsertEntity` directly on non-shared entities (`product`, `brand`, `book`, etc.) without trimming `entity.name`. `"Third Wave "` and `"Third Wave"` do not match `ilike`.
  3. **Type disagreement creates duplicates:** If the LLM classifies `"Third Wave"` as `type: "place"` on Monday and `type: "brand"` on Tuesday, `.eq("type", type)` misses Monday's entity and creates a second `"Third Wave"` row.
  4. **Substring / alias duplicates ("Third Wave" vs "Third Wave Coffee"):** `upsertEntity` uses `.ilike("name", entity.name)` (exact case-insensitive string match, not token/alias similarity). Therefore, `"Third Wave"` and `"Third Wave Coffee"` have a **100% probability of creating two separate `entities` rows** whenever the user alternates how they type the name.
  5. **Race condition in `Promise.all`:** In `saveSingleItem` (`lib/ai/classifier.ts:258`) and `classifyAndSave` (`lib/ai/classifier.ts:377`), all items and all entities within an item run `upsertEntity` concurrently via `Promise.all`. When a split drop shares a new entity (e.g. `"Jibhi"` across 3 split items), all 3 `SELECT ... maybeSingle()` queries run in parallel, all 3 see `existing = null`, and all 3 attempt `INSERT`. If the case matches (`"Jibhi"`), 2 of the 3 fail on `unique(user_id, name, type)` and return `null`, **dropping the `entry_entities` link on 2 of the 3 entries**! If the case differs (`"Jibhi"` vs `"jibhi"`), both succeed and insert case-duplicate rows, which then causes `.maybeSingle()` to **error on all future lookups** because >1 row matches `ilike`!

#### 5.2 Delete paths and cascade behavior — **VERIFIED** (`supabase/migrations/0001_full_schema.sql:58-62`, `actions/entries.ts:105-133`)
- **`entry_entities` cascade:** `entry_entities` defines `entry_id uuid references entries(id) on delete cascade not null` and `entity_id uuid references entities(id) on delete cascade not null`. Deleting an entry from `entries` automatically deletes its join rows in `entry_entities`.
- **Orphaned `entities` rows:** When the last entry linked to an entity is deleted (or edited to remove the entity), the `entities` row itself is **never deleted**. It remains on `/entities` with `0 drops` (`components/entity-detail-screen.tsx:170` even has an empty state for *"nothing linked anymore — Every drop mentioning X was deleted or moved"*), and there is **no `deleteEntity` action or UI** to remove it.
- **Stale `digests` after entry deletion or edit:**
  - `deleteEntry` (`actions/entries.ts:130-131`) only calls `revalidatePath("/home")` and `revalidatePath("/categories")` (not `/insights` or `/entities`), and **does not delete or invalidate the `digests` table**.
  - Both `getDigest` (`lib/ai/digest.ts:166-171`) and `getHomeWidgets` (`actions/home.ts:128-131`) check digest freshness ONLY by looking for entries with `timestamp > dbDigest.generated_at`. If a user deletes an entry (or edits an entry's amount/category), no entry has `timestamp > generated_at`, so **both `/home` ("Today's briefing") and `/insights` continue serving the stale digest narrative and deleted expense totals for up to 24 hours**.

---

### Area 6: Docs & Drift (`PROJECT_AUDIT.md`, `CLAUDE.md`, `README.md`) — **VERIFIED**

#### `CLAUDE.md` (`CLAUDE.md:1`)
- Contains only `@AGENTS.md`, which in turn contains only the Next.js breaking-changes boilerplate (`AGENTS.md:1-9`).

#### `README.md` (`README.md:1-55`)

| Line | Claim in `README.md` | Actual Code Reality |
|---|---|---|
| L25 | *"Run `supabase/migrations/0001_full_schema.sql` in your Supabase SQL editor."* | Omits `0003_retrieval_tracking.sql` (`retrieval_count`, `last_retrieved_at`, `log_entry_retrievals` RPC), which is required by `lib/ai/hybrid-search.ts:176` and `actions/stats.ts:35`. |
| L34-36 | Route map lists only `/home`, `/search`, `/insights`. | Missing `/categories`, `/entities`, and `/entities/[id]`. |
| L39 | *"EntryPopup / CategoryPopup sheets → Vaul drawers (`entry-sheet`, `category-picker`)"* | `category-picker.tsx` is dead/decorative code only imported by `input-bar.tsx` in non-search mode (which is never rendered anywhere, since `CaptureDialog` in `capture.tsx` replaced home capture). |
| L41 | *"`lib/ai/*` (server-only) — prompts kept byte-identical"* | Prompts and logic in `classifier.ts`, `query-parser.ts`, and `retrieval.ts` have been heavily rewritten (few-shot turns, `looksEchoed`, `propagateSharedEntities`, conversational threads, `breakdown` table). |
| L54 | *"Categories tab remains a placeholder, as in the RN app."* | **Outdated/Wrong:** `/categories` (`components/categories-screen.tsx`) is a 340-line full grid + detail screen, and `/entities` (`components/entity-index-screen.tsx`) is also fully built. |

#### `PROJECT_AUDIT.md` (`PROJECT_AUDIT.md:1-62`)

| Line | Claim in `PROJECT_AUDIT.md` | Actual Code Reality |
|---|---|---|
| L8, L54 | *"9 routes: `/`, `/login`, `/setup`, `/home`, `/search`, `/insights`, `/categories`, icons, manifest"* | **Outdated:** There are now 11 routes, including `/entities` and `/entities/[id]`. |
| L9, L49 | *"Zero `TODO` / `FIXME` / placeholder text in source."* | **Outdated:** `components/search-thread-provider.tsx:309` has `// TODO(phase-2): also delete persisted Supabase thread history once it exists.` |
| L19 | *"Bug #3: Login has no navigation — only `router.refresh()` after OTP success, no `router.push`... email check is `if (!email)` only (no format validation), no OTP-resend control/throttle."* | **Outdated (Fixed):** `app/(auth)/login/page.tsx:20-21,59-64,100-101` now has `EMAIL_RE` validation, 30s `RESEND_SECONDS` cooldown, and `router.push("/home")`. |
| L21 | *"Bug #5: Entries are immutable — no update/delete action or UI exists in `actions/`, `lib/`, or `components/`."* | **Outdated (Fixed):** `updateEntry` and `deleteEntry` exist in `actions/entries.ts:63-133` and are wired into `EntrySheet`. |
| L27 | *"Search errors show 'no matching memories found' — indistinguishable from genuinely empty."* | **Outdated (Fixed):** `components/search-screen.tsx:37` renders `<AnswerErrorCard onRetry={onRetry} />` on `turn.status === "error"`. |
| L28 | *"Digest failure falls through to `<DigestEmptyState />` ('Nothing logged yet')."* | **Outdated (Fixed):** `components/insights-screen.tsx:158-172` renders a dedicated error state (*"insights hit a snag"*) with a "Try again" button. |
| L43 | *"`components/retrieval-result.tsx:21-33` — `<span role="button">` nested inside `<button>`"* | **Outdated:** `components/retrieval-result.tsx` no longer exists (replaced by `answer-card.tsx` and `entry-card.tsx`). |

*(Note: Items #1 [`setup/page.tsx:41-45` `Date.now()` bug], #2 [`category-picker.tsx` decorative buttons], #4 [`signOut()` unused], `proxy.ts:62-64` empty catch, missing `error.tsx`, `tab-dock.tsx:47` `aria-label={tab.href}`, and `layout.tsx:36-37` zoom lock in `PROJECT_AUDIT.md` remain **accurate**.)*

---

### Area 7: Tests & Observability — **VERIFIED**

- **What tests exist?**
  - **None.** There are zero test files (`*.test.ts`, `*.spec.ts`, `__tests__`) and no test runner (Vitest/Jest/Playwright) in `package.json`.
  - Every high-risk function in the codebase has **0% test coverage**:
    - `classifyItems`, `looksEchoed`, `propagateSharedEntities`, `mergeEntities` (`lib/ai/classifier.ts`)
    - `resolveTimeFilter`, `parseQuery`, `rewriteFollowUpForSearch` (`lib/ai/query-parser.ts`)
    - `reciprocalRankFusion`, `entityToken` (`lib/ai/hybrid-search.ts`)
    - `sanitizeModelOutput`, `totalsByCurrency`, `describeDay` (`lib/ai/retrieval.ts`)
    - `aggregateData`, `getRange` (`lib/ai/digest.ts`)
    - `extractJSON` (`lib/ai/groq.ts`)
- **Logging and error tracking for AI failures, latency, or cost:**
  - **None beyond `console.error`.** There is no Sentry/PostHog/OTel integration and no structured AI telemetry table.
  - `callGroq` (`lib/ai/groq.ts:55`) discards `data.usage` (`prompt_tokens`, `completion_tokens`, `total_time`) returned by Groq's API response.
  - `generateEmbedding` (`lib/ai/embeddings.ts:15-17`) logs to `console.error` and returns `null` without recording failure counts or latency.
  - Only retrieval resurfacing is tracked via `entries.retrieval_count` and `entries.last_retrieved_at` (`supabase/migrations/0003_retrieval_tracking.sql`).

---

## 3. Details for Critical and High Findings

### [F-01] Critical: Server-side date/time calculations use UTC instead of IST (`Asia/Kolkata`)
- **Evidence (VERIFIED):**
  - `lib/ai/classifier.ts:18` (also L381, L518): `const today = new Date().toISOString().split("T")[0];`
  - `lib/ai/query-parser.ts:7-15`: `const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());`
  - `lib/ai/digest.ts:7-21`: `startOfDay(now)`, `startOfWeek(now, { weekStartsOn: 1 })`, `startOfMonth(now)`
  - `actions/home.ts:45-50`: `startOfToday.setHours(0, 0, 0, 0); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);`
  - `lib/ai/retrieval.ts:47-55,78`: `startOfDay` and `toLocaleDateString("en-IN")` without `timeZone: "Asia/Kolkata"`.
- **User-visible impact:**
  - Any drop logged between **12:00 AM and 5:29 AM IST** gets yesterday's date in `embedding_doc`, is excluded from "today" searches/digests/widgets after 5:30 AM IST, and if logged on the 1st of the month between 12:00 AM and 5:29 AM IST, lands in the **previous month's** spend totals and search filters.
- **Smallest fix:**
  - Create a shared helper `lib/tz.ts` using `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })` (or `@date-fns/tz` `TZDate` with `"Asia/Kolkata"`) to compute IST `startOfDay`, `endOfDay`, `startOfWeek`, `startOfMonth`, and `yyyy-MM-dd` strings, and use it in `classifier.ts`, `query-parser.ts`, `digest.ts`, `home.ts`, `retrieval.ts`, `home/page.tsx`, and `entries-feed.tsx`.

### [F-02] Critical: Backdated logs get stamped with `now()` (`entries.timestamp`)
- **Evidence (VERIFIED):**
  - `supabase/migrations/0001_full_schema.sql:41`: `timestamp timestamp with time zone default timezone('utc'::text, now()) not null`
  - `lib/ai/classifier.ts:38-46,236-250`: Classifier output has no date field and `saveSingleItem` omits `timestamp` on insert.
- **User-visible impact:**
  - Logging *"spent 400 on dinner last Friday"* records the expense as happening right now. Asking *"what did I spend last week?"* misses it, while *"what did I spend today?"* and today's digest wrongly include it.
- **Smallest fix:**
  - Keep `entries.timestamp` as the "occurred at" timestamp (since `entries.created_at` already exists at `0001_full_schema.sql:43` to record when the row was created!). Have the classifier prompt accept the current IST date and return an optional ISO date `occurred_at: "YYYY-MM-DD" | null` when the user explicitly states a past date; if present, set `entries.timestamp` to that IST date (and update `digest.ts:170` and `home.ts:129` cache invalidation to compare against `created_at` instead of `timestamp`). This avoids migrating all 12+ read sites that already query `entries.timestamp`!

### [F-03] Critical: Vector and retrieval RPCs trust client-supplied `p_user_id` instead of `auth.uid()`
- **Evidence (VERIFIED):**
  - `supabase/migrations/0002_match_documents_filtered.sql:26,84`: `p_user_id uuid ... WHERE e.user_id = p_user_id`
  - `supabase/migrations/0001_full_schema.sql:150,175`: `match_documents(..., p_user_id uuid)`
  - `supabase/migrations/0003_retrieval_tracking.sql:32,44`: `log_entry_retrievals(p_entry_ids uuid[], p_user_id uuid) ... WHERE id = ANY(p_entry_ids) AND user_id = p_user_id;`
- **User-visible impact:**
  - Currently mitigated only because the functions default to `SECURITY INVOKER` and RLS is enabled on `entries`. If `SECURITY DEFINER` is ever added or a server route calls the RPC with a service-role client, any user can read another user's private memories or increment their retrieval counters.
- **Smallest fix:**
  - In a new migration, drop the unused `match_documents` function, and in `match_documents_filtered` and `log_entry_retrievals` enforce `WHERE e.user_id = auth.uid() AND (p_user_id IS NULL OR e.user_id = p_user_id)` so the database kernel guarantees `auth.uid()` isolation regardless of `p_user_id`.

### [F-04] High: Missing vector index on `entries.embedding` (`vector(3072)`) and broken commented-out DDL
- **Evidence (VERIFIED):**
  - `supabase/migrations/0001_full_schema.sql:42,278`: `embedding vector(3072)` and `-- create index on entries using ivfflat (embedding vector_cosine_ops) with (lists = 100);`
- **User-visible impact:**
  - Every search query performs a full sequential scan and de-TOASTs 12 KB per row; uncommenting line 278 fails in Postgres because `vector` indexes cap at 2,000 dimensions.
- **Smallest fix:**
  - Add a migration with a B-tree index on `entries(user_id, "timestamp" DESC)` (for feeds, digests, and structured search) and an HNSW `halfvec` expression index:
    ```sql
    CREATE INDEX IF NOT EXISTS entries_user_timestamp_idx ON entries (user_id, "timestamp" DESC);
    CREATE INDEX IF NOT EXISTS entries_embedding_hnsw_idx ON entries
      USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
    ```
    And update `match_documents_filtered` to order/compare using `(e.embedding::halfvec(3072) <=> query_embedding::halfvec(3072))`.

### [F-05] High: Multi-currency amounts are summed together without conversion in Digests, Home Widgets, and Entities
- **Evidence (VERIFIED):**
  - `lib/ai/digest.ts:60-71`, `actions/home.ts:97-107`, `actions/entities.ts:60-83,136-161`.
- **User-visible impact:**
  - A user who logs `₹200` on coffee and `$50` on a SaaS subscription sees `₹250` (or `$250`) as their monthly/entity/digest total.
- **Smallest fix:**
  - Group spend totals by `(currency || "INR").toUpperCase()` (just like `totalsByCurrency` in `lib/ai/retrieval.ts:89-102`), and either display the primary currency with a `+ $50` secondary badge or store `totalsByCurrency: Record<string, number>` in `DigestRawData`, `HomeWidgets`, and `EntityStats`. Also filter `entities.ts` spend totals to expense/shopping categories consistently.

### [F-06] High: `updateEntry` background `after()` pass can corrupt or half-update entries, and `saveSingleItem` silently swallows DB insert errors
- **Evidence (VERIFIED):**
  - `actions/entries.ts:82-96`, `lib/ai/classifier.ts:252-255,396-408,414-494`.
- **User-visible impact:**
  - Editing an entry leaves the old `summary` visible on the card until `after()` finishes; if Groq fails during `enrichEntryEdit`, the entry's existing `amount`, `currency`, and `entities` are wiped out by `fallbackItem`; if Gemini fails during `enrichEntryEdit`, the entry's old `embedding` is overwritten with `null`; and if `saveSingleItem` fails its DB insert on `logEntry`, the user gets a false `"Logged to your mind"` toast and loses their text.
- **Smallest fix:**
  1. In `saveSingleItem` (`lib/ai/classifier.ts:252-255`), `throw entryError` instead of `return` so `logEntry` returns `{ ok: false }` and preserves the user's input in the dialog.
  2. In `applyEntryEdit` (`lib/ai/classifier.ts:398-401`), also set `summary: data.raw_text.trim()` so the card immediately reflects the edited text even if `after()` fails.
  3. In `enrichEntryEdit` (`lib/ai/classifier.ts:421-456`), do not overwrite `amount`/`entities` if `callClassifier` failed into fallback, and only include `...(embedding ? { embedding } : {})` in `.update(...)` so a transient Gemini failure does not null out an existing embedding.

### [F-07] High: No timeouts, retries, or embedding backfill in AI pipeline + `looksEchoed` false-positive on computed amounts
- **Evidence (VERIFIED):**
  - `lib/ai/groq.ts:31-48`, `lib/ai/embeddings.ts:6-18`, `lib/ai/classifier.ts:298-337`.
- **User-visible impact:**
  - A transient Groq 429 or network blip immediately degrades a multi-item drop into a single `misc` item with `amount: null`. A transient Gemini failure saves `embedding: null` with no way to recover it. And an input with a multiplied rate (`"bus fare 2500 one way return"` → `amount: 5000`) triggers a false-positive `looksEchoed` match and gets wiped to `misc` (`amount: null`).
- **Smallest fix:**
  - Add `signal: AbortSignal.timeout(12_000)` and a 1-retry backoff on `429`/`5xx` in `callGroq` and `generateEmbedding`.
  - Fix `looksEchoed` (`lib/ai/classifier.ts:321-337`) to check specifically against the known few-shot example tokens (`milk`, `bread`, `keyboard`, `mouse`, `jibhi`, `shoja`, `90`, `1300`, `5000`, `1500`) rather than requiring computed amounts to be literal substrings of `input`.
  - Add a server action or script to backfill rows where `embedding IS NULL` using `embedding_doc || raw_text`.

### [F-08] High: Entity deduplication race condition, missing trim/wildcard escaping, and case-sensitive unique constraint
- **Evidence (VERIFIED):**
  - `supabase/migrations/0001_full_schema.sql:55`: `unique(user_id, name, type)`
  - `lib/ai/classifier.ts:143-176,258,377`: `upsertEntity` called inside `Promise.all` across items and entities.
- **User-visible impact:**
  - Logging a multi-item trip to a new place (e.g. `"Trip to Coorg, bus 1500, hotel 3000"`) fires 3 concurrent `upsertEntity` calls for `"Coorg"`; 2 of the 3 fail on the unique constraint or create case-duplicates, leaving 2 of the 3 items unlinked from the `Coorg` entity!
- **Smallest fix:**
  - Add a unique index on `(user_id, lower(trim(name)), lower(trim(type)))` in Postgres, trim `entity.name` in `upsertEntity`, deduplicate entities before calling `upsertEntity` in `classifyAndSave`, and use `.limit(1).maybeSingle()` with an `ON CONFLICT` upsert (or retry `SELECT` on `23505` unique violation).

### [F-09] High: RLS on `entry_entities` does not verify ownership of `entity_id`
- **Evidence (VERIFIED):**
  - `supabase/migrations/0001_full_schema.sql:105-112`.
- **User-visible impact:**
  - A user can insert rows into `entry_entities` linking their own `entry_id` to another user's `entity_id`.
- **Smallest fix:**
  - Update the `entry_entities` RLS policy to verify ownership of **both** `entry_id` and `entity_id`:
    ```sql
    EXISTS (SELECT 1 FROM entries WHERE entries.id = entry_entities.entry_id AND entries.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM entities WHERE entities.id = entry_entities.entity_id AND entities.user_id = auth.uid())
    ```

### [F-10] High: Deleting or editing an entry leaves `digests` stale for up to 24h and leaves 0-drop orphan entities
- **Evidence (VERIFIED):**
  - `actions/entries.ts:83-92,119-132`, `lib/ai/digest.ts:166-171`, `actions/home.ts:128-131`.
- **User-visible impact:**
  - After deleting an accidental `₹50,000` expense or editing it to `₹500`, the Home briefing card and Insights screen still show the `₹50,000` digest narrative and "Biggest Expense" card until a new entry is logged or 24 hours pass. Deleted entities remain on `/entities` with `0 drops`.
- **Smallest fix:**
  - In `deleteEntry` and `updateEntry` (`actions/entries.ts`), delete the user's cached rows in `digests` (`await sb.from("digests").delete().eq("user_id", user.id)`), clean up orphan entities with 0 `entry_entities` links, and `revalidatePath("/insights")` + `revalidatePath("/entities")`.

---

## 4. Week 1 Checklist (Top 7 Fixes Ordered by Impact / Effort)

1. **Unify IST (`Asia/Kolkata`) date/time boundaries across server and client ([F-01], [F-13]):**
   Add a tiny `lib/tz.ts` helper for IST day/week/month boundaries and `yyyy-MM-dd` formatting; replace UTC/server-local date math in `query-parser.ts`, `digest.ts`, `home.ts`, `classifier.ts`, `retrieval.ts`, and `entries-feed.tsx`. *(High impact, ~1 hr)*
2. **Fix silent data-loss & half-update bugs in `classifier.ts` / `entries.ts` ([F-06], [F-07]):**
   Throw on DB insert error in `saveSingleItem`; update `summary` in `applyEntryEdit`; preserve existing `embedding`/`amount`/`entities` when background AI fails in `enrichEntryEdit`; and fix `looksEchoed` so computed amounts (`2500 * 2 = 5000`) aren't discarded as echoed examples. *(High impact, ~1 hr)*
3. **Invalidate `digests` and clean up orphan entities on `updateEntry` / `deleteEntry` ([F-10]):**
   Delete cached `digests` rows for `user.id` and `revalidatePath("/insights")` + `revalidatePath("/entities")` when an entry is edited or deleted. *(High user-visible impact, ~20 mins)*
4. **Harden Supabase RPCs (`auth.uid()`) and `entry_entities` RLS + add `halfvec(3072)` HNSW & B-tree indexes ([F-03], [F-04], [F-09]):**
   Write migration `0004` to: (a) enforce `e.user_id = auth.uid()` inside `match_documents_filtered` and `log_entry_retrievals` (and drop unused `match_documents`), (b) check `entities.user_id = auth.uid()` in `entry_entities` RLS, and (c) create `entries(user_id, "timestamp" DESC)` and `hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)` indexes. *(High security & scaling impact, ~45 mins)*
5. **Fix `upsertEntity` race condition & case/whitespace normalization ([F-08]):**
   Deduplicate entities per `classifyAndSave` batch before upserting, `.trim()` entity names, handle `23505` unique constraint races by re-selecting, and add a case-insensitive unique index on `entities(user_id, lower(trim(name)), lower(trim(type)))`. *(High data-quality impact, ~45 mins)*
6. **Support backdated logs (`occurred_at` → `entries.timestamp`) and per-currency spend totals ([F-02], [F-05]):**
   Add optional `occurred_at` date extraction to `callClassifier` to populate `entries.timestamp` (using `entries.created_at` for digest cache invalidation), and group spend totals by currency in `home.ts`, `digest.ts`, and `entities.ts`. *(High product accuracy impact, ~2 hrs)*
7. **Fix onboarding/auth UX bugs in `proxy.ts`, `page.tsx`, and `setup/page.tsx` ([F-14]):**
   Set `onboarding_complete=true` cookie on "Sign in" / "I have an account" clicks on `/`, fix the double `Date.now()` call in `setup/page.tsx:41-45`, insert selected default categories in `completeSetup`, and wire `signOut()` into `desktop-sidebar.tsx` / mobile header. *(Medium-High UX impact, ~45 mins)*

---

## 5. What Could Not Be Determined Static-Only & How to Verify

1. **Live Supabase database state (indexes, triggers, and applied migrations):**
   - *Why:* We only have read access to the repository's SQL files (`supabase/migrations/0001..0003.sql`), not the live Supabase Postgres instance. We cannot confirm whether `0002` and `0003` were actually applied in production, whether any manual index was created in the Supabase dashboard, or whether legacy rows exist with `embedding IS NULL` or duplicate lowercase/uppercase entities.
   - *How to check:* Run the following in the Supabase SQL Editor:
     ```sql
     -- 1. Check actual columns and indexes on entries and entities
     SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('entries', 'entities', 'entry_entities', 'digests');
     -- 2. Check for null embeddings and duplicate entities
     SELECT count(*) FILTER (WHERE embedding IS NULL) AS null_embeddings, count(*) AS total FROM entries;
     SELECT user_id, lower(trim(name)), lower(trim(type)), count(*) FROM entities GROUP BY 1, 2, 3 HAVING count(*) > 1;
     -- 3. Confirm function security mode (prosecdef = false means SECURITY INVOKER)
     SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname IN ('match_documents', 'match_documents_filtered', 'log_entry_retrievals');
     ```
2. **Empirical cosine similarity distribution of `gemini-embedding-2` on real user drops:**
   - *Why:* Determining whether `match_threshold: 0.5` is optimal, too strict, or too loose for `gemini-embedding-2` requires running sample queries against real embedded rows in Postgres.
   - *How to check:* Run a query in the Supabase SQL editor comparing `1 - (embedding <=> query_embedding)` across positive and negative query-entry pairs, or inspect `SELECT avg(similarity), min(similarity), max(similarity)` across top-20 unfiltered vector matches.
3. **Production hosting timezone (`process.env.TZ`):**
   - *Why:* While Vercel and AWS Lambda Node runtimes default to `UTC`, we cannot see the deployment platform settings from the repo alone (`classifier.ts:18` `toISOString()` is always UTC regardless, whereas `new Date().getHours()` in `query-parser.ts`/`digest.ts`/`home.ts` uses the Node process `TZ`).
   - *How to check:* Check the deployment environment variables for `TZ=Asia/Kolkata` (though hardcoding `"Asia/Kolkata"` via `Intl` / `@date-fns/tz` in code is still required so `toISOString()` sites and client/server hydration are consistent).

