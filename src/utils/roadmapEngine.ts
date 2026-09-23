import type { DailyPlan, DailyPlanItem, RoadmapStats, SubjectPlaylist, UserPreferences, Video } from '../types';
import { addDays, dayOfWeek, maxDateKey, todayKey, weekdayName } from './date.ts';
import { defaultPreferences, inspectPreferences, normalizeShiftEvents } from './storage.ts';

// Scheduling contract
// - Every video of every playlist is scheduled, completed or not. The layout
//   depends only on playlists, preferences and shift events; completion only
//   sets `item.completed`, so ticking a task never moves any task.
// - A shift is a durable event recorded once, when the user asks for it (see
//   `createShiftEvent`). Replaying the stored events keeps later completion
//   toggles from moving anything.
// - Dates are local `YYYY-MM-DD` keys (see ./date.ts).

/** Durable record of one "shift incomplete tasks" action. */
export interface ShiftEvent {
  /** Items still incomplete on or before this day were carried forward. */
  date: string;
  /** First day the carried items (and everything after) were replanned onto. */
  resumeDate: string;
  /** `DailyPlanItem.id`s carried forward, frozen when the shift was made. */
  itemIds: string[];
}

export type ScheduleIssue =
  | { kind: 'invalid-preference'; field: keyof UserPreferences }
  | { kind: 'no-study-days'; unscheduledCount: number }
  | { kind: 'oversized-item'; itemId: string; date: string; effectiveMinutes: number; capacityMinutes: number };

export interface ScheduleOptions {
  completedMap?: Record<string, boolean>;
  shiftEvents?: readonly ShiftEvent[];
  /** Local day used for `isToday`/`isPast`; defaults to the real today. */
  today?: string;
}

export interface ScheduleResult {
  plans: DailyPlan[];
  /** Preferences after validation; these are what the schedule used. */
  preferences: UserPreferences;
  capacityMinutes: number;
  /** Items that could not be placed because no weekday is a study day. */
  unscheduledItems: DailyPlanItem[];
  issues: ScheduleIssue[];
}

type DayKind = 'study' | 'rest' | 'mock';

const EPSILON = 1e-9;

export function getEffectiveMinutes(durationMinutes: number, pref: UserPreferences): number {
  const minutes = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 0;
  return (minutes / pref.playbackSpeed) * (1 + pref.practiceMultiplier);
}

export function getDailyCapacityMinutes(pref: UserPreferences): number {
  return pref.dailyStudyHours * 60;
}

/** An item longer than a whole study day; the scheduler gives it a day of its own. */
export function isOversizedItem(item: DailyPlanItem, pref: UserPreferences): boolean {
  return item.effectiveMinutes > getDailyCapacityMinutes(pref) + EPSILON;
}

/**
 * Mock exam days win over rest days. A day outside `activeDays` counts as a
 * rest day. Only the remaining days receive videos.
 */
function dayKindOf(date: string, pref: UserPreferences): DayKind {
  const dow = dayOfWeek(date);
  if (pref.mockExamDays.includes(dow)) return 'mock';
  if (pref.restDays.includes(dow) || !pref.activeDays.includes(dow)) return 'rest';
  return 'study';
}

export function isStudyDay(date: string, pref: UserPreferences): boolean {
  return dayKindOf(date, pref) === 'study';
}

function hasStudyWeekday(pref: UserPreferences): boolean {
  return pref.activeDays.some(d => !pref.restDays.includes(d) && !pref.mockExamDays.includes(d));
}

function makeDay(date: string, kind: DayKind, items: DailyPlanItem[], today: string): DailyPlan {
  return {
    date,
    dayName: weekdayName(date),
    isToday: date === today,
    isPast: date < today,
    isRestDay: kind === 'rest',
    isMockExamDay: kind === 'mock',
    items,
    totalMinutes: items.reduce((acc, item) => acc + item.effectiveMinutes, 0),
    isAllCompleted: items.length > 0 && items.every(item => item.completed),
  };
}

function kindOfPlan(plan: DailyPlan): DayKind {
  if (plan.isMockExamDay) return 'mock';
  if (plan.isRestDay) return 'rest';
  return 'study';
}

