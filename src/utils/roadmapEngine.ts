import type {
  DailyPlan,
  DailyPlanItem,
  RoadmapStats,
  ShiftEvent,
  StudyCamp,
  SubjectPlaylist,
  UserPreferences,
  Video,
} from '../types';
import { addDays, dayOfWeek, diffDays, maxDateKey, todayKey, weekdayName } from './date.ts';
import { defaultPreferences, inspectPreferences, normalizeShiftEvents } from './storage.ts';

// Scheduling contract
// - Every video of every playlist is scheduled, completed or not. The layout
//   depends only on playlists, preferences and shift events; completion only
//   sets `item.completed`, so ticking a task never moves any task.
// - A shift is a durable event recorded once, when the user asks for it (see
//   `createShiftEvent`). Replaying the stored events keeps later completion
//   toggles from moving anything.
// - Dates are local `YYYY-MM-DD` keys (see ./date.ts).
// - Two ways to form the week: automatic (every branch round-robin over the
//   study weekdays, capped by `maxSubjectsPerDay`) or manual (`weekPlan`: the
//   user picks the branches of each weekday). See docs/planner-engine.md.

export type { ShiftEvent };

export type ScheduleIssue =
  | { kind: 'invalid-preference'; field: keyof UserPreferences }
  | { kind: 'no-study-days'; unscheduledCount: number }
  /** Manual mode: a branch with videos that no study weekday includes. */
  | { kind: 'unassigned-branch'; playlistId: string; unscheduledCount: number }
  | { kind: 'oversized-item'; itemId: string; date: string; effectiveMinutes: number; capacityMinutes: number };

export interface ScheduleOptions {
  completedMap?: Record<string, boolean>;
  shiftEvents?: readonly ShiftEvent[];
  /** Local day used for `isToday`/`isPast`; defaults to the real today. */
  today?: string;
  /**
   * Manual mode: branch (playlist) ids per weekday, index 0 = Sunday. Only
   * those branches are studied on that weekday, and the study weekdays are
   * exactly the ones with a branch (mock exam days still win). Null or
   * missing = automatic distribution.
   */
  weekPlan?: readonly (readonly string[])[] | null;
}

export interface ScheduleResult {
  plans: DailyPlan[];
  /** Preferences after validation; these are what the schedule used. */
  preferences: UserPreferences;
  capacityMinutes: number;
  /**
   * Items that could not be placed: no weekday is a study day, or (manual
   * mode) their branch is on no study weekday.
   */
  unscheduledItems: DailyPlanItem[];
  issues: ScheduleIssue[];
}

/** `free`: a manual-mode study day whose branches have nothing left. */
type DayKind = 'study' | 'rest' | 'mock' | 'free';

/** How days are filled: the validated preferences plus the manual week plan, if any. */
interface PackRules {
  pref: UserPreferences;
  weekPlan: string[][] | null;
}

const EPSILON = 1e-9;

