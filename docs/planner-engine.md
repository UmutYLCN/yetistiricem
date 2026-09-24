# Planner engine contract

Code: `src/utils/roadmapEngine.ts`, `src/utils/date.ts`, `src/utils/storage.ts`. Behaviour is pinned by `tests/*.test.ts` (`npm test`).

## Camps

A **study camp** (`StudyCamp`, `src/types/index.ts`) is one named program: its `branches` (each a `SubjectPlaylist`: one ordered video list, usually one YouTube playlist; `subject` is the branch name), its `schedule` (`CampSchedule` = the planner preferences plus `mode`, `targetEndDate`, `weekPlan`) and its own `shiftEvents`. Screens always show one camp: `buildCampSchedule(camp, { completedMap, today })`. Each camp's tempo is independent; editing one never touches another (`tests/campOps.test.ts`).

`buildSchedule(playlists, preferences, options)` is the underlying scheduler (and `generateRoadmap` its `DailyPlan[]` shorthand); `buildCampSchedule` passes the camp's branches, schedule, shift events and, in manual mode, `options.weekPlan`.

## Layout

- **Every** video is scheduled, completed or not. The layout depends only on branches, schedule and shift events. `completedMap` (keyed by `videoId`, shared by all camps) only sets `item.completed` / `plan.isAllCompleted`. Ticking a task never moves any task.
- Days run from `startDate`. Mock exam days (`mockExamDays`) win over everything and get `isMockExamDay`; rest and inactive weekdays get `isRestDay`. Neither kind gets videos, and there are no trailing empty days.
- Each study day holds at most `dailyStudyHours * 60` effective minutes (`duration / playbackSpeed * (1 + practiceMultiplier)`). Branch order (playlist order) is preserved.
- **Automatic mode** (`mode: 'auto'`, no `weekPlan` option): study days are `activeDays` minus rest/mock days. Each day is filled round-robin over all branches, rotating the starting branch each day, with at most `maxSubjectsPerDay` distinct `subject`s. So "3 per day" means three branches, not three videos; two branches with the same name count as one. This is exactly the pre-camp scheduler, so migrated plans keep their layout.
- **Manual mode** (`mode: 'manual'`, `weekPlan[dow]` = branch ids, index 0 = Sunday): the study weekdays are exactly the weekdays with a branch (mock days still win; `resolveRules` rewrites `activeDays`/`restDays`, and `result.preferences` reports them). A day only takes its own branches, round-robin in branch order, until the day is full; `maxSubjectsPerDay` is not used. Unknown ids are dropped (`sanitizeWeekPlan`).
  - A weekday whose branches have nothing left is a **free day**: `isFreeDay: true`, no items, not a rest day.
  - A branch on no study weekday is never dropped silently: its items come back in `unscheduledItems` and `issues` holds `{ kind: 'unassigned-branch', playlistId, unscheduledCount }`. The wizard and tempo dialog refuse to save such a week.
- **Oversized** videos (longer than one study day) get the next (eligible) study day to themselves as soon as they reach the front of their branch. `buildSchedule(...).issues` lists them as `{ kind: 'oversized-item', itemId, date, effectiveMinutes, capacityMinutes }`. `isOversizedItem(item, prefs)` checks one item.
- Invalid settings (0, negative, NaN, missing) fall back to defaults and are reported as `invalid-preference` issues. If no weekday is a study day, `plans` is `[]`, `unscheduledItems` holds everything, and the issues contain `no-study-days`. Nothing can loop: every 7-day window places at least one item.
- `item.id === videoId`, unless the same video appears twice in a camp. Later copies get `${playlistId}:${videoId}`. Completion stays shared through `videoId`.

## Target end date

`targetEndDate` never changes the layout: nothing is squeezed, skipped or overbooked to meet it.

- `planEndDate(plans)`: last day with a task.
- `assessDeadline({ finishDate, targetEndDate, unscheduledCount })` → `none` (no target), `incomplete` (some videos cannot be placed), `on-track` (`spareDays`) or `late` (`lateDays`), in whole calendar days.
- `dailyHoursForDeadline(camp, { today })`: the smallest half-hour daily time (up to 16 h) with which the plan ends by the target, or null when daily time alone cannot do it (e.g. too few manual weekdays). The result is verified by rescheduling.

## Dates

- Keys are local `YYYY-MM-DD`. Build them with `todayKey()` / `toDateKey(date)` and display them with `formatDateKey(key, opts)` / `weekdayName(key)`. When you need a `Date`, use `parseDateKey(key)` (local midnight). Never use `new Date(plan.date)`: it reads the key as UTC midnight and shows the previous day in negative offsets.
- `defaultPreferences.startDate` is a date key. Legacy stored ISO timestamps are converted to the local day by `normalizePreferences()` / `normalizeCampSchedule()` (and inside the engine).

## Shifting ("Tamamlanmayanları Kaydır")

Durable flow, per camp (see `handleShift` in `src/App.tsx`):

```ts
const { plans } = buildCampSchedule(camp, { completedMap, today });
const event = createShiftEvent(date, plans, today);   // null => nothing to shift
if (event) actions.addShiftEvent(camp.id, event);      // stored in camp.shiftEvents
```

- `ShiftEvent = { date, resumeDate, itemIds }`. It is created once, when the user clicks, and freezes which items were still incomplete on or before `date`.
- On replay, those items plus everything from `resumeDate` onwards are replanned from `resumeDate`, with the same capacity, branch, weekday-plan and rest-day rules. Every other item before `resumeDate` stays on its day, including completed items and today's tasks.
- `resumeDate = max(date, today) + 1`: shifting a past day leaves today's plan alone and restarts tomorrow.
- Events replay in stored order, so repeated shifts compose. Ticking or unticking any task afterwards moves nothing. No task is ever dropped. If no study day exists to move to, the event is a no-op.
- Branches added to a running camp would land partly on past days; the app carries only those new tasks forward with one stored event (`handleAddBranches`).
- The legacy `yt_shifted_date` is converted once, during migration, into an event of the migrated camp.

`shiftDayPlan(date, plans, preferences?, today?)` is the pure, non-persistent version (automatic mode only). It moves incomplete items on or before `date` to `date + 1` onwards and never mutates its input. Without `preferences` it assumes default rest days and a capacity of at least the busiest planned day. It reads current completion, so a derived-state shift re-run on every render **will** move tasks when they are ticked. Use the event flow for anything persisted.

A study day whose tasks were all carried stays in the list with `items: []`; render it as an empty or shifted day.

## Stats

`calculateStats(plans, totalVideos, countCompletedVideos(camp.branches, completedMap))`. Remaining minutes, days and finish date come from the plans' incomplete items. `countCompletedVideos` ignores completed ids of removed branches. The completed count is clamped to `[0, totalVideos]`.

## Storage

`src/lib/persistence.ts` owns loading, migration and backups (`yt_camps`, `yt_active_camp`, shared `yt_completed` / `yt_day_notes` / `yt_selected_date`). The older flat keys are read once to build the first camp and never written; see [`camp-creation-wizard-notes.md`](camp-creation-wizard-notes.md).