/** One item per video in playlist order. Ids stay `videoId` unless a video repeats. */
function buildItems(playlists: SubjectPlaylist[], pref: UserPreferences): DailyPlanItem[] {
  const usedIds = new Set<string>();
  const items: DailyPlanItem[] = [];
  for (const pl of playlists) {
    const videos: Video[] = Array.isArray(pl.videos) ? pl.videos : [];
    for (const v of videos) {
      let id = v.id;
      if (usedIds.has(id)) {
        id = `${pl.id}:${v.id}`;
        for (let n = 2; usedIds.has(id); n++) id = `${pl.id}:${v.id}#${n}`;
      }
      usedIds.add(id);
      items.push({
        id,
        videoId: v.id,
        playlistId: pl.id,
        subject: pl.subject,
        title: v.title,
        durationMinutes: v.durationMinutes,
        effectiveMinutes: getEffectiveMinutes(v.durationMinutes, pref),
        completed: false,
        videoUrl: v.videoUrl,
      });
    }
  }
  return items;
}

interface PackResult {
  plans: DailyPlan[];
  unscheduled: DailyPlanItem[];
}

/**
 * Lays `items` out on days from `startDate`. Items keep their order within a
 * playlist. Each study day is filled by round-robin passes over the playlists,
 * starting after the playlist that got the last item the day before, so every
 * subject keeps moving even under `maxSubjectsPerDay`. A playlist whose next
 * item is longer than a whole day gets the next study day to itself. Every
 * study day places at least one item, so this always finishes. Completion is
 * ignored here on purpose.
 */
function packItems(items: DailyPlanItem[], startDate: string, pref: UserPreferences, today: string): PackResult {
  const plans: DailyPlan[] = [];
  if (items.length === 0) return { plans, unscheduled: [] };
  if (!hasStudyWeekday(pref)) return { plans, unscheduled: [...items] };

  const queues: { subject: string; items: DailyPlanItem[]; pos: number }[] = [];
  const queueByPlaylist = new Map<string, (typeof queues)[number]>();
  for (const item of items) {
    let queue = queueByPlaylist.get(item.playlistId);
    if (!queue) {
      queue = { subject: item.subject, items: [], pos: 0 };
      queueByPlaylist.set(item.playlistId, queue);
      queues.push(queue);
    }
    queue.items.push({ ...item });
  }

  const capacity = getDailyCapacityMinutes(pref);
  const maxSubjects = pref.maxSubjectsPerDay;
  let remaining = items.length;
  let start = 0;
  let date = startDate;
  // Each 7-day window has a study day and each study day places an item, so
  // this bound is never reached; it only guards against a future regression.
  const maxDays = items.length * 7 + 7;

  for (let dayIndex = 0; remaining > 0 && dayIndex < maxDays; dayIndex++, date = addDays(date, 1)) {
    const kind = dayKindOf(date, pref);
    if (kind !== 'study') {
      plans.push(makeDay(date, kind, [], today));
      continue;
    }

    const order = queues.map((_, i) => (start + i) % queues.length);
    const dayItems: DailyPlanItem[] = [];
    const subjects = new Set<string>();
    let used = 0;
    let lastQueue = start;

    const oversizedQueue = order.find(qi => {
      const q = queues[qi];
      return q.pos < q.items.length && q.items[q.pos].effectiveMinutes > capacity + EPSILON;
    });

    if (oversizedQueue !== undefined) {
      const q = queues[oversizedQueue];
      dayItems.push(q.items[q.pos++]);
      lastQueue = oversizedQueue;
    } else {
      let added = true;
      while (added) {
        added = false;
        for (const qi of order) {
          const q = queues[qi];
          if (q.pos >= q.items.length) continue;
          if (!subjects.has(q.subject) && subjects.size >= maxSubjects) continue;
          const head = q.items[q.pos];
          if (used + head.effectiveMinutes > capacity + EPSILON) continue;
          dayItems.push(head);
          q.pos++;
          used += head.effectiveMinutes;
          subjects.add(q.subject);
          lastQueue = qi;
          added = true;
        }
      }
    }

    remaining -= dayItems.length;
    start = (lastQueue + 1) % queues.length;
    plans.push(makeDay(date, 'study', dayItems, today));
  }

  const unscheduled = queues.flatMap(q => q.items.slice(q.pos));
  return { plans, unscheduled };
}

