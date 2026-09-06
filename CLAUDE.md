# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (also regenerates AGENTS.md, see below)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
```

There is no test suite configured (no test runner is wired up in `package.json`, and no test files exist in the repo) — don't assume `npm test` works.

## Architecture

This is a German-language internal CRM ("Kunden"/Kontakte = contacts, Deals = pipeline deals, Anrufe = calls) built on Next.js App Router + Supabase (Postgres + Auth), styled with Tailwind v4.

### Auth flow (two layers)

1. **`proxy.ts`** (project root) — Next.js 16 renamed `middleware.ts` to `proxy.ts` (functionality is unchanged, see `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). It runs on every matched request, checks the Supabase session, and redirects unauthenticated users away from `/` and `/dashboard/*` to `/login`, and authenticated users away from `/login` to `/dashboard`. Do not create a `middleware.ts` — it will not run.
2. **`app/(dashboard)/layout.tsx`** — re-checks `supabase.auth.getUser()` server-side and redirects to `/login` if absent. It also loads the current user's `profiles` row (role: `admin` | `employee`) to render the sidebar/topbar.

### Data access pattern (no ORM, no API routes)

Each dashboard feature folder under `app/(dashboard)/dashboard/<feature>/` is self-contained and typically has:
- `data.ts` and/or `actions.ts` — direct Supabase queries. Read-heavy queries are often wrapped in React's `cache()` (see `deals/data.ts`); mutations live in files with a top-level `"use server"` directive and are called directly from client components as Server Actions.
- `types.ts` — feature-local types (e.g. `Contact`, `Deal`). The top-level `types/` and `lib/` directories are empty/unused — do not assume shared types live there; add feature types locally instead.
- `components/` — feature-local components (there are also some older/duplicate components directly under the top-level `components/contacts/`; prefer the versions colocated under `dashboard/kontakte/components/` when editing contact UI).

Server actions that return a result use a consistent shape:
```ts
type ActionResult<T = undefined> = { success: boolean; message?: string; data?: T };
```
Mutations call `revalidatePath(...)` on the relevant dashboard path(s) instead of relying on client-side refetching.

### Role-based access

`profiles.role` is `"admin"` or `"employee"`. Regular Supabase calls run under RLS with the logged-in user's session (via `utils/supabase/server.ts` / `client.ts`). Admin-only mutations (user management in `dashboard/settings/admin-actions.ts`) first check `isCurrentUserAdmin()`, then use a separate `@supabase/supabase-js` client constructed with `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS — this service-role client must never be exposed to the browser or used outside already-authorized admin-only code paths.

### Supabase clients

- `utils/supabase/client.ts` — browser client (`createBrowserClient`).
- `utils/supabase/server.ts` — server component/action client (`createServerClient`, cookie-backed via `next/headers`).
- `proxy.ts` builds its own inline server client for the edge request/response cookie dance (can't reuse the above helpers there).

### Import/export

`dashboard/settings/components/DataManagementSettings.tsx` uses the `xlsx` package client-side to parse `.xlsx/.xls/.csv` uploads and generate exports/templates; imported rows are sent to a server action (`importContactsWithDeals`) that creates a contact plus an associated deal per row.

### Styling

Tailwind v4 with a custom design-token system defined in `app/globals.css` via CSS variables + `@theme inline` (not shadcn defaults) — colors like `--background`, `--accent`, `--success/warning/danger/info`, plus `--radius-*` and `--shadow-*` tokens. Use existing tokens/utility classes (`bg-card`, `text-muted-foreground`, `.card-surface`, `.glow-hover`, etc.) rather than introducing new raw hex colors.
