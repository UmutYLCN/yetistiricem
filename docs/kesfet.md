# Keşfet

Keşfet is the planner's shared shelf of camps: students publish a camp from Kamplar ("Yayınla"), everyone can open it (branches, videos, tempo, how long it takes) and add a copy to their own plan ("Kendi planıma ekle"). Publishing needs an account; browsing and copying do not.

Code: `src/lib/catalog.ts` (pure: rows, publish payload, search; `tests/catalog.test.ts`), `src/lib/catalogApi.ts` (Supabase calls, loaded on demand), `src/hooks/useCatalogAccount.ts` (session), `src/components/views/DiscoverView.tsx`, `src/components/discover/`, `src/components/camps/PublishCampDialog.tsx`. Schema and policies: `supabase/migrations/20260926000000_kesfet_catalog.sql`.

## Data

- `profiles`: `id` (the auth user), `display_name` (2–40 characters). A trigger creates it on sign-up from the Google name or the e-mail's local part; the student can rename it. E-mail addresses are never published.
- `published_camps`: the author, their local `source_camp_id` (unique per author, so publishing the same camp again updates it), `name`, `description`, summary columns for the list (`subjects`, `branch_count`, `video_count`, `total_minutes`) and `payload`, the camp share document of [camp-share-link.md](camp-share-link.md). Progress, notes, shifts and completion days are never published; sample and legacy branches are left out.
- Row level security: everyone (signed out too) reads; a signed-in student inserts only as themselves and updates or deletes only their own rows; a trigger keeps `author_id` and `created_at` fixed and allows at most 20 camps per person.
- Rows come from other people, so the app checks every list row (`readCatalogRow`) and every document with the share-link checks (`readCatalogCamp`); a camp with a broken document cannot be added. Imported camps get fresh ids and start on the import day.

## Setup

1. Supabase project `yetistiricem` (`ttemxjjxhslnjbpmmszq`, eu-central-1). Apply the migration above to a new project.
2. `.env.local` (git-ignored; see `.env.example`):
   ```
   VITE_SUPABASE_URL=https://ttemxjjxhslnjbpmmszq.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   ```
   Both are public by design (the browser reads them; row level security guards the data). Never put a service-role key in the app. `npm run pages:deploy` builds locally, so these values are baked into the deployed bundle; a Git-connected Pages build needs them as build variables. Without them Keşfet shows "bu sunucuda kurulmamış" and nothing else changes.
3. Supabase → Authentication → URL Configuration: Site URL `https://yetistiricem.pages.dev`; Redirect URLs `https://yetistiricem.pages.dev/app?view=kesfet` and `http://localhost:5173/app?view=kesfet` (sign-in links return to `/app?view=kesfet`, which opens Keşfet).
4. E-mail sign-in (magic link) works out of the box, but Supabase's built-in mailer sends only a few e-mails an hour; set up custom SMTP (Authentication → Emails) before real use.
5. Google (optional): create an OAuth client in Google Cloud (authorized redirect URI `https://ttemxjjxhslnjbpmmszq.supabase.co/auth/v1/callback`) and enable the Google provider in Supabase. The sign-in dialog shows "Google ile devam et" as soon as the provider is on (`/auth/v1/settings`).

The session is kept by supabase-js under `yt_auth`; "Tüm verileri sil" clears it with the other keys.

## Not in V1

No reporting or moderation screen: remove unwanted rows from the Supabase dashboard. No likes, copy counts or comments.