function withCompletion(plans: DailyPlan[], completedMap: Record<string, boolean>, today: string): DailyPlan[] {
  return plans.map(plan =>
    makeDay(
      plan.date,
      kindOfPlan(plan),
      plan.items.map(item => ({ ...item, completed: completedMap[item.videoId] === true })),
      today
    )
  );
}

/**
 * Full scheduler: validated preferences, deterministic layout of every video,
 * the stored shift events replayed in order, then completion flags.
 */
export function buildSchedule(
  playlists: SubjectPlaylist[],
  preferences: UserPreferences,
  options: ScheduleOptions = {}
): ScheduleResult {
  const { preferences: pref, invalidFields } = inspectPreferences(preferences);
  const today = options.today ?? todayKey();
  const packed = packItems(buildItems(playlists, pref), pref.startDate, pref, today);

  let plans = packed.plans;
  for (const event of normalizeShiftEvents(options.shiftEvents ?? [])) {
    plans = applyShift(plans, event, pref, today);
  }
  plans = withCompletion(plans, options.completedMap ?? {}, today);

  const capacityMinutes = getDailyCapacityMinutes(pref);
  const issues: ScheduleIssue[] = invalidFields.map(field => ({ kind: 'invalid-preference', field }));
  if (packed.unscheduled.length > 0) {
    issues.push({ kind: 'no-study-days', unscheduledCount: packed.unscheduled.length });
  }
  for (const plan of plans) {
    for (const item of plan.items) {
      if (isOversizedItem(item, pref)) {
        issues.push({ kind: 'oversized-item', itemId: item.id, date: plan.date, effectiveMinutes: item.effectiveMinutes, capacityMinutes });
      }
    }
  }

  const completedMap = options.completedMap ?? {};
  return {
    plans,
    preferences: pref,
    capacityMinutes,
    unscheduledItems: packed.unscheduled.map(item => ({ ...item, completed: completedMap[item.videoId] === true })),
    issues,
  };
}

/**
 * Plans for every video, with completion shown via `item.completed`.
 * The 4th argument takes the stored `ShiftEvent[]`; the old
 * `Record<string, string>` form was never read and is still ignored.
 */
export function generateRoadmap(
  playlists: SubjectPlaylist[],
  preferences: UserPreferences,
  completedMap: Record<string, boolean> = {},
  shiftEvents: readonly ShiftEvent[] | Record<string, string> = []
): DailyPlan[] {
  return buildSchedule(playlists, preferences, {
    completedMap,
    shiftEvents: Array.isArray(shiftEvents) ? shiftEvents : [],
  }).plans;
}

/**
 * Records a shift of `date`: every item still incomplete on or before `date`
 * is carried forward and replanned from the day after `max(date, today)`, so
 * today's plan is left alone. Returns null when there is nothing to carry.
 * Persist the event (append it) and pass all events to `generateRoadmap`.
 */
export function createShiftEvent(date: string, plans: DailyPlan[], today: string = todayKey()): ShiftEvent | null {
  const itemIds = plans
    .filter(plan => plan.date <= date)
    .flatMap(plan => plan.items.filter(item => !item.completed).map(item => item.id));
  if (itemIds.length === 0) return null;
  return { date, resumeDate: addDays(maxDateKey(date, today), 1), itemIds };
}

function applyShift(plans: DailyPlan[], event: ShiftEvent, pref: UserPreferences, today: string): DailyPlan[] {
  const carried = new Set(event.itemIds);
  const sorted = [...plans].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const kept: DailyPlan[] = [];
  const replan: DailyPlanItem[] = [];

  for (const plan of sorted) {
    if (plan.date < event.resumeDate) {
      const stay = plan.items.filter(item => !carried.has(item.id));
      replan.push(...plan.items.filter(item => carried.has(item.id)));
      kept.push(makeDay(plan.date, kindOfPlan(plan), stay.map(item => ({ ...item })), today));
    } else {
      replan.push(...plan.items);
    }
  }

  const packed = packItems(replan, event.resumeDate, pref, today);
  if (packed.unscheduled.length > 0) {
    // No study day to move to: leave the plan as it was rather than drop tasks.
    return sorted.map(plan => makeDay(plan.date, kindOfPlan(plan), plan.items.map(item => ({ ...item })), today));
  }
  return [...kept, ...packed.plans];
}

