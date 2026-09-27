# Sign-in and Keşfet

The planner at `/app` needs an account (Supabase Auth: email and password, or Google once the provider is on). Keşfet is its shared shelf of camps: students publish a camp from Kamplar ("Yayınla"), everyone can open it (branches, videos, tempo, how long it takes) and add a copy to their own plan ("Kendi planıma ekle").

## Sign-in

- `AuthGate` (`src/components/auth/AuthGate.tsx`) wraps the planner: signed-out visitors get the sign-in / account creation page; the demo (`/app?demo`, nothing is saved) and a local development build without Supabase config open without an account. A browser with a saved session (`yt_auth`) opens the planner at once while the session is confirmed. Landing account buttons open `/app`: straight into the plan with a session, otherwise the sign-in page. The account (picture, display name, school details, sign-out) lives in Profil ve ayarlar, reached from the sidebar's profile entry.
- The planner reads storage once per page load, so it never mounts twice in one page: signing out, or a session that turns out invalid, starts a fresh page on the sign-in screen. Leaving the demo without an account does the same; a Keşfet camp copied in the demo travels in an import link and is offered after sign-in.
- Email confirmation and Google sign-in return to `/app` (Keşfet's in-demo dialog: `/app?view=kesfet`). An auth callback that falls back to the Site URL (return address not allow-listed) is forwarded from `/` to `/app` in `src/main.tsx`; callback errors are explained on the sign-in page, and tokens leave the address bar once read.
- Camps, progress and notes sync to the signed-in account. `yt_sync` records the working copy's owner, cloud revision and unsaved state. A plan without a verified owner is never merged or uploaded at sign-in: the cloud plan opens, and the local copy is backed up under `yt_sync__sahipsiz` with a notice. When another device saves first, its newer plan opens and this device's unsaved copy is kept under `yt_sync__cakisma`. Signing out, including an expired session, removes the working copy; unsaved changes remain under the owner's `yt_unsynced__<id>` key for that account's next sign-in. Removals trigger an immediate cloud save attempt; a pending local copy is retried when the app reopens if the request cannot finish before the tab closes.

Code: `src/lib/catalog.ts` (pure: rows, publish payload, search; `tests/catalog.test.ts`), `src/lib/catalogApi.ts` (Supabase calls, loaded on demand), `src/hooks/useCatalogAccount.ts` (session), `src/components/views/DiscoverView.tsx`, `src/components/discover/`, `src/components/camps/PublishCampDialog.tsx`. Schema and policies: `supabase/migrations/`.

## Data

- `profiles` (public): `id` (the auth user), `display_name` (2–40 characters; a trigger creates it on sign-up from the Google name or the e-mail's local part), and what Keşfet shows of the author (`20260927040000_public_author_profile.sql`): `avatar` (`shape-1`…`shape-8`, or a photo path `<user id>/<file>` in the public `avatars` Storage bucket, which each student writes only in their own folder), `stage`, `department`, `profession` and `bio` (up to 280 characters). E-mail addresses are never published.
- `student_profiles` (private, owner-only RLS): the school name, the class (`grade`) and `onboarded_at` (null: the welcome questions, `OnboardingDialog`, are still due; skipping sets it too). Rules, labels and the public/private split: `src/lib/studentProfile.ts`; edited in place on the profile card. Uploaded photos are cropped to 256 px in the browser (`src/lib/avatarImage.ts`); saving the profile removes the student's older photos.
- `published_camps`: the author, their local `source_camp_id` (unique per author, so publishing the same camp again updates it), `name`, `description`, summary columns for the list (`subjects`, `branch_count`, `video_count`, `total_minutes`), up to five interest `tags` (lowercase, no "#"), an optional `cover` photo (a path in the author's folder of the public `camp-covers` bucket; 1200 × 750 in the browser), `save_count` and `payload`, the camp share document of [camp-share-link.md](camp-share-link.md). Progress, notes, shifts and completion days are never published; sample and legacy branches are left out.
- `saved_camps` (`20260927050000_kesfet_covers_tags_saves.sql`): the camps a student saved for later (the heart), private to them; a security-definer trigger keeps `published_camps.save_count`, which the author cannot set (the guard keeps it on their updates).
- Row level security: everyone (signed out too) reads; a signed-in student inserts only as themselves and updates or deletes only their own rows; a trigger keeps `author_id` and `created_at` fixed and allows at most 20 camps per person.
- A camp is published only by whoever made it. Camps added from Keşfet or a share link carry `origin: 'kesfet' | 'link'` and offer no "Yayınla"; the database also refuses a second author for the same videos (`content_key`, an order-free fingerprint of the payload's video ids / topic titles, `duplicate_camp`), which covers camps imported before the mark existed.
- Rows come from other people, so the app checks every list row (`readCatalogRow`) and every document with the share-link checks (`readCatalogCamp`); a camp with a broken document cannot be added. Imported camps get fresh ids and start on the import day.

## Setup

1. Supabase project `yetistiricem` (`ttemxjjxhslnjbpmmszq`, eu-central-1). Apply the SQL migrations in `supabase/migrations/` in timestamp order. The catalog migration creates the shared shelf and profiles; `20260927000000_planner_state.sql` creates private account storage for plans.
2. `.env.local` (git-ignored; see `.env.example`):
   ```
   VITE_SUPABASE_URL=https://ttemxjjxhslnjbpmmszq.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   ```
   Both are public by design (the browser reads them; row level security guards the data). Never put a service-role key in the app. Production builds (the Git-connected Pages build and `npm run pages:deploy`) read the same two values from the committed `.env.production`, since Pages dashboard variables did not reach the Vite build; `.env.local` overrides it locally. Without them Keşfet shows "bu sunucuda kurulmamış" and nothing else changes.
3. Supabase → Authentication → URL Configuration: Site URL `https://yetistiricem.pages.dev`; Redirect URLs `https://yetistiricem.pages.dev/app`, `https://yetistiricem.pages.dev/app?view=kesfet` and the same two on `http://localhost:5173` (or `https://yetistiricem.pages.dev/**` and `http://localhost:5173/**`).
4. Email and password sign-in is the current flow. For testing without SMTP, turn off **Confirm email** under Authentication → Sign In / Providers → Email; this lets new accounts sign in without verifying the email. This allows accounts with unverified email addresses, so use it only while testing. Turn confirmation back on after configuring custom SMTP. Supabase's built-in mailer only sends to project organization members and is limited to 2 emails per hour; configure custom SMTP (Authentication → Emails) before public use.
5. Google (optional): create an OAuth client in Google Cloud (authorized redirect URI `https://ttemxjjxhslnjbpmmszq.supabase.co/auth/v1/callback`) and enable the Google provider in Supabase. The sign-in dialog shows "Google ile devam et" as soon as the provider is on (`/auth/v1/settings`).

The session is kept by supabase-js under `yt_auth`; "Tüm verileri sil" clears planner data but leaves the account signed in.

## Not in V1

No reporting or moderation screen: remove unwanted rows from the Supabase dashboard. No likes, copy counts or comments.