export function getEffectiveMinutes(durationMinutes: number, pref: Pick<UserPreferences, 'playbackSpeed' | 'practiceMultiplier'>): number {
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
 * rest day. Only the remaining days receive videos. (In manual mode
 * `resolveRules` has already turned the week plan into `activeDays`.)
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

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Cleans a manual week plan against the branches that exist: seven lists,
 * unknown and repeated ids dropped, each list in branch order.
 */
export function sanitizeWeekPlan(weekPlan: readonly (readonly string[])[] | null | undefined, branchIds: readonly string[]): string[][] {
  return WEEKDAYS.map(dow => {
    const day = Array.isArray(weekPlan?.[dow]) ? new Set(weekPlan[dow]) : new Set<string>();
    return branchIds.filter(id => day.has(id));
  });
}

/**
 * Manual mode: study weekdays are exactly the weekdays with a branch (mock
 * exam days still win); every other weekday rests. Auto mode is unchanged.
 */
function resolveRules(
  pref: UserPreferences,
  weekPlan: readonly (readonly string[])[] | null | undefined,
  playlists: SubjectPlaylist[]
): PackRules {
  if (!weekPlan) return { pref, weekPlan: null };
  const plan = sanitizeWeekPlan(
    weekPlan,
    playlists.map(pl => pl.id)
  );
  const mock = pref.mockExamDays;
  const activeDays = WEEKDAYS.filter(d => plan[d].length > 0 && !mock.includes(d));
  const restDays = WEEKDAYS.filter(d => !activeDays.includes(d) && !mock.includes(d));
  return {
    pref: { ...pref, activeDays, restDays },
    weekPlan: WEEKDAYS.map(d => (activeDays.includes(d) ? plan[d] : [])),
  };
}

function makeDay(date: string, kind: DayKind, items: DailyPlanItem[], today: string): DailyPlan {
  return {
    date,
    dayName: weekdayName(date),
    isToday: date === today,
    isPast: date < today,
    isRestDay: kind === 'rest',
    isMockExamDay: kind === 'mock',
    ...(kind === 'free' ? { isFreeDay: true } : {}),
    items,
    totalMinutes: items.reduce((acc, item) => acc + item.effectiveMinutes, 0),
    isAllCompleted: items.length > 0 && items.every(item => item.completed),
  };
}

function kindOfPlan(plan: DailyPlan): DayKind {
  if (plan.isMockExamDay) return 'mock';
  if (plan.isRestDay) return 'rest';
  if (plan.isFreeDay) return 'free';
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

interface Queue {
  playlistId: string;
  subject: string;
  items: DailyPlanItem[];
  pos: number;
}

/**
 * Lays `items` out on days from `startDate`. Items keep their order within a
 * playlist (branch).
 *
 * Automatic mode: each study day is filled by round-robin passes over every
 * branch, starting after the branch that got the last item the day before, so
 * every subject keeps moving even under `maxSubjectsPerDay`.
 *
 * Manual mode: a study day only takes the branches its weekday lists, again
 * round-robin in branch order until the day is full. A weekday whose branches
 * have nothing left becomes a `free` day. Branches on no study weekday cannot
 * be placed and come back as `unscheduled`.
 *
 * Either way a branch whose next item is longer than a whole day gets the
 * next (eligible) study day to itself, and each 7-day window places at least
 * one item, so this always finishes. Completion is ignored here on purpose.
 */
function packItems(items: DailyPlanItem[], startDate: string, rules: PackRules, today: string): PackResult {
  const { pref, weekPlan } = rules;
  const plans: DailyPlan[] = [];
  if (items.length === 0) return { plans, unscheduled: [] };
  if (!hasStudyWeekday(pref)) return { plans, unscheduled: [...items] };

  const assigned = weekPlan ? new Set(weekPlan.flat()) : null;
  const queues: Queue[] = [];
  const queueByPlaylist = new Map<string, Queue>();
  const unassigned: DailyPlanItem[] = [];
  for (const item of items) {
    if (assigned && !assigned.has(item.playlistId)) {
      unassigned.push({ ...item });
      continue;
    }
    let queue = queueByPlaylist.get(item.playlistId);
    if (!queue) {
      queue = { playlistId: item.playlistId, subject: item.subject, items: [], pos: 0 };
      queueByPlaylist.set(item.playlistId, queue);
      queues.push(queue);
    }
    queue.items.push({ ...item });
  }

  const capacity = getDailyCapacityMinutes(pref);
  // Manual days pick their branches themselves, so only auto mode caps them.
  const maxSubjects = weekPlan ? Number.POSITIVE_INFINITY : pref.maxSubjectsPerDay;
  const queuesOn = (dow: number): number[] => {
    if (!weekPlan) return queues.map((_, i) => i);
    const ids = new Set(weekPlan[dow]);
    return queues.flatMap((q, i) => (ids.has(q.playlistId) ? [i] : []));
  };
  let remaining = items.length - unassigned.length;
  let start = 0;
  let date = startDate;
  // Each 7-day window has a study day for every remaining branch and each
  // such day places an item, so this bound is never reached; it only guards
  // against a future regression.
  const maxDays = items.length * 7 + 7;

  for (let dayIndex = 0; remaining > 0 && dayIndex < maxDays; dayIndex++, date = addDays(date, 1)) {
    const kind = dayKindOf(date, pref);
    if (kind !== 'study') {
      plans.push(makeDay(date, kind, [], today));
      continue;
    }

    const eligible = queuesOn(dayOfWeek(date));
    // Rotation only matters in auto mode; manual days keep branch order.
    const order = weekPlan ? eligible : eligible.map((_, i) => eligible[(start + i) % eligible.length]);
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
    if (!weekPlan) start = (lastQueue + 1) % queues.length;
    plans.push(makeDay(date, weekPlan && dayItems.length === 0 ? 'free' : 'study', dayItems, today));
  }

  const unscheduled = [...queues.flatMap(q => q.items.slice(q.pos)), ...unassigned];
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
 * Pass `options.weekPlan` for manual mode (see `buildCampSchedule`).
 */
export function buildSchedule(
  playlists: SubjectPlaylist[],
  preferences: UserPreferences,
  options: ScheduleOptions = {}
): ScheduleResult {
  const { preferences: validated, invalidFields } = inspectPreferences(preferences);
  const rules = resolveRules(validated, options.weekPlan, playlists);
  const pref = rules.pref;
  const today = options.today ?? todayKey();
  const packed = packItems(buildItems(playlists, pref), pref.startDate, rules, today);

  let plans = packed.plans;
  for (const event of normalizeShiftEvents(options.shiftEvents ?? [])) {
    plans = applyShift(plans, event, rules, today);
  }
  plans = withCompletion(plans, options.completedMap ?? {}, today);

  const capacityMinutes = getDailyCapacityMinutes(pref);
  const issues: ScheduleIssue[] = invalidFields.map(field => ({ kind: 'invalid-preference', field }));
  if (packed.unscheduled.length > 0) {
    if (!hasStudyWeekday(pref)) {
      issues.push({ kind: 'no-study-days', unscheduledCount: packed.unscheduled.length });
    } else {
      const counts = new Map<string, number>();
      for (const item of packed.unscheduled) counts.set(item.playlistId, (counts.get(item.playlistId) ?? 0) + 1);
      for (const [playlistId, unscheduledCount] of counts) issues.push({ kind: 'unassigned-branch', playlistId, unscheduledCount });
    }
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
 * A camp's plan: its branches, its schedule (automatic or manual week) and
 * its own shift events. This is what every screen shows.
 */
export function buildCampSchedule(
  camp: Pick<StudyCamp, 'branches' | 'schedule' | 'shiftEvents'>,
  options: Omit<ScheduleOptions, 'shiftEvents' | 'weekPlan'> = {}
): ScheduleResult {
  return buildSchedule(camp.branches, camp.schedule, {
    ...options,
    shiftEvents: camp.shiftEvents,
    weekPlan: camp.schedule.mode === 'manual' ? camp.schedule.weekPlan : null,
  });
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

function applyShift(plans: DailyPlan[], event: ShiftEvent, rules: PackRules, today: string): DailyPlan[] {
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

  const packed = packItems(replan, event.resumeDate, rules, today);
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
 * day and subject rules. No item is dropped. (Automatic mode only; camps
 * replay their events through `buildCampSchedule`.)
 */
export function applyShiftEvent(
  plans: DailyPlan[],
  event: ShiftEvent,
  preferences?: UserPreferences,
  today: string = todayKey()
): DailyPlan[] {
  return applyShift(plans, event, { pref: resolveShiftPreferences(plans, preferences), weekPlan: null }, today);
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

// ---------------------------------------------------------------------------
// Target end date. A deadline never changes the layout: it is only compared
// with where the plan ends, so nothing is dropped or squeezed to meet it.

/** Last day holding a task (done or not), or null for an empty plan. */
export function planEndDate(plans: DailyPlan[]): string | null {
  let end: string | null = null;
  for (const plan of plans) if (plan.items.length > 0 && (end === null || plan.date > end)) end = plan.date;
  return end;
}

export type DeadlineStatus =
  | { kind: 'none' }
  /** Some videos cannot be placed at all (see the schedule issues). */
  | { kind: 'incomplete'; targetEndDate: string; unscheduledCount: number }
  | { kind: 'on-track'; finishDate: string; targetEndDate: string; spareDays: number }
  | { kind: 'late'; finishDate: string; targetEndDate: string; lateDays: number };

export function assessDeadline(input: {
  finishDate: string | null;
  targetEndDate: string | null | undefined;
  unscheduledCount?: number;
}): DeadlineStatus {
  const { finishDate, targetEndDate, unscheduledCount = 0 } = input;
  if (!targetEndDate) return { kind: 'none' };
  if (unscheduledCount > 0) return { kind: 'incomplete', targetEndDate, unscheduledCount };
  if (finishDate === null) return { kind: 'none' };
  const gap = diffDays(targetEndDate, finishDate);
  return gap > 0
    ? { kind: 'late', finishDate, targetEndDate, lateDays: gap }
    : { kind: 'on-track', finishDate, targetEndDate, spareDays: Math.max(0, -gap) };
}

/**
 * The smallest daily study time (in `step`-hour steps above the current one,
 * at most `maxHours`) with which the camp's plan ends by its target date, or
 * null when no such time exists (e.g. manual weekdays are the bottleneck).
 */
export function dailyHoursForDeadline(
  camp: Pick<StudyCamp, 'branches' | 'schedule' | 'shiftEvents'>,
  options: { today?: string; maxHours?: number; step?: number } = {}
): number | null {
  const target = camp.schedule.targetEndDate;
  if (!target) return null;
  const step = options.step ?? 0.5;
  const finishesWith = (hours: number) => {
    const result = buildCampSchedule({ ...camp, schedule: { ...camp.schedule, dailyStudyHours: hours } }, { today: options.today });
    if (result.unscheduledItems.length > 0) return false;
    const end = planEndDate(result.plans);
    return end === null || end <= target;
  };
  let lo = Math.floor(camp.schedule.dailyStudyHours / step + EPSILON) + 1;
  let hi = Math.floor((options.maxHours ?? 16) / step + EPSILON);
  if (lo > hi || !finishesWith(hi * step)) return null;
  // Packing is almost monotonic in the capacity; the answer is checked either way.
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (finishesWith(mid * step)) hi = mid;
    else lo = mid + 1;
  }
  return lo * step;
}
