# Planner engine contract

Code: `src/utils/roadmapEngine.ts`, `src/utils/date.ts`, `src/utils/storage.ts`. Behaviour is pinned by `tests/*.test.ts` (`npm test`).

## Camps

A **study camp** (`StudyCamp`, `src/types/index.ts`) is one named program: its `branches` (each a `SubjectPlaylist`: one ordered video list, usually one YouTube playlist; `subject` is the branch name), its `schedule` (`CampSchedule` = the planner preferences plus `mode`, `targetEndDate`, `weekPlan`) and its own `shiftEvents`. A camp is always scheduled alone: `buildCampSchedule(camp, { completedMap, today })`. Each camp's tempo is independent; editing one never touches another (`tests/campOps.test.ts`).

### Tüm Kamplar (`src/lib/allCamps.ts`, `tests/allCamps.test.ts`)

The plan screens show one camp, or every camp with at least one video merged into one date-ordered flow. `buildAllCampsPlan` builds each camp with its own schedule, then `mergeDailyPlans` joins the finished days by date: nothing is rescheduled, so capacities, rhythms, start/target dates and shift histories stay per camp. Merged items carry their `campId`; a merged day lists only the camps whose plan covers it (`camps`, each with its own day). It is a study day when any camp studies (a free or shifted study day counts), otherwise a mock exam day if any camp has one, else a rest day; only then (`everyCampOff`) do the screens show a full empty-day state, and otherwise they name each camp's own day type. Shifting in this view (`shiftEventsByCamp`) makes one event per camp from that camp's own plan, stored on that camp only.

From two camps on the plan screens always combine them (`combinesCamps`); there is no stored scope (`yt_camp_scope` is retired, only cleared by a reset). Only running camps take part: a paused camp (`pausedAt`, from Kamplar) keeps everything but `runningCamps` / `campsWithPlans` leave it out of the plan screens and the MCP plan. Resuming (`withResumed` in `src/lib/plannerOps.ts`) removes `pausedAt` and stores one event (`date` = yesterday, `resumeDate` = today, `origin: 'resumed'`) carrying every task still open on a past day, so the route is laid out again from today in order; like the other app-made events it is not a postponement. The open camp (`yt_active_camp`) stays a real camp for Kamplar, tempo, add-branch and edit dialogs; dialogs opened from a task use the task's own camp.

`buildSchedule(playlists, preferences, options)` is the underlying scheduler (and `generateRoadmap` its `DailyPlan[]` shorthand); `buildCampSchedule` passes the camp's branches, schedule, shift events and, in manual mode, `options.weekPlan`.

## Layout

