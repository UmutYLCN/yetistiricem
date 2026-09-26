# Planner engine contract

Code: `src/utils/roadmapEngine.ts`, `src/utils/date.ts`, `src/utils/storage.ts`. Behaviour is pinned by `tests/*.test.ts` (`npm test`).

## Camps

A **study camp** (`StudyCamp`, `src/types/index.ts`) is one named program: its `branches` (each a `SubjectPlaylist`: one ordered video list, usually one YouTube playlist; `subject` is the branch name), its `schedule` (`CampSchedule` = the planner preferences plus `mode`, `targetEndDate`, `weekPlan`) and its own `shiftEvents`. A camp is always scheduled alone: `buildCampSchedule(camp, { completedMap, today })`. Each camp's tempo is independent; editing one never touches another (`tests/campOps.test.ts`).

### Tüm Kamplar (`src/lib/allCamps.ts`, `tests/allCamps.test.ts`)

The plan screens show one camp, or every camp with at least one video merged into one date-ordered flow. `buildAllCampsPlan` builds each camp with its own schedule, then `mergeDailyPlans` joins the finished days by date: nothing is rescheduled, so capacities, rhythms, start/target dates and shift histories stay per camp. Merged items carry their `campId`; a merged day lists only the camps whose plan covers it (`camps`, each with its own day). It is a study day when any camp studies (a free or shifted study day counts), otherwise a mock exam day if any camp has one, else a rest day; only then (`everyCampOff`) do the screens show a full empty-day state, and otherwise they name each camp's own day type. Shifting in this view (`shiftEventsByCamp`) makes one event per camp from that camp's own plan, stored on that camp only.

The scope is a view choice (`yt_camp_scope`: `all` | `camp`), never a camp id: `resolveCampScope` shows all camps from two camps on unless the user picked one, and falls back to the one camp below two. The open camp (`yt_active_camp`) stays a real camp for Kamplar, tempo, add-branch and edit dialogs; dialogs opened from a task use the task's own camp.

`buildSchedule(playlists, preferences, options)` is the underlying scheduler (and `generateRoadmap` its `DailyPlan[]` shorthand); `buildCampSchedule` passes the camp's branches, schedule, shift events and, in manual mode, `options.weekPlan`.

## Layout

- **Every** video is scheduled, completed or not. The layout depends only on branches, schedule and shift events. `completedMap` (keyed by `videoId`, shared by all camps) only sets `item.completed` / `plan.isAllCompleted`. Ticking a task never moves any task.
- Days run from `startDate`. Mock exam days (`mockExamDays`) win over everything and get `isMockExamDay`; rest and inactive weekdays get `isRestDay`. Neither kind gets videos, and there are no trailing empty days.
- Each study day holds at most `dailyStudyHours * 60` effective minutes (`duration / playbackSpeed * (1 + practiceMultiplier)`). Branch order (playlist order) is preserved.
- **Automatic mode** (`mode: 'auto'`, no `weekPlan` option): study days are `activeDays` minus rest/mock days. Each day is filled round-robin over all branches, rotating the starting branch each day, with at most `maxSubjectsPerDay` distinct `subject`s. So "3 per day" means three branches, not three videos; two branches with the same name count as one. This is exactly the pre-camp scheduler, so migrated plans keep their layout.
- **Manual mode** (`mode: 'manual'`, `weekPlan[dow]` = branch ids, index 0 = Sunday): the study weekdays are exactly the weekdays with a branch (mock days still win; `resolveRules` rewrites `activeDays`/`restDays`, and `result.preferences` reports them). A day only takes its own branches, round-robin in branch order, until the day is full; `maxSubjectsPerDay` is not used. Unknown ids are dropped (`sanitizeWeekPlan`).
  - A weekday whose branches have nothing left is a **free day**: `isFreeDay: true`, no items, not a rest day.
  - A branch on no study weekday is never dropped silently: its items come back in `unscheduledItems` and `issues` holds `{ kind: 'unassigned-branch', playlistId, unscheduledCount }`. The wizard and tempo dialog refuse to save such a week.
- A day's `items` keep this round-robin order, and the weekly canvas shows it as is. The day list (`DayPanel`) shows each branch's tasks together through `groupByBranch` (`src/lib/planView.ts`): display only, branches in order of their first task.
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

