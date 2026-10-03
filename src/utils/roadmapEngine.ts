import type {
  CampSchedule,
  DailyPlan,
  DailyPlanItem,
  RoadmapStats,
  ShiftEvent,
  StudyCamp,
  SubjectPlaylist,
  UserPreferences,
  Video,
} from '../types/index.ts';
import { addDays, dayOfWeek, diffDays, isDateKey, todayKey, weekdayName } from './date.ts';
import { defaultPreferences, inspectPreferences, normalizeShiftEvents } from './storage.ts';

// Scheduling contract
// - Every video of every playlist is scheduled, completed or not. The layout
//   depends on playlists, preferences, shift events and the day each task was
//   ticked (`completionDays`): a task ticked before its planned day moves to
//   the day it was done, and the open tasks after it move up into the freed
//   time (`applyFinishOps`). Nothing else about completion moves a task.
// - A shift is a durable event recorded once, when the user asks for it (see
//   `createShiftEvent`). Shifts and early ticks replay in the order they
//   happened, and each only re-lays days from the day it happened on, so the
//   days before today never change.
// - Dates are local `YYYY-MM-DD` keys (see ./date.ts).
// - A camp's tempo can change part-way (`PastTempo`): each day is laid out
//   with the tempo in force on it, so days before a change keep their layout.
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

/**
 * The day each video was ticked (`yt_completed_on`). Ticks recorded from
 * `aheadSince` on free the later day they were planned for; earlier ones
 * (made before this rule existed) keep their place.
 */
export interface CompletionDays {
  aheadSince: string;
  /** videoId -> day it was ticked (only videos that are ticked). */
  dates: Readonly<Record<string, string>>;
  /** videoId -> [ticked, unticked] days of ticks taken back on a later day, oldest first. */
  reopened?: Readonly<Record<string, readonly (readonly [string, string])[]>>;
}

export interface ScheduleOptions {
  completedMap?: Record<string, boolean>;
  /** Without it (or for undated ticks) ticking never moves a task. */
  completionDays?: CompletionDays;
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
  /**
   * Earlier tempos, oldest first: each lays out the days before its `until`
   * (and from the previous one's `until` on); the main preferences and
   * `weekPlan` take over from the last `until`. Missing = one tempo.
   */
  pastTempos?: readonly PastTempoRules[];
}

