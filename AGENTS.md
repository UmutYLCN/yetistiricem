# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Checks: `npm run build`, `npm run lint`, `npm test` (strict type-check of `tests/` via `tsconfig.test.json`, then `node --test` with type stripping; no test framework dependency).
- Dates are local `YYYY-MM-DD` keys; use `src/utils/date.ts`. Never `new Date('YYYY-MM-DD')` or `toISOString().split('T')[0]`: both shift the day outside UTC.
- The schedule must not depend on completion: ticking a task only decorates `item.completed`. Shifts are stored events. See `docs/planner-engine.md` for the engine and UI contract.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
