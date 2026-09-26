# Sign-in and Keşfet

The planner at `/app` needs an account (Supabase Auth: email and password, or Google once the provider is on). Keşfet is its shared shelf of camps: students publish a camp from Kamplar ("Yayınla"), everyone can open it (branches, videos, tempo, how long it takes) and add a copy to their own plan ("Kendi planıma ekle").

## Sign-in

- `AuthGate` (`src/components/auth/AuthGate.tsx`) wraps the planner: signed-out visitors get the sign-in / account creation page; the demo (`/app?demo`, nothing is saved) and a local development build without Supabase config open without an account. A browser with a saved session (`yt_auth`) opens the planner at once while the session is confirmed. Landing account buttons open `/app?account` so the sign-in or current-account screen is explicit.
- The planner reads storage once per page load, so it never mounts twice in one page: signing out, or a session that turns out invalid, starts a fresh page on the sign-in screen. Leaving the demo without an account does the same; a Keşfet camp copied in the demo travels in an import link and is offered after sign-in.
- Email confirmation and Google sign-in return to `/app` (Keşfet's in-demo dialog: `/app?view=kesfet`). An auth callback that falls back to the Site URL (return address not allow-listed) is forwarded from `/` to `/app` in `src/main.tsx`; callback errors are explained on the sign-in page, and tokens leave the address bar once read.
- Camps, progress and notes sync to the signed-in account. The current browser keeps a working copy; when another device saves first, its newer plan opens and this device's unsaved copy is kept as a local recovery. Signing out removes the account's plan from this browser.

Code: `src/lib/catalog.ts` (pure: rows, publish payload, search; `tests/catalog.test.ts`), `src/lib/catalogApi.ts` (Supabase calls, loaded on demand), `src/hooks/useCatalogAccount.ts` (session), `src/components/views/DiscoverView.tsx`, `src/components/discover/`, `src/components/camps/PublishCampDialog.tsx`. Schema and policies: `supabase/migrations/`.

## Data

- `profiles`: `id` (the auth user), `display_name` (2–40 characters). A trigger creates it on sign-up from the Google name or the e-mail's local part; the student can rename it. E-mail addresses are never published.
- `published_camps`: the author, their local `source_camp_id` (unique per author, so publishing the same camp again updates it), `name`, `description`, summary columns for the list (`subjects`, `branch_count`, `video_count`, `total_minutes`) and `payload`, the camp share document of [camp-share-link.md](camp-share-link.md). Progress, notes, shifts and completion days are never published; sample and legacy branches are left out.
- Row level security: everyone (signed out too) reads; a signed-in student inserts only as themselves and updates or deletes only their own rows; a trigger keeps `author_id` and `created_at` fixed and allows at most 20 camps per person.
- Rows come from other people, so the app checks every list row (`readCatalogRow`) and every document with the share-link checks (`readCatalogCamp`); a camp with a broken document cannot be added. Imported camps get fresh ids and start on the import day.

## Setup

1. Supabase project `yetistiricem` (`ttemxjjxhslnjbpmmszq`, eu-central-1). Apply the SQL migrations in `supabase/migrations/` in timestamp order. The catalog migration creates the shared shelf and profiles; `20260927000000_planner_state.sql` creates private account storage for plans.
2. `.env.local` (git-ignored; see `.env.example`):
   ```
   VITE_SUPABASE_URL=https://ttemxjjxhslnjbpmmszq.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   ```
   Both are public by design (the browser reads them; row level security guards the data). Never put a service-role key in the app. `npm run pages:deploy` builds locally, so these values are baked into the deployed bundle; a Git-connected Pages build needs them as build variables. Without them Keşfet shows "bu sunucuda kurulmamış" and nothing else changes.
3. Supabase → Authentication → URL Configuration: Site URL `https://yetistiricem.pages.dev`; Redirect URLs `https://yetistiricem.pages.dev/app`, `https://yetistiricem.pages.dev/app?view=kesfet` and the same two on `http://localhost:5173` (or `https://yetistiricem.pages.dev/**` and `http://localhost:5173/**`).
4. Email and password sign-in is the current flow. For testing without SMTP, turn off **Confirm email** under Authentication → Sign In / Providers → Email; this lets new accounts sign in without verifying the email. This allows accounts with unverified email addresses, so use it only while testing. Turn confirmation back on after configuring custom SMTP. Supabase's built-in mailer only sends to project organization members and is limited to 2 emails per hour; configure custom SMTP (Authentication → Emails) before public use.
5. Google (optional): create an OAuth client in Google Cloud (authorized redirect URI `https://ttemxjjxhslnjbpmmszq.supabase.co/auth/v1/callback`) and enable the Google provider in Supabase. The sign-in dialog shows "Google ile devam et" as soon as the provider is on (`/auth/v1/settings`).

The session is kept by supabase-js under `yt_auth`; "Tüm verileri sil" clears planner data but leaves the account signed in.

## Not in V1

No reporting or moderation screen: remove unwanted rows from the Supabase dashboard. No likes, copy counts or comments.
