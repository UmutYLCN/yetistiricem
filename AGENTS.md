# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Checks: `npm run build`, `npm run lint`, `npm test` (strict type-check of `tests/` via `tsconfig.test.json`, then `node --test` with type stripping; no test framework dependency).
- Dates are local `YYYY-MM-DD` keys; use `src/utils/date.ts`. Never `new Date('YYYY-MM-DD')` or `toISOString().split('T')[0]`: both shift the day outside UTC.
- The schedule must not depend on completion: ticking a task only decorates `item.completed`. Shifts are stored events. See `docs/planner-engine.md` for the engine and UI contract.
- UI code reaches the engine, storage and date helpers only through `src/lib/engine.ts`. Loading, legacy migration and backups live in `src/lib/persistence.ts`: keep the existing `yt_*` keys, and never drop stored data silently (copy it aside and show a notice).
- Data truth: the app has no YouTube API, so it must never invent videos, links, durations or channel names. Demo templates (`src/data/demoTemplates.ts`) are labelled and link-free; old fabricated camps are detected in `src/lib/camps.ts`.
- Modals go through `src/components/ui/Dialog.tsx` (native `<dialog>`: focus trap, Escape, focus return) and confirmations through `useConfirm`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