/**
 * Applies one shift event to a plan list without mutating it. Items on days
 * before `event.resumeDate` stay unless carried; carried items and every
 * later item are replanned from `resumeDate` with the normal capacity, rest
 * day and subject rules. No item is dropped.
 */
export function applyShiftEvent(
  plans: DailyPlan[],
  event: ShiftEvent,
  preferences?: UserPreferences,
  today: string = todayKey()
): DailyPlan[] {
  return applyShift(plans, event, resolveShiftPreferences(plans, preferences), today);
}

function resolveShiftPreferences(plans: DailyPlan[], preferences?: UserPreferences): UserPreferences {
  if (preferences) return inspectPreferences(preferences).preferences;
  // Without preferences, don't make days tighter than the ones already planned.
  const busiest = Math.max(0, ...plans.filter(p => !p.isRestDay && !p.isMockExamDay).map(p => p.totalMinutes));
  const pref = inspectPreferences(defaultPreferences).preferences;
  return { ...pref, dailyStudyHours: Math.max(pref.dailyStudyHours, busiest / 60) };
}

/**
 * Immediate, non-persistent shift: items incomplete on or before
 * `currentDate` move to days after it (the rest of the plan is replanned
 * behind them). Pass `preferences` so capacity and rest days are honoured;
 * without them the defaults are used, widened to the busiest planned day.
 * Returns new objects; the input is never mutated. For a shift that stays
 * put across later completion toggles, persist `createShiftEvent` instead.
 */
export function shiftDayPlan(
  currentDate: string,
  planList: DailyPlan[],
  preferences?: UserPreferences,
  today: string = todayKey()
): DailyPlan[] {
  const event = createShiftEvent(currentDate, planList, currentDate);
  if (!event) return planList.map(plan => makeDay(plan.date, kindOfPlan(plan), plan.items.map(item => ({ ...item })), today));
  return applyShiftEvent(planList, event, preferences, today);
}

/** Completed videos that still exist in the playlists; stale ids are ignored. */
export function countCompletedVideos(playlists: SubjectPlaylist[], completedMap: Record<string, boolean>): number {
  return playlists.reduce(
    (acc, pl) => acc + (Array.isArray(pl.videos) ? pl.videos.filter(v => completedMap[v.id] === true).length : 0),
    0
  );
}

/**
 * Remaining workload comes from the incomplete items in `dailyPlans`.
 * Pass `countCompletedVideos(...)` as `completedCount`; it is clamped to
 * `[0, totalVideosOverall]` either way.
 */
export function calculateStats(dailyPlans: DailyPlan[], totalVideosOverall: number, completedCount: number): RoadmapStats {
  const daysWithWork = dailyPlans.filter(p => p.items.some(item => !item.completed));
  const totalEffectiveMinutes = daysWithWork.reduce(
    (acc, p) => acc + p.items.reduce((sum, item) => sum + (item.completed ? 0 : item.effectiveMinutes), 0),
    0
  );
  const totalVideos = Number.isFinite(totalVideosOverall) ? Math.max(0, Math.floor(totalVideosOverall)) : 0;
  const completedVideos = Number.isFinite(completedCount) ? Math.min(totalVideos, Math.max(0, Math.floor(completedCount))) : 0;

  return {
    totalVideos,
    completedVideos,
    totalMinutes: totalEffectiveMinutes,
    effectiveRemainingHours: Math.round(totalEffectiveMinutes / 60),
    estimatedFinishDate: daysWithWork.length > 0 ? daysWithWork[daysWithWork.length - 1].date : todayKey(),
    daysRemaining: daysWithWork.length,
    progressPercent: totalVideos === 0 ? 0 : Math.round((completedVideos / totalVideos) * 100),
  };
}