export interface PastTempoRules {
  until: string;
  preferences: UserPreferences;
  /** Manual week of that tempo, or null for automatic. */
  weekPlan: readonly (readonly string[])[] | null;
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

/**
 * The rules of every day: `past[i].rules` up to (not including) its `until`,
 * then `current`. `past` is sorted by `until`.
 */
interface Tempo {
  past: { until: string; rules: PackRules }[];
  current: PackRules;
}

const singleTempo = (rules: PackRules): Tempo => ({ past: [], current: rules });

function rulesOn(tempo: Tempo, date: string): PackRules {
  for (const period of tempo.past) if (date < period.until) return period.rules;
  return tempo.current;
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

/** Item id -> its place in the branches' video order (`buildItems`). */
type LessonOrder = ReadonlyMap<string, number>;

interface Queue {
  playlistId: string;
  subject: string;
  items: DailyPlanItem[];
  pos: number;
}

/**
 * Lays `items` out on days from `startDate`. Items keep their order within a
 * playlist (branch). Each day follows the rules of the tempo in force on it.
 *
 * Automatic mode: each study day is filled by round-robin passes over every
 * branch, starting after the branch that got the last item the day before, so
 * every subject keeps moving even under `maxSubjectsPerDay`.
 *
 * Manual mode: a study day only takes the branches its weekday lists, again
 * round-robin in branch order until the day is full. A weekday whose branches
 * have nothing left becomes a `free` day. Branches on no study weekday of the
 * current tempo cannot be placed and come back as `unscheduled`.
 *
 * Either way a branch whose next item is longer than a whole day gets the
 * next (eligible) study day to itself. The study day after one given to an
 * oversized item goes to the other branches that have open work first (their
 * heads fit a day), so long videos alternate with them instead of starving
 * them; with no such branch, oversized items keep taking consecutive days.
 * This rotation applies from `today` on only: earlier days keep the layout
 * they had. Under the current tempo each 7-day
 * window places at least one item, so this always finishes. Completion is
 * ignored here on purpose. With `lessonOrder` each branch is laid out in
 * lesson order rather than in the order its items arrive.
 */
function packItems(
  items: DailyPlanItem[],
  startDate: string,
  tempo: Tempo,
  today: string,
  pinned: DailyPlanItem[] = [],
  lessonOrder?: LessonOrder,
  /** The study day before `startDate` was given to an oversized item. */
  followsOversized = false
): PackResult {
  const plans: DailyPlan[] = [];
  if (items.length === 0 && pinned.length === 0) return { plans, unscheduled: [] };

  const queues: Queue[] = [];
  const queueByPlaylist = new Map<string, Queue>();
  for (const item of items) {
    let queue = queueByPlaylist.get(item.playlistId);
    if (!queue) {
      queue = { playlistId: item.playlistId, subject: item.subject, items: [], pos: 0 };
      queueByPlaylist.set(item.playlistId, queue);
      queues.push(queue);
    }
    queue.items.push({ ...item });
  }
  // Each branch in lesson order, whatever days its tasks came from.
  if (lessonOrder) for (const q of queues) q.items.sort((a, b) => (lessonOrder.get(a.id) ?? 0) - (lessonOrder.get(b.id) ?? 0));

  // From the last tempo change on, the current tempo alone decides: what it
  // cannot place (no study weekday, or a manual branch on no weekday) never
  // will be. Earlier tempos may still place such items on their own days.
  const { current } = tempo;
  const lastChange = tempo.past.length > 0 ? tempo.past[tempo.past.length - 1].until : startDate;
  const settled = lastChange > startDate ? lastChange : startDate;
  const finalBranches = current.weekPlan ? new Set(current.weekPlan.flat()) : null;
  const canStillPlace = (q: Queue) => hasStudyWeekday(current.pref) && (!finalBranches || finalBranches.has(q.playlistId));
  const hasLeft = (q: Queue) => q.pos < q.items.length;
  // Under one tempo items keep the minutes they were built with; across
  // tempos (speed or practice may differ) each day weighs its own.
  const reweigh = tempo.past.length > 0;

  let start = 0;
  let afterOversized: boolean = followsOversized;
  let date = startDate;
  // Each 7-day window under the current tempo has a study day for every
  // remaining branch and each such day places an item, so this bound is never
  // reached; it only guards against a future regression.
  const maxDays = diffDays(startDate, settled) + items.length * 7 + 7;

  for (let dayIndex = 0; dayIndex < maxDays; dayIndex++, date = addDays(date, 1)) {
    const isSettled = date >= settled;
    const pinsToday = dayIndex === 0 && pinned.length > 0;
    if (!pinsToday && !queues.some(q => hasLeft(q) && (!isSettled || canStillPlace(q)))) break;
    const { pref, weekPlan } = rulesOn(tempo, date);
    const kind = dayKindOf(date, pref);
    if (kind !== 'study') {
      plans.push(makeDay(date, kind, [], today));
      continue;
    }

    const capacity = getDailyCapacityMinutes(pref);
    // Manual days pick their branches themselves, so only auto mode caps them.
    const maxSubjects = weekPlan ? Number.POSITIVE_INFINITY : pref.maxSubjectsPerDay;
    const minutesOf = (item: DailyPlanItem) => (reweigh ? getEffectiveMinutes(item.durationMinutes, pref) : item.effectiveMinutes);
    const take = (q: Queue): DailyPlanItem => {
      const item = q.items[q.pos++];
      return reweigh ? { ...item, effectiveMinutes: minutesOf(item) } : item;
    };

    let eligible: number[];
    if (weekPlan) {
      const ids = new Set(weekPlan[dayOfWeek(date)]);
      eligible = queues.flatMap((q, i) => (ids.has(q.playlistId) ? [i] : []));
    } else {
      eligible = queues.map((_, i) => i);
    }
    // Rotation only matters in auto mode; manual days keep branch order.
    const order = weekPlan ? eligible : eligible.map((_, i) => eligible[(start + i) % eligible.length]);
    // Pinned items (already ticked) hold the first day's capacity before anything else.
    const dayItems: DailyPlanItem[] = dayIndex === 0 ? [...pinned] : [];
    const subjects = new Set<string>(dayItems.map(item => item.subject));
    let used = dayItems.reduce((sum, item) => sum + item.effectiveMinutes, 0);
    let lastQueue = start;

    // A day that already holds pinned work cannot also take an oversized item alone.
    const isOversizedHead = (qi: number) => {
      const q = queues[qi];
      return hasLeft(q) && minutesOf(q.items[q.pos]) > capacity + EPSILON;
    };
    // After an oversized day the others go first, but only from today on.
    const othersFirst: boolean = afterOversized && date >= today && order.some(qi => hasLeft(queues[qi]) && !isOversizedHead(qi));
    const oversizedQueue: number | undefined = dayItems.length > 0 || othersFirst ? undefined : order.find(isOversizedHead);
    afterOversized = oversizedQueue !== undefined;

    if (oversizedQueue !== undefined) {
      dayItems.push(take(queues[oversizedQueue]));
      lastQueue = oversizedQueue;
    } else {
      let added = true;
      while (added) {
        added = false;
        for (const qi of order) {
          const q = queues[qi];
          if (!hasLeft(q)) continue;
          if (!subjects.has(q.subject) && subjects.size >= maxSubjects) continue;
          const minutes = minutesOf(q.items[q.pos]);
          if (used + minutes > capacity + EPSILON) continue;
          dayItems.push(take(q));
          used += minutes;
          subjects.add(q.subject);
          lastQueue = qi;
          added = true;
        }
      }
    }

    if (!weekPlan) start = (lastQueue + 1) % queues.length;
    plans.push(makeDay(date, weekPlan && dayItems.length === 0 ? 'free' : 'study', dayItems, today));
  }

  const rest = (q: Queue) => q.items.slice(q.pos);
  const unscheduled = [...queues.filter(canStillPlace).flatMap(rest), ...queues.filter(q => !canStillPlace(q)).flatMap(rest)];
  return { plans, unscheduled };
}

/**
 * How many of the user's own shifts carried each item forward. Events the app
 * made itself (any `origin`, e.g. when branches joined a running camp) are not
 * postponements and are not counted.
 */
export function postponeCounts(events: readonly ShiftEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.origin) continue;
    for (const id of new Set(event.itemIds)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Decorates items with completion and their postpone count; the layout is untouched. */
function withCompletion(plans: DailyPlan[], completedMap: Record<string, boolean>, postponed: Map<string, number>, today: string): DailyPlan[] {
  return plans.map(plan =>
    makeDay(
      plan.date,
      kindOfPlan(plan),
      plan.items.map(item => {
        const postponeCount = postponed.get(item.id);
        return { ...item, completed: completedMap[item.videoId] === true, ...(postponeCount ? { postponeCount } : {}) };
      }),
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
  const tempo: Tempo = {
    past: [...(options.pastTempos ?? [])]
      .filter(past => isDateKey(past.until))
      .sort((a, b) => (a.until < b.until ? -1 : a.until > b.until ? 1 : 0))
      .map(past => ({ until: past.until, rules: resolveRules(inspectPreferences(past.preferences).preferences, past.weekPlan, playlists) })),
    current: rules,
  };
  const today = options.today ?? todayKey();
  const items = buildItems(playlists, pref);
  const lessonOrder: LessonOrder = new Map(items.map((item, index) => [item.id, index]));
  const packed = packItems(items, pref.startDate, tempo, today);

  let plans = packed.plans;
  const events = normalizeShiftEvents(options.shiftEvents ?? []);
  const days = options.completionDays;
  // Shifts and early ticks replay in the order they happened. An event made
  // on day d resumes on d or d + 1, so the ticks of the days before its
  // `resumeDate` came first.
  const finishOps = finishOpsOf(days, options.completedMap ?? {});
  const ahead = new Set<string>();
  let nextOp = 0;
  const finishUntil = (resumeDate: string | null) => {
    for (; nextOp < finishOps.length && (resumeDate === null || finishOps[nextOp].date < resumeDate); nextOp++) {
      plans = applyFinishOps(plans, finishOps[nextOp], ahead, tempo, today, lessonOrder);
    }
  };
  for (const event of events) {
    // Safety net: an event that resumes before the camp's start can never
    // place a task earlier than `startDate`, so replay ignores it.
    if (event.resumeDate < pref.startDate) continue;
    finishUntil(event.resumeDate);
    // Events made since early ticks exist re-lay each branch in lesson order:
    // a task taken back after it was done ahead may sit after later lessons.
    plans = applyShift(plans, event, tempo, today, days && event.resumeDate > days.aheadSince ? lessonOrder : undefined);
  }
  finishUntil(null);
  plans = withCompletion(plans, options.completedMap ?? {}, postponeCounts(events), today);

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
    const dayPref = rulesOn(tempo, plan.date).pref;
    for (const item of plan.items) {
      if (isOversizedItem(item, dayPref)) {
        issues.push({ kind: 'oversized-item', itemId: item.id, date: plan.date, effectiveMinutes: item.effectiveMinutes, capacityMinutes: getDailyCapacityMinutes(dayPref) });
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

const weekPlanOf = (schedule: CampSchedule) => (schedule.mode === 'manual' ? schedule.weekPlan : null);

/**
 * A camp's plan: its branches, its schedule (automatic or manual week), the
 * tempos it followed before (`tempoHistory`) and its own shift events. This
 * is what every screen shows.
 */
export function buildCampSchedule(
  camp: Pick<StudyCamp, 'branches' | 'schedule' | 'shiftEvents' | 'tempoHistory'>,
  options: Omit<ScheduleOptions, 'shiftEvents' | 'weekPlan' | 'pastTempos'> = {}
): ScheduleResult {
  return buildSchedule(camp.branches, camp.schedule, {
    ...options,
    shiftEvents: camp.shiftEvents,
    weekPlan: weekPlanOf(camp.schedule),
    pastTempos: (camp.tempoHistory ?? []).map(past => ({ until: past.until, preferences: past.schedule, weekPlan: weekPlanOf(past.schedule) })),
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
 * Records a shift of `date`. Returns null when there is nothing to carry.
 * - A past day ("Ritmi güncelle" on overdue tasks): every item still
 *   incomplete on any day before today is carried and the plan is re-laid
 *   from today, so today's own tasks follow the carried ones and every branch
 *   keeps its lesson order. The event's `date` is yesterday. Tasks already
 *   ticked today stay on today (`keepOnResume`) and use up its capacity, so the
 *   carried ones only fill the rest; a ticked task whose branch has a carried
 *   lesson before it is not kept, as it would otherwise overtake that lesson.
 * - Today or later ("Kalanları yarına kaydır"): every item still incomplete
 *   on or before `date` is carried and replanned from `date + 1`.
 * Persist the event (append it) and pass all events to `generateRoadmap`.
 * Stored events replay by their own `resumeDate`, whichever rule made them.
 */
export function createShiftEvent(date: string, plans: DailyPlan[], today: string = todayKey()): ShiftEvent | null {
  const until = date < today ? addDays(today, -1) : date;
  const itemIds = plans
    .filter(plan => plan.date <= until)
    .flatMap(plan => plan.items.filter(item => !item.completed).map(item => item.id));
  if (itemIds.length === 0) return null;
  const event: ShiftEvent = { date: until, resumeDate: addDays(until, 1), itemIds };
  if (date < today) {
    const carried = new Set(itemIds);
    const carriedBranches = new Set(
      plans.filter(plan => plan.date <= until).flatMap(plan => plan.items.filter(item => carried.has(item.id)).map(item => item.playlistId))
    );
    const keep = plans
      .filter(plan => plan.date === today)
      .flatMap(plan => plan.items.filter(item => item.completed && !carriedBranches.has(item.playlistId)).map(item => item.id));
    if (keep.length > 0) event.keepOnResume = keep;
  }
  return event;
}

function applyShift(plans: DailyPlan[], event: ShiftEvent, tempo: Tempo, today: string, lessonOrder?: LessonOrder): DailyPlan[] {
  const carried = new Set(event.itemIds);
  const sorted = [...plans].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const kept: DailyPlan[] = [];
  const replan: DailyPlanItem[] = [];
  const pinned: DailyPlanItem[] = [];
  // Only a study day can hold the pinned items; otherwise they replan like the rest.
  const keep = new Set(event.keepOnResume ?? []);
  const canPin = keep.size > 0 && dayKindOf(event.resumeDate, rulesOn(tempo, event.resumeDate).pref) === 'study';

  for (const plan of sorted) {
    if (plan.date < event.resumeDate) {
      const stay = plan.items.filter(item => !carried.has(item.id));
      replan.push(...plan.items.filter(item => carried.has(item.id)));
      kept.push(makeDay(plan.date, kindOfPlan(plan), stay.map(item => ({ ...item })), today));
    } else if (canPin && plan.date === event.resumeDate) {
      for (const item of plan.items) (keep.has(item.id) ? pinned : replan).push(item);
    } else {
      replan.push(...plan.items);
    }
  }

  const packed = packItems(replan, event.resumeDate, tempo, today, pinned, lessonOrder);
  if (packed.unscheduled.length > 0) {
    // No study day to move to: leave the plan as it was rather than drop tasks.
    return sorted.map(plan => makeDay(plan.date, kindOfPlan(plan), plan.items.map(item => ({ ...item })), today));
  }
  return [...kept, ...packed.plans];
}

const byDate = (a: DailyPlan, b: DailyPlan) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

// ---------------------------------------------------------------------------
// Early finishes. A task ticked before its planned day counts on the day it
// was done: it moves there, and every task from its old day on is laid out
// again, so the open ones move up into the freed time and the plan can end
// sooner. `buildSchedule` replays the ticks day by day between the shift
// events, and each day's ticks only re-lay that day's later days, so the
// days before today never change.

/** One day's early-finish work: ticks taken back (`reopened`), then ticks. Video ids. */
interface FinishOps {
  date: string;
  ticked: Set<string>;
  reopened: Set<string>;
}

function finishOpsOf(days: CompletionDays | undefined, completedMap: Record<string, boolean>): FinishOps[] {
  if (!days || !isDateKey(days.aheadSince)) return [];
  const byDay = new Map<string, FinishOps>();
  const on = (date: string) => {
    let ops = byDay.get(date);
    if (!ops) byDay.set(date, (ops = { date, ticked: new Set(), reopened: new Set() }));
    return ops;
  };
  const counts = (date: unknown): date is string => isDateKey(date) && date >= days.aheadSince;
  for (const [videoId, pairs] of Object.entries(days.reopened ?? {})) {
    for (const [ticked, unticked] of pairs) {
      if (!counts(ticked) || !isDateKey(unticked) || unticked <= ticked) continue;
      on(ticked).ticked.add(videoId);
      on(unticked).reopened.add(videoId);
    }
  }
  for (const [videoId, date] of Object.entries(days.dates)) {
    if (completedMap[videoId] === true && counts(date)) on(date).ticked.add(videoId);
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * The plan with `removed` taken out and every item from `from` on (plus
 * `extra`) laid out again from `from`, each branch in lesson order. Days
 * before `from` keep their layout. Null when something could not be placed.
 */
function relayFrom(
  plans: DailyPlan[],
  from: string,
  removed: ReadonlySet<string>,
  extra: DailyPlanItem[],
  tempo: Tempo,
  today: string,
  lessonOrder: LessonOrder
): DailyPlan[] | null {
  const kept: DailyPlan[] = [];
  const replan: DailyPlanItem[] = [];
  for (const plan of plans) {
    const items = plan.items.filter(item => !removed.has(item.id));
    if (plan.date < from) kept.push(makeDay(plan.date, kindOfPlan(plan), items, today));
    else replan.push(...items);
  }
  replan.push(...extra);
  // The long-video rotation carries on across `from`: if the last study day
  // before it went to one oversized item, the other branches go first.
  const lastStudy = [...kept].reverse().find(plan => !plan.isRestDay && !plan.isMockExamDay);
  const followsOversized =
    lastStudy !== undefined && lastStudy.items.length === 1 && isOversizedItem(lastStudy.items[0], rulesOn(tempo, lastStudy.date).pref);
  const packed = packItems(replan, from, tempo, today, [], lessonOrder, followsOversized);
  return packed.unscheduled.length > 0 ? null : [...kept, ...packed.plans];
}

/** Adds done items to `date` (or the plan's first day, if it starts later). */
function placeOn(plans: DailyPlan[], date: string, items: DailyPlanItem[], tempo: Tempo, today: string): DailyPlan[] {
  const target = plans.length > 0 && plans[0].date > date ? plans[0].date : date;
  const at = plans.findIndex(plan => plan.date === target);
  if (at >= 0) {
    const plan = plans[at];
    const kind = kindOfPlan(plan);
    return plans.map((p, i) => (i === at ? makeDay(p.date, kind === 'free' ? 'study' : kind, [...p.items, ...items], today) : p));
  }
  const day = makeDay(target, dayKindOf(target, rulesOn(tempo, target).pref), items, today);
  return [...plans, day].sort(byDate);
}

/**
 * One day's early finishes, in place of a stored event. `ahead` holds the
 * items moved so far. A tick taken back on a later day returns its task to the
 * open plan from that day, in lesson order (the day it was done on loses it).
 * Then each task ticked this day but planned for a later one moves to this
 * day, and the plan is laid out again from the earliest day it left.
 */
function applyFinishOps(
  plans: DailyPlan[],
  ops: FinishOps,
  ahead: Set<string>,
  tempo: Tempo,
  today: string,
  lessonOrder: LessonOrder
): DailyPlan[] {
  let sorted = [...plans].sort(byDate);
  if (ops.reopened.size > 0) {
    const back = sorted.flatMap(plan => plan.items.filter(item => ahead.has(item.id) && ops.reopened.has(item.videoId)));
    const relaid = back.length > 0 ? relayFrom(sorted, ops.date, new Set(back.map(item => item.id)), back, tempo, today, lessonOrder) : null;
    if (relaid) {
      sorted = relaid;
      for (const item of back) ahead.delete(item.id);
    }
  }

  const early = sorted.flatMap(plan => (plan.date > ops.date ? plan.items.filter(item => ops.ticked.has(item.videoId)).map(item => ({ item, date: plan.date })) : []));
  if (early.length === 0) return sorted;
  const moved = new Set(early.map(({ item }) => item.id));
  // Should the rest not fit (no study day left to move to), the task still
  // counts on its day; the others simply stay where they were.
  const relaid =
    relayFrom(sorted, early[0].date, moved, [], tempo, today, lessonOrder) ??
    sorted.map(plan => makeDay(plan.date, kindOfPlan(plan), plan.items.filter(item => !moved.has(item.id)), today));
  for (const id of moved) ahead.add(id);
  return placeOn(relaid, ops.date, early.map(({ item }) => item), tempo, today);
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
  return applyShift(plans, event, singleTempo({ pref: resolveShiftPreferences(plans, preferences), weekPlan: null }), today);
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

type ScheduledCamp = Pick<StudyCamp, 'branches' | 'schedule' | 'shiftEvents' | 'tempoHistory'>;

/**
 * The smallest daily study time (in `step`-hour steps above the current one,
 * at most `maxHours`) with which the camp's plan ends by its target date, or
 * null when no such time exists (e.g. manual weekdays are the bottleneck).
 * `withHours` says how a daily time is applied; by default it replaces the
 * camp's whole tempo, which is right only for a camp that has not started
 * (a started camp's change applies from today: see `hoursToMeetTarget`).
 */
export function dailyHoursForDeadline(
  camp: ScheduledCamp,
  options: {
    today?: string;
    maxHours?: number;
    step?: number;
    withHours?: (hours: number) => ScheduledCamp;
    /** Pass the plan's completion so tasks done ahead free their days here too. */
    completedMap?: Record<string, boolean>;
    completionDays?: CompletionDays;
  } = {}
): number | null {
  const target = camp.schedule.targetEndDate;
  if (!target) return null;
  const step = options.step ?? 0.5;
  const withHours = options.withHours ?? ((hours: number) => ({ ...camp, schedule: { ...camp.schedule, dailyStudyHours: hours } }));
  const finishesWith = (hours: number) => {
    const result = buildCampSchedule(withHours(hours), { today: options.today, completedMap: options.completedMap, completionDays: options.completionDays });
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
