# Project Audit — second-mind-web

**Date:** 2026-10-01
**Scope:** pending work, broken features, resume-readiness gaps

## Health summary

- `npm run build` passes (9 routes: `/`, `/login`, `/setup`, `/home`, `/search`, `/insights`, `/categories`, icons, manifest).
- Zero `TODO` / `FIXME` / placeholder text in source.
- Git tree clean, `.env.local` correctly untracked (`.gitignore` covers `.env*`).
- Stack: Next.js 16 (App Router) · Tailwind v4 · Framer Motion · Supabase (`@supabase/ssr`) · Groq + Gemini server-side via server actions.

## 1. Real bugs (verified by reading code)

| # | Issue | Location |
|---|-------|----------|
| 1 | Custom category select broken — `Date.now()` called twice, so the chip `id` and the selected-ID never match. Custom category can never show as selected. | `app/(onboarding)/setup/page.tsx:41-45` |
| 2 | Category picker is decorative — buttons only call `onClose`, no `onSelect` prop, no state lifted. Tapping a category does nothing. | `components/category-picker.tsx:20-23` |
| 3 | Login has no navigation — only `router.refresh()` after OTP success, no `router.push`. If the proxy redirect doesn't fire on refresh, user sits on login with no feedback. Also: email check is `if (!email)` only (no format validation), no OTP-resend control/throttle. | `app/(auth)/login/page.tsx:49-54` |
| 4 | No logout — `signOut()` is defined but never called from any screen. | `actions/profile.ts:77-80` |
| 5 | Entries are immutable — no update/delete action or UI exists in `actions/`, `lib/`, or `components/`. | repo-wide (confirmed by search) |

## 2. Error handling that misleads

| Issue | Location |
|-------|----------|
| Search errors show "no matching memories found" — indistinguishable from genuinely empty. No toast. | `components/search-screen.tsx:38-39`, `actions/search.ts:19` |
| Digest failure falls through to `<DigestEmptyState />` ("Nothing logged yet"). | `components/insights-screen.tsx:50-54` |
| Empty `catch` swallows DB errors into a redirect — any transient `user_profiles` read failure sends a fully-onboarded user to `/setup`. Should fail open to `/home` or an error page, and log. | `proxy.ts:62-64` |
| No `error.tsx` / `loading.tsx` / `global-error.tsx` under `app/` — one thrown error = full route crash page. | `app/` (missing files) |

## 3. Resume-readiness gaps

- **Tests:** none — no `*.test.*`, no `__tests__`, no `typecheck`/`test` scripts in `package.json`, no CI config.
- **Env docs:** no `.env.example` committed (keys only exist in local untracked `.env.local`).
- **README stale:**
  - Still says "Categories tab remains a placeholder" — false, categories screen is fully built (270 lines).
  - DB section documents only `0001_full_schema.sql`, omits `0002_match_documents_filtered.sql` + `0003_retrieval_tracking.sql`.
  - Missing features / architecture / screenshots / deployment / testing sections.
  - Stray `# second-brain` heading at end (line 55).
- **Accessibility nits:**
  - `components/tab-dock.tsx:131` — `aria-label={tab.href}` announces literal "/home", "/search" to screen readers. Use "Home" etc.
  - `components/retrieval-result.tsx:21-33` — `<span role="button">` nested inside `<button>` (invalid interactive nesting).
  - `app/layout.tsx:33-38` — `maximumScale: 1, userScalable: false` disables pinch-zoom (WCAG 1.4.4 failure). No per-page `metadata` beyond root layout.
- **Config:** `next.config.ts` is an empty stub (fine for now, nothing to review).

## 4. Verified clean (no action needed)

- No `TODO` / `FIXME` / `XXX` / `HACK` / `coming soon` / `lorem` / `not implemented` hits in source.
- No `as any` / `: any`, no `eslint-disable`, no `@ts-ignore`.
- `console.*` sites are all `console.error` server-side logging (acceptable); the two client-side ones (search, insights) should become toasts per §2.
- `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · `npm run build` exit 0.
- AI keys are server-only (`server-only` imports + `actions/`) — good talking point.
- All routes are real (none are stubs): `/` onboarding, `/login` OTP, `/setup` 3-step, `/home` feed, `/search` hybrid search, `/insights` digest, `/categories` grid + detail, branded 404.

## Suggested fix order

1. Fix `Date.now()` one-liner (single `const id` reused) + wire picker selection — demo-visible bugs.
2. Post-login push + logout button (sidebar) — auth completeness.
3. Error-vs-empty distinction (toasts / error card) + add `app/error.tsx`.
4. README refresh (drop stale placeholder line, document 0002/0003, add `.env.example`) + remove zoom lock.
5. Tests (at least `extractJSON`, time-filter resolver, classifier fallback) + `typecheck`/`test` scripts.
