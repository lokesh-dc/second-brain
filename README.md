# Mindrop Web — Next.js rebuild of `second-mind`

Web port of the React Native (Expo) app, built per `NEXTJS_MIGRATION.md` in the
original repo. Next.js 16 (App Router) · Tailwind v4 · Framer Motion · Supabase
(`@supabase/ssr`) · Groq + Gemini server-side.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Env (`.env.local`, keys migrated from the RN app):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GROQ_API_KEY=...      # server-only now (was client-exposed in RN)
GEMINI_API_KEY=...    # server-only now
```

## Database

Run `supabase/migrations/0001_full_schema.sql` in your Supabase SQL editor.
It consolidates the original schema **plus the pieces that were missing from the
RN repo**: `entries.tags` / `entries.embedding_doc` columns, the `digests`
table, and the `match_documents_filtered` RPC. If your DB already has the base
tables, only run the sections marked `[NEW]`.

## Map to the RN app

| RN | Web |
|---|---|
| `app/(tabs)/index` | `app/(app)/home` |
| `app/(tabs)/search` | `app/(app)/search` |
| `app/(tabs)/insights` | `app/(app)/insights` |
| `CustomTabBar` | `components/tab-dock.tsx` (Framer Motion) |
| EntryPopup / CategoryPopup sheets | Vaul drawers (`entry-sheet`, `category-picker`) |
| DeviceEventEmitter | route-based state + server actions + router.refresh() |
| lib/classifier, queryParser, hybridSearch, ai, useDigest | `lib/ai/*` (server-only) — prompts kept byte-identical |

Auth gate lives in `proxy.ts` (Next 16 renamed middleware→proxy): onboarding →
login → setup → app, mirroring the RN `_layout.tsx` state machine. Onboarding
completion is stored in an `onboarding_complete` cookie; session via Supabase
cookies.

## Notes

- All AI calls (Groq/Gemini) run on the server via server actions
  (`actions/`) — no API keys ship to the browser.
- Optimistic "Categorising your thought..." placeholder from the RN capture is
  replaced by a toast + `router.refresh()` for simplicity.
- Categories tab remains a placeholder, as in the RN app.
# second-brain
