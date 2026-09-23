# Planner engine contract

Code: `src/utils/roadmapEngine.ts`, `src/utils/date.ts`, `src/utils/storage.ts`. Behaviour is pinned by `tests/*.test.ts` (`npm test`).

## Layout

`generateRoadmap(playlists, preferences, completedMap, shiftEvents)` returns `DailyPlan[]` (see `buildSchedule` for the same plus diagnostics).

- **Every** video is scheduled, completed or not. The layout depends only on playlists, preferences and shift events. `completedMap` (keyed by `videoId`, same as before) only sets `item.completed` / `plan.isAllCompleted`. Ticking a task never moves any task.
- Days run from `preferences.startDate`. A day is a study day when its weekday is in `activeDays` and not in `restDays` or `mockExamDays`. Mock exam days have `isMockExamDay`. Rest days and inactive weekdays have `isRestDay`. Neither kind gets videos, and there are no trailing empty days.
- Each study day holds at most `dailyStudyHours * 60` effective minutes (`duration / playbackSpeed * (1 + practiceMultiplier)`) and at most `maxSubjectsPerDay` distinct `subject`s. Playlists are filled round-robin, rotating the starting playlist each day so every subject keeps moving. Playlist order is preserved.
- **Oversized** videos (longer than one study day) get the next study day to themselves as soon as they reach the front of their playlist. `buildSchedule(...).issues` lists them as `{ kind: 'oversized-item', itemId, date, effectiveMinutes, capacityMinutes }`. `isOversizedItem(item, prefs)` checks one item.
- Invalid settings (0, negative, NaN, missing) fall back to defaults and are reported as `invalid-preference` issues. If no weekday is a study day, `plans` is `[]`, `unscheduledItems` holds everything, and the issues contain `no-study-days`. Nothing can loop.
- `item.id === videoId`, unless the same video appears twice. Later copies get `${playlistId}:${videoId}`. Completion stays shared through `videoId`.

## Dates

- Keys are local `YYYY-MM-DD`. Build them with `todayKey()` / `toDateKey(date)` and display them with `formatDateKey(key, opts)` / `weekdayName(key)`. When you need a `Date`, use `parseDateKey(key)` (local midnight). Never use `new Date(plan.date)`: it reads the key as UTC midnight and shows the previous day in negative offsets.
- `defaultPreferences.startDate` is now a date key. Legacy stored ISO timestamps are converted to the local day by `loadPreferences()` / `normalizePreferences()` (and inside the engine).

## Shifting ("Tamamlanmayanları Kaydır")

Durable flow (recommended):

```ts
const [shiftEvents, setShiftEvents] = useState(loadShiftEvents);      // key yt_shift_events
useEffect(() => saveShiftEvents(shiftEvents), [shiftEvents]);
const plans = useMemo(() => generateRoadmap(playlists, prefs, completedMap, shiftEvents), [...]);
const handleShift = (date: string) => {
  const event = createShiftEvent(date, plans);   // null => nothing to shift
  if (event) setShiftEvents(prev => [...prev, event]);
};
```

- `ShiftEvent = { date, resumeDate, itemIds }`. It is created once, when the user clicks, and freezes which items were still incomplete on or before `date`.
- On replay, those items plus everything from `resumeDate` onwards are replanned from `resumeDate`, with the same capacity, subject and rest-day rules. Every other item before `resumeDate` stays on its day, including completed items and today's tasks.
- `resumeDate = max(date, today) + 1`: shifting a past day leaves today's plan alone and restarts tomorrow.
- Events replay in stored order, so repeated shifts compose. Ticking or unticking any task afterwards moves nothing. No task is ever dropped. If no study day exists to move to, the event is a no-op.
- The legacy `yt_shifted_date` flow can be migrated once: `createShiftEvent(legacyDate, generateRoadmap(playlists, prefs, completedMap), legacyDate)`.

`shiftDayPlan(date, plans, preferences?, today?)` is the pure, non-persistent version. It moves incomplete items on or before `date` to `date + 1` onwards and never mutates its input. Without `preferences` it assumes default rest days and a capacity of at least the busiest planned day. It reads current completion, so a derived-state shift re-run on every render **will** move tasks when they are ticked. Use the event flow for anything persisted.

A study day whose tasks were all carried stays in the list with `items: []`; render it as an empty or shifted day.

## Stats

`calculateStats(plans, totalVideos, countCompletedVideos(playlists, completedMap))`. Remaining minutes, days and finish date come from the plans' incomplete items. `countCompletedVideos` ignores completed ids of removed playlists. The completed count is clamped to `[0, totalVideos]`.