- **Every** video is scheduled, completed or not. The layout depends on branches, schedule, shift events and the day each task was ticked (`options.completionDays`, see [Early finishes](#early-finishes)). `completedMap` (keyed by `videoId`, shared by all camps) sets `item.completed` / `plan.isAllCompleted`; apart from a task done ahead of its day, ticking moves nothing.
- Days run from `startDate`. Mock exam days (`mockExamDays`) win over everything and get `isMockExamDay`; rest and inactive weekdays get `isRestDay`. Neither kind gets videos, and there are no trailing empty days.
- Each study day holds at most `dailyStudyHours * 60` effective minutes (`duration / playbackSpeed * (1 + practiceMultiplier)`). Branch order (playlist order) is preserved.
- **Automatic mode** (`mode: 'auto'`, no `weekPlan` option): study days are `activeDays` minus rest/mock days. Each day is filled round-robin over all branches, rotating the starting branch each day, with at most `maxSubjectsPerDay` distinct `subject`s. So "3 per day" means three branches, not three videos; two branches with the same name count as one. This is exactly the pre-camp scheduler, so migrated plans keep their layout.
- **Manual mode** (`mode: 'manual'`, `weekPlan[dow]` = branch ids, index 0 = Sunday): the study weekdays are exactly the weekdays with a branch (mock days still win; `resolveRules` rewrites `activeDays`/`restDays`, and `result.preferences` reports them). A day only takes its own branches, round-robin in branch order, until the day is full; `maxSubjectsPerDay` is not used. Unknown ids are dropped (`sanitizeWeekPlan`).
  - A weekday whose branches have nothing left is a **free day**: `isFreeDay: true`, no items, not a rest day.
  - A branch on no study weekday is never dropped silently: its items come back in `unscheduledItems` and `issues` holds `{ kind: 'unassigned-branch', playlistId, unscheduledCount }`. The wizard and tempo dialog refuse to save such a week.
- A day's `items` keep this round-robin order, and the weekly canvas shows it as is. The day list (`DayPanel`) shows each branch's tasks together through `groupByBranch` (`src/lib/planView.ts`): display only, branches in order of their first task.
- **Oversized** videos (longer than one study day) get the next (eligible) study day to themselves as soon as they reach the front of their branch. The study day after such a day goes to the other branches that have open work (eligible that day, in manual mode) before another oversized video is placed, so long videos alternate with them instead of starving them (math 5×150 min next to physics and chemistry: math day, physics/chemistry day, math day…). With no other branch to serve, oversized videos still take consecutive days; rest days in between do not reset the rule. It applies from `today` on only; days before today keep the layout they had (`tests/longVideoRotation.test.ts`). `buildSchedule(...).issues` lists them as `{ kind: 'oversized-item', itemId, date, effectiveMinutes, capacityMinutes }`. `isOversizedItem(item, prefs)` checks one item.
- Invalid settings (0, negative, NaN, missing) fall back to defaults and are reported as `invalid-preference` issues. If no weekday is a study day, `plans` is `[]`, `unscheduledItems` holds everything, and the issues contain `no-study-days`. Nothing can loop: every 7-day window places at least one item.
- `item.id === videoId`, unless the same video appears twice in a camp. Later copies get `${playlistId}:${videoId}`. Completion stays shared through `videoId`.

## Tempo changes

"Tempoyu düzenle" saves through `withTempo(camp, schedule, today)` (`src/lib/plannerOps.ts`, `tests/tempoChange.test.ts`).

- A camp that has not started (`startDate >= today`) takes the new tempo for its whole plan, as before.
- A started camp keeps the tempo it replaces in `camp.tempoHistory` (`PastTempo = { until: today, schedule }`, oldest first): that tempo laid out the days before `until`, and `camp.schedule` lays out the days from the last `until` on. Changing it again the same day replaces only the current tempo; a change of dates alone (start, target) records nothing.
- `buildCampSchedule` packs each day with the rules in force on it (`rulesOn`): capacity, study/rest/mock weekdays, branches per day, manual weekdays, and the speed and practice share that weigh the day's items. Shift events replay with the same per-day rules, including tasks a red card pinned to its `resumeDate` (`keepOnResume`), which count against that day's capacity under the tempo in force on it. Packing only looks forward, so the days before the change are laid out exactly as before it: a plan on track up to today has nothing overdue afterwards, and each branch keeps its lesson order.
- Camps without `tempoHistory` (every camp saved before it existed) lay out exactly as before; `tests/fixtures/layout-before-tempo-history.json` pins that. The history is stored only after a later tempo change; nothing is migrated.
- What the current tempo cannot place (a manual branch on none of its weekdays, no study weekday) is unscheduled as before; an earlier tempo may still have placed some of that branch's tasks on its own days.

## Early finishes

A task ticked before its planned day counts on the day it was done, and stops holding its later day (`applyFinishOps` in `src/utils/roadmapEngine.ts`, `tests/earlyFinish.test.ts`).

- Input: `buildCampSchedule(camp, { completedMap, completionDays, today })` with `completionDays` = `yt_completed_on` (`CompletionDates`). Every screen, plan op (`withResumed`, `withAddedBranches`, `withAppendedVideos`), preview and the MCP plan pass it; without it the layout is as if no task was done ahead.
- A tick on day `c` of a task planned for a later day `D` moves the task to `c` (or the plan's first day, if the camp starts later) as a done item, and every task from `D` on is laid out again from `D`, each branch in lesson order, with the long-video rotation carried across `D` (if the last study day before it went to one oversized video, the other branches go first). The open tasks move up into the freed time and the finish date can come earlier. Days between `c` and `D` and every day before `c` keep their layout. Ticking a task on or after its own day moves nothing.
- Replay: the ticks of each day run in date order between the stored shift events. An event made on day `d` resumes on `d` or `d + 1`, so a day's ticks run before the first event resuming after it. Each step only re-lays days from the day it happened on and none reads `today`, so a day once past never changes again.
- Only ticks recorded from `completionDates.aheadSince` on count. That is the first day a version with early finishes loaded the data (written then, like `since`); ticks before it keep their old place, so stored plans load unchanged. New data starts with `aheadSince = since`.
- Unticking the same day removes the tick: the plan is as before it. Unticking a counted tick on a later day keeps `[ticked, unticked]` in `completionDates.reopened[videoId]`; on replay the task leaves the day it was done on and rejoins the open plan from the untick day, in lesson order. A task ticked on or after its own day stays on its day when unticked (overdue if that day passed).
- Shift events whose `resumeDate` is after `aheadSince` re-lay each branch in lesson order too, so a task taken back after later lessons were pulled ahead is carried before them. Older events replay exactly as before.

## Target end date

`targetEndDate` never changes the layout: nothing is squeezed, skipped or overbooked to meet it.

- `planEndDate(plans)`: last day with a task.
- `assessDeadline({ finishDate, targetEndDate, unscheduledCount })` → `none` (no target), `incomplete` (some videos cannot be placed), `on-track` (`spareDays`) or `late` (`lateDays`), in whole calendar days.
- `dailyHoursForDeadline(camp, { today, withHours, completedMap, completionDays })`: the smallest half-hour daily time (up to 16 h) with which the plan ends by the target, or null when daily time alone cannot do it (e.g. too few manual weekdays). The result is verified by rescheduling. By default a time replaces the whole tempo, which only fits a camp not created yet (the wizard preview); `hoursToMeetTarget` (`src/lib/deadlineOverrun.ts`) applies each time through `withTempo`, so a started camp only gains capacity from today on (the add-branch preview and the prompt below). Both, and `deadlineOverrun`, take the plan screens' `completedMap` and `completionDays`, so tasks done ahead free their days in the projected finish and the suggested time too.
- **Deadline-overrun prompt** (`deadlineOverrun`, `DeadlineOverrunDialog`, `tests/deadlineOverrun.test.ts`): once a postponement is stored (after the reason dialog and its tip close), each shifted camp whose plan now ends after its target is asked about, one by one: the target, the new finish and the daily time that makes it. "Günlük süreyi X saate çıkar" saves that time with `setCampSchedule` (from today), "Hedef tarihi ertele" saves a new target (prefilled with the finish), "Böyle kalsın" changes nothing; undoing the postponement still removes its event. The suggestion never exceeds the student's ceiling (`yt_daily_limit`, `src/lib/dailyLimit.ts`, default 8 h, in Tercihler); when even the ceiling (or a passed target) cannot make it, no time is offered. Above 1.5× the current daily time it is flagged "Bu çok yoğun olabilir".

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

- `ShiftEvent = { date, resumeDate, itemIds, keepOnResume?, reason?, note?, origin? }`. It is created once, when the user clicks, and freezes which items were still incomplete on or before its `date`. The click opens `PostponeReasonDialog`: the event is stored only once the student picks a `reason` (`distraction` | `difficult` | `exhausted` | `emergency` | `low_motivation`, with an optional `note`) or skips the question; the dialog then shows that reason's micro intervention (`src/lib/postpone.ts`). Older events have no reason (shown as "Belirtilmedi").
- On replay, those items plus everything from `resumeDate` onwards are replanned from `resumeDate`, with the same capacity, branch, weekday-plan and rest-day rules. Every other item before `resumeDate` stays on its day, including completed items.
- Shifting a past day (the red overdue card, the past-day callout, the progress callout; `handleShift(yesterday)`) carries every task still open on any day before today, stores `date` = yesterday and `resumeDate` = today, and re-lays the plan from today: today's tasks follow the carried ones, so each branch keeps its lesson order and today's free time is used. Tasks already ticked today stay on today and count against its capacity, so the carried ones only fill what is left: `createShiftEvent` freezes their ids in `keepOnResume` (a ticked task is left out when its branch has a carried lesson, which it would overtake; it is then re-laid in branch order), and replay pins them to `resumeDate` first, so later ticking or unticking does not move them. Shifting today ("Kalanları yarına kaydır") carries the open tasks up to today and restarts tomorrow (`resumeDate = date + 1`).
- Replay reads only the stored `date`/`resumeDate`/`itemIds`/`keepOnResume`, so events made before these rules (`resumeDate` = the day after the click, today left alone; or no `keepOnResume`) replay exactly as they were made.
- Moving a camp's `startDate` ("Tempoyu düzenle", after a confirmation) re-lays the plan from the new date: `withTempo` discards that camp's shift events (all origins) and its `tempoHistory`, so the new start uses only the tempo saved with it; ticks in `yt_completed_on`/`completedMap` stay. An unchanged start date keeps them. Safety net: replay skips any event whose `resumeDate` is before `startDate`, so no task is ever placed before the start.
- Events replay in stored order, so repeated shifts compose. Ticking or unticking afterwards only moves tasks done ahead (see [Early finishes](#early-finishes)). No task is ever dropped. If no study day exists to move to, the event is a no-op.
- Branches added to a running camp would land partly on past days; `withAddedBranches` (`src/lib/plannerOps.ts`) carries those new tasks, plus the new ones on today, to tomorrow with one stored event, so each new branch starts in order. That event has `origin: 'branch-added'`: it is not a postponement. `withAppendedVideos` does the same for new playlist videos appended to a branch (`origin: 'videos-added'`).
- Each item carries `postponeCount` (missing = 0): how many of the user's own events (no `origin`) name it. It is derived on every build (`postponeCounts`), never stored, so undoing a shift lowers it. From 3 on, the task is flagged "Kritik" (`isCriticallyPostponed`).
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

## Playlist sync (`src/lib/playlistSync.ts`, `src/hooks/usePlaylistSync.ts`, `tests/playlistSync.test.ts`)

On the first open of a day (never in the demo) the app reads, one after the other and a moment after load, the YouTube playlist of every branch the student built from one (`syncTargets`: own branches with a readable `playlistUrl`), through the existing playlist endpoint. At most one check a day (`lastAttempt`) spares the API quota; a playlist that fails is retried the next day, and quota, key or service failures stop the day's check. Each branch remembers the video ids its playlist held (`seen`): later checks offer only importable videos not seen before, so videos left out on import or removed later never return. The first check has no record of the import, so it offers only videos after the branch's last video in playlist order. Offers wait in the bell (`NotificationBell`, a `Dialog` hanging from the bell) until "Planımın sonuna ekle" (`acceptPlaylistVideos`: appended in order, the plan relaid) or "Göz ardı et" (`dismissPlaylistVideos`); nothing is added without that click. A new playlist link, or removing the branch or camp, drops the branch's record.

## Storage

`src/lib/persistence.ts` owns loading, migration and backups (`yt_camps`, `yt_active_camp`, shared `yt_completed` / `yt_completed_on` (`{ version, since, dates, aheadSince, reopened? }`) / `yt_focus_sessions` / `yt_playlist_sync` / `yt_day_notes` / `yt_selected_date`, and the view choice `yt_camp_scope`, which backups leave out). `yt_completed_on` is written with `since` = today on the first load that lacks it, and `aheadSince` = today on the first load that lacks that; backups without them restore with the restore day. The older flat keys are read once to build the first camp and never written; see [`camp-creation-wizard-notes.md`](camp-creation-wizard-notes.md).
