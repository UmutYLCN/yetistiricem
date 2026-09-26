# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Checks: `npm run build`, `npm run lint`, `npm test` (strict type-check of `tests/` via `tsconfig.test.json`, then `node --test` with type stripping; no test framework dependency). Modules that tests or `server/` import must use explicit `.ts` import paths down their whole chain.
- Dates are local `YYYY-MM-DD` keys; use `src/utils/date.ts`. Never `new Date('YYYY-MM-DD')` or `toISOString().split('T')[0]`: both shift the day outside UTC.
- The schedule must not depend on completion: ticking a task only decorates `item.completed`. Shifts are stored events. See `docs/planner-engine.md` for the engine and UI contract.
- Data model: a `StudyCamp` owns its branches (`SubjectPlaylist`; `subject` = branch name), its tempo (`CampSchedule`, auto or manual `weekPlan`) and its shift events, and is always scheduled alone with `buildCampSchedule`. Plan screens show the open camp, or with the "Tüm Kamplar" view scope (`yt_camp_scope`) `buildAllCampsPlan` (`src/lib/allCamps.ts`), which merges the separately built plans by date; each shift event goes to the camp owning its tasks. `all` is never a camp id: management, dialogs and `yt_active_camp` always use a concrete camp. Tempo is per camp only, edited with "Tempoyu düzenle" in Kamplar (never in Ayarlar; plan screens carry no camp/tempo bar). "Branş ekle" adds to the camp it opened for (`addBranches`), never creates one. Data updates go through `src/lib/plannerOps.ts`; wizard rules in `src/lib/campDraft.ts`. Product notes and V1 boundaries: `docs/camp-creation-wizard-notes.md`.
- UI code reaches the engine, storage and date helpers only through `src/lib/engine.ts`. Loading, legacy migration and backups live in `src/lib/persistence.ts`: `yt_camps` is authoritative once it exists; the older flat keys (`yt_playlists`, `yt_prefs`, `yt_shift_events`, `yt_shifted_date`) are read-only migration input, never written. Keep the existing `yt_*` keys, and never drop stored data silently (copy it aside and show a notice).
- Data truth: never invent videos, links, durations or channel names. Video data comes from the user or from the server-side playlist endpoint (`server/`, YouTube Data API v3; contract in `src/utils/youtubePlaylist.ts`, setup in README). Demo templates (`src/data/demoTemplates.ts`) are labelled and link-free; old fabricated camps are detected in `src/lib/camps.ts`.
- `YOUTUBE_API_KEY` is server-only: never give it a `VITE_` prefix, read it in `src/`, or echo it or upstream error text in endpoint responses. `tests/keySecrecy.test.ts` builds the bundle to check. The endpoint accepts only a validated playlist id, never a URL.
- Modals go through `src/components/ui/Dialog.tsx` (native `<dialog>`: focus trap, Escape, focus return) and confirmations through `useConfirm`.
- Two pages, one bundle: `/` landing (`src/components/landing/`), `/app` planner; `src/Root.tsx` picks by path, `src/lib/routes.ts` has the paths and `/app?demo`. Links between them stay full page loads, never client-side routing: `loadPlannerOnce` caches storage per page load, so a remounted planner would show and save stale data. Never add `public/404.html`: Cloudflare Pages then drops the SPA fallback that serves `/app`.
- Dark theme only. Colors come from the role tokens in `src/index.css` (`paper` page, `card`/`sunk` surfaces, `ink*` text, `on-fill` on bright fills), never raw hex in components. The landing's product shots are the app's own components fed by `buildLandingPreview` (demo camp through the real engine), rendered `inert`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