- `ShiftEvent = { date, resumeDate, itemIds, reason?, note?, origin? }`. It is created once, when the user clicks, and freezes which items were still incomplete on or before `date`. The click opens `PostponeReasonDialog`: the event is stored only once the student picks a `reason` (`distraction` | `difficult` | `exhausted` | `emergency` | `low_motivation`, with an optional `note`) or skips the question; the dialog then shows that reason's micro intervention (`src/lib/postpone.ts`). Older events have no reason (shown as "Belirtilmedi").
- On replay, those items plus everything from `resumeDate` onwards are replanned from `resumeDate`, with the same capacity, branch, weekday-plan and rest-day rules. Every other item before `resumeDate` stays on its day, including completed items and today's tasks.
- `resumeDate = max(date, today) + 1`: shifting a past day leaves today's plan alone and restarts tomorrow.
- Events replay in stored order, so repeated shifts compose. Ticking or unticking any task afterwards moves nothing. No task is ever dropped. If no study day exists to move to, the event is a no-op.
- Branches added to a running camp would land partly on past days; `withAddedBranches` (`src/lib/plannerOps.ts`) carries those new tasks, plus the new ones on today, to tomorrow with one stored event, so each new branch starts in order. That event has `origin: 'branch-added'`: it is not a postponement.
- Each item carries `postponeCount` (missing = 0): how many of the user's own events (not `branch-added`) name it. It is derived on every build (`postponeCounts`), never stored, so undoing a shift lowers it. From 3 on, the task is flagged "Kritik" (`isCriticallyPostponed`).
- The legacy `yt_shifted_date` is converted once, during migration, into an event of the migrated camp.

`shiftDayPlan(date, plans, preferences?, today?)` is the pure, non-persistent version (automatic mode only). It moves incomplete items on or before `date` to `date + 1` onwards and never mutates its input. Without `preferences` it assumes default rest days and a capacity of at least the busiest planned day. It reads current completion, so a derived-state shift re-run on every render **will** move tasks when they are ticked. Use the event flow for anything persisted.

A study day whose tasks were all carried stays in the list with `items: []`; render it as an empty or shifted day.

## Stats

`calculateStats(plans, totalVideos, countCompletedVideos(camp.branches, completedMap))`. Remaining minutes, days and finish date come from the plans' incomplete items. `countCompletedVideos` ignores completed ids of removed branches. The completed count is clamped to `[0, totalVideos]`.

## Progress insights (`src/lib/insights.ts`, `tests/insights.test.ts`)

Read-only, over the camps a screen shows (`progressInsights`). Ticking a task records the day (`setCompleted(data, videoId, done, today)` → `completionDates.dates[videoId]`); ticks from before `completionDates.since` have no day and are never placed on a guessed one.

- **Heatmap**: the last 13 weeks, a level per day from its ticked videos' minutes relative to the busiest day.
- **Streak**: consecutive days with a tick. A study day (some camp's plan is not rest, mock or free) without a tick breaks it; other days neither break nor extend it, and today only counts once ticked.
- **Commitment score**: `(done on or before the planned day, never postponed) / (tasks due) * 100`. A task is due once its day passed, it was done, or it was postponed; today's open tasks are not measured. Only tasks first due from `max(completionDates.since, camp.createdAt)` on are measured.
- **Postponements**: reason shares per user shift event and carried task counts per branch (`subject`), with the branch that stands out (≥ 3 and ≥ 1.5× the other branches' average).

## Focus mode (`src/components/focus/FocusModal.tsx`, `src/lib/focus.ts`, `tests/focus.test.ts`)

"Odaklan" plays a task's video full screen with the YouTube IFrame Player API (`src/lib/youtubePlayer.ts`, loaded on demand, `youtube-nocookie.com`), only for tasks with a real video link (`focusableVideoId`). The player starts at the camp's `playbackSpeed` when YouTube offers it. Pausing and the end of the video cover YouTube's suggestions with the app's own panel. When the video ends (or on "İzledim") the task is ticked, confetti falls on a canvas inside the dialog, and "Sıradaki göreve geç" opens the next open playable task of the same day (`nextFocusItem`; other days are never pulled ahead). Embedding refusals (errors 101/150), missing videos and a blocked API script show a fallback with "YouTube’da aç". Each closed player adds one `FocusSession` (`{ videoId: Video.id, date, watchedSeconds, pauses, rate, ended }`) to `yt_focus_sessions`. YouTube may still show its own ads inside the embed.

## Storage

`src/lib/persistence.ts` owns loading, migration and backups (`yt_camps`, `yt_active_camp`, shared `yt_completed` / `yt_completed_on` / `yt_focus_sessions` / `yt_day_notes` / `yt_selected_date`, and the view choice `yt_camp_scope`, which backups leave out). `yt_completed_on` (`{ version, since, dates }`) is written with `since` = today on the first load that lacks it; backups without it restore with `since` = the restore day. The older flat keys are read once to build the first camp and never written; see [`camp-creation-wizard-notes.md`](camp-creation-wizard-notes.md).
