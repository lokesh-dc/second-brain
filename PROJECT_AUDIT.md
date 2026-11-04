# Project Audit — second-mind-web

**Date:** 2026-11-04 (re-verified against current codebase; original audit dated 2026-10-01)
**Scope:** re-verification of #1–#5 and Section 2 items, current route/feature inventory, and remaining resume-readiness items

## Health summary

- `npx tsc --noEmit` passes · `npm run lint` passes · `npm run build` passes (11 routes: `/`, `/login`, `/setup`, `/home`, `/search`, `/insights`, `/categories`, `/entities`, `/entities/[id]`, icons, manifest).
- Error and loading boundaries (`app/error.tsx`, `app/global-error.tsx`, `app/loading.tsx`) are present.
- Stack: Next.js 16 (App Router) · Tailwind v4 · Framer Motion · Supabase (`@supabase/ssr`) · Groq + Gemini server-side via server actions.

## 1. Re-verification of Section 1 Bugs (#1–#5)

| # | Original Issue | Prior Status (Before Branch Fixes) | Current Status | Evidence |
|---|---|---|---|---|
| 1 | Custom category select broken — `Date.now()` called twice, so the chip `id` and the selected-ID never match. | **STILL PRESENT** (`setup/page.tsx:41-45`) | **FIXED** | Single `const id = \`custom-${Date.now()}\`` is now reused for both `setCustomCategories` and `setSelectedCategories` in `app/(onboarding)/setup/page.tsx:41-47`. |
| 2 | Category picker is decorative — buttons only call `onClose`, no `onSelect` prop, no state lifted. | **STILL PRESENT** in `components/category-picker.tsx:20-23` & `components/input-bar.tsx:119-122` (note: active capture dialog in `components/capture.tsx:145-156,106` already lifted `override` and passed it to `logEntry` → `classifyAndSave`). | **FIXED** | `CategoryPicker` (`components/category-picker.tsx:9-39`) now accepts `selected` and `onSelect` and lifts selection into `InputBar` (`components/input-bar.tsx:8-38,123-130`). Primary capture flow (`components/capture.tsx:106` → `actions/entries.ts:54` → `lib/ai/classifier.ts:370-377`) also passes selected hint categories to `classifyAndSave`. |
| 3 | Login has no navigation — only `router.refresh()` after OTP success, no `router.push`. No email format validation, no OTP-resend throttle. | **FIXED** prior to this pass | **FIXED** | `app/(auth)/login/page.tsx:20-21` defines `EMAIL_RE` and `RESEND_SECONDS = 30`; `handleSendOtp` (`login/page.tsx:59-64,76`) validates email format and throttles resends; `handleVerifyOtp` (`login/page.tsx:100-101`) calls both `router.refresh()` and `router.push("/home")`. |
| 4 | No logout — `signOut()` is defined in `actions/profile.ts:77-80` but never called from any screen. | **STILL PRESENT** | **FIXED** | `signOut()` is now wired to the "Sign out" button in `components/desktop-sidebar.tsx:14,91-101` (desktop) and the header sign-out button in `components/entries-feed.tsx:16,213-225` (mobile). |
| 5 | Entries are immutable — no update/delete action or UI exists in `actions/`, `lib/`, or `components/`. | **FIXED / WRONG** prior to this pass | **FIXED** | `updateEntry` and `deleteEntry` exist in `actions/entries.ts:63-133` (backed by `applyEntryEdit` and `enrichEntryEdit` in `lib/ai/classifier.ts:388-494`) and are wired into the edit/delete UI in `components/entry-sheet.tsx:37-116,245-296`, `components/entries-feed.tsx:87-141`, `components/categories-screen.tsx:93-150`, `components/entity-detail-screen.tsx:64-84`, and `components/search-screen.tsx:138-192`. |

## 2. Re-verification of Section 2 (Error handling that misleads)

| Original Issue | Prior Status (Before Branch Fixes) | Current Status | Evidence |
|---|---|---|---|
| Search errors show "no matching memories found" — indistinguishable from genuinely empty. | **FIXED** prior to this pass | **FIXED** | `components/search-screen.tsx:37` checks `turn.status === "error"` and renders `<AnswerErrorCard onRetry={onRetry} />` (`components/answer-card.tsx:104-125`: *"Something went wrong answering that. Your earlier results are still below."*). |
| Digest failure falls through to `<DigestEmptyState />` ("Nothing logged yet"). | **FIXED** prior to this pass | **FIXED** | `actions/digest.ts:20-26` returns `{ digest: null, error: "Couldn't generate insights right now..." }`, and `components/insights-screen.tsx:158-172` renders a dedicated error state (*"insights hit a snag"*) with a retry button before checking `!hasEntries`. |
| Empty `catch` in `proxy.ts:62-64` swallows DB errors into a redirect to `/setup`. | **STILL PRESENT** (`proxy.ts:56-64`) | **FIXED** | `proxy.ts:54-69` now defaults `setupComplete = true` (fail-open for signed-in users on transient DB errors) and logs `error` / caught exceptions via `console.error`. |
| No `error.tsx` / `loading.tsx` / `global-error.tsx` under `app/`. | **STILL PRESENT** | **FIXED** | Added `app/error.tsx`, `app/global-error.tsx`, and `app/loading.tsx`. |

## 3. Resume-readiness gaps (remaining)

- **Tests:** none — no `*.test.*`, no `__tests__`, no `typecheck`/`test` scripts in `package.json`, no CI config.
- **Env docs:** no `.env.example` committed (keys only exist in local untracked `.env.local`).
- **README stale:**
  - Still says "Categories tab remains a placeholder" — false, categories screen (`components/categories-screen.tsx`, 340 lines) and entities explorer (`app/(app)/entities/page.tsx`, `app/(app)/entities/[id]/page.tsx`) are fully built.
  - DB section documents only `0001_full_schema.sql`, omits `0002_match_documents_filtered.sql` + `0003_retrieval_tracking.sql`.
  - Stray `# second-brain` heading at end (`README.md:55`).
- **Accessibility nits:**
  - `components/tab-dock.tsx:47` — `aria-label={tab.href}` announces literal `"/home"`, `"/search"` to screen readers.
  - `app/layout.tsx:33-38` — `maximumScale: 1, userScalable: false` disables pinch-zoom (WCAG 1.4.4 failure).
- **Deep architectural audit:** see `CODEBASE_AUDIT.md` for vector index (`halfvec(3072)`), IST timezone boundaries, multi-currency aggregation, and RLS findings.
