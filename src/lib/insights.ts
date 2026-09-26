import type { DailyPlanItem, PostponeReason, StudyCamp } from '../types';
import type { ScheduleResult } from './engine.ts';
import { POSTPONE_REASONS, addDays, maxDateKey } from './engine.ts';
import { startOfWeek } from './format.ts';
import type { CompletionDates } from './persistence.ts';

// Read-only analytics for the progress page, over the camps a screen shows
// (one camp, or "Tüm Kamplar"). Everything is derived from stored facts:
// completion marks and the day they were ticked (`yt_completed_on`), the
// plans the engine builds, and the stored shift events with their reasons.
// Ticks from before completion dates were recorded have no day; they are
// never placed on a guessed one.

/** One camp and its own schedule (the shape of `ScopedCamp`). */
export interface InsightSource {
  camp: StudyCamp;
  result: ScheduleResult;
}

// ---------------------------------------------------------------------------
// Daily activity

export interface DayActivity {
  /** Videos ticked that day. */
  count: number;
  /** Their video length in minutes. */
  minutes: number;
}

/** The videos of the shown camps, each once (a video id may sit in two camps). */
function videosOf(sources: readonly InsightSource[]) {
  const seen = new Map<string, number>();
  for (const { camp } of sources) {
    for (const branch of camp.branches) {
      for (const video of branch.videos) {
        if (seen.has(video.id)) continue;
        const minutes = Number.isFinite(video.durationMinutes) && video.durationMinutes > 0 ? video.durationMinutes : 0;
        seen.set(video.id, minutes);
      }
    }
  }
  return seen;
}

/** Ticks per calendar day, from the recorded completion dates. */
export function activityByDay(
  sources: readonly InsightSource[],
  completedMap: Record<string, boolean>,
  completion: CompletionDates
): Map<string, DayActivity> {
  const days = new Map<string, DayActivity>();
  for (const [id, minutes] of videosOf(sources)) {
    const date = completion.dates[id];
    if (completedMap[id] !== true || !date) continue;
    const day = days.get(date) ?? { count: 0, minutes: 0 };
    day.count++;
    day.minutes += minutes;
    days.set(date, day);
  }
  return days;
}

/** Completed videos of the shown camps that have no recorded day (ticked before dates were kept). */
export function undatedCompletions(
  sources: readonly InsightSource[],
  completedMap: Record<string, boolean>,
  completion: CompletionDates
): number {
  let count = 0;
  for (const id of videosOf(sources).keys()) if (completedMap[id] === true && !completion.dates[id]) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Heatmap

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  date: string;
  count: number;
  minutes: number;
  level: HeatLevel;
  /** After today (the rest of the current week). */
  future: boolean;
}

export interface Heatmap {
  /** Week columns, oldest first; each holds Monday..Sunday. */
  weeks: HeatCell[][];
  from: string;
  to: string;
  activeDays: number;
  videos: number;
  minutes: number;
}

/**
 * The last `weekCount` calendar weeks up to today's week. A day's level
 * grows with its study minutes, relative to the busiest day shown
 * (any tick is at least level 1).
 */
export function buildHeatmap(activity: ReadonlyMap<string, DayActivity>, today: string, weekCount = 13): Heatmap {
  const firstMonday = addDays(startOfWeek(today), -7 * (weekCount - 1));
  let busiest = 0;
  for (let i = 0; i < weekCount * 7; i++) {
    const date = addDays(firstMonday, i);
    if (date > today) break;
    busiest = Math.max(busiest, activity.get(date)?.minutes ?? 0);
  }

  const weeks: HeatCell[][] = [];
  let activeDays = 0;
  let videos = 0;
  let minutes = 0;
  for (let w = 0; w < weekCount; w++) {
    const week: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(firstMonday, w * 7 + d);
      const future = date > today;
      const day = future ? undefined : activity.get(date);
      const count = day?.count ?? 0;
      const dayMinutes = day?.minutes ?? 0;
      let level: HeatLevel = 0;
      if (count > 0) {
        level = busiest > 0 ? (Math.min(4, Math.max(1, Math.ceil((4 * dayMinutes) / busiest))) as HeatLevel) : 1;
        activeDays++;
        videos += count;
        minutes += dayMinutes;
      }
      week.push({ date, count, minutes: dayMinutes, level, future });
    }
    weeks.push(week);
  }
  return { weeks, from: firstMonday, to: today, activeDays, videos, minutes };
}

// ---------------------------------------------------------------------------
// Streak

/**
 * Days on which some shown camp had study planned (not rest, mock exam or
 * free days). A study day with no tick breaks a streak; any other day
 * neither breaks nor extends it, so planned rest never costs the streak.
 */
export function studyDaysOf(sources: readonly InsightSource[]): Set<string> {
  const days = new Set<string>();
  for (const { result } of sources) {
    for (const plan of result.plans) {
      if (!plan.isRestDay && !plan.isMockExamDay && !plan.isFreeDay) days.add(plan.date);
    }
  }
  return days;
}

export interface Streak {
  /** Streak days up to today (today counts once ticked; until then it is not lost). */
  current: number;
  best: number;
  todayDone: boolean;
  todayIsStudyDay: boolean;
}

export function computeStreak(activity: ReadonlyMap<string, DayActivity>, studyDays: ReadonlySet<string>, today: string): Streak {
  const active = (date: string) => (activity.get(date)?.count ?? 0) > 0;
  const activeDates = [...activity.keys()].filter(d => d <= today && active(d)).sort();
  const todayDone = active(today);
  const todayIsStudyDay = studyDays.has(today);
  if (activeDates.length === 0) return { current: 0, best: 0, todayDone, todayIsStudyDay };

  const first = activeDates[0];
  let current = 0;
  for (let date = today; date >= first; date = addDays(date, -1)) {
    if (active(date)) current++;
    else if (date !== today && studyDays.has(date)) break;
  }

  let best = 0;
  let run = 0;
  for (let date = first; date <= today; date = addDays(date, 1)) {
    if (active(date)) run++;
    else if (date !== today && studyDays.has(date)) run = 0;
    best = Math.max(best, run);
  }
  return { current, best, todayDone, todayIsStudyDay };
}

// ---------------------------------------------------------------------------
// Commitment score

export interface Commitment {
  /** Percent of measured tasks done on (or before) their planned day; null when nothing is measured yet. */
  score: number | null;
  onTime: number;
  measured: number;
  /** Day the measurement starts (completion dates are recorded from then). */
  since: string;
}

/**
 * `(tasks done on their planned day / tasks due) * 100`.
 *
 * A task is measured once it was due: its day has passed, it was done, or
 * it was postponed. It counts as on time only when it was done on or before
 * its planned day and never postponed. Today's open tasks are not measured
 * yet. Only tasks first due from `completion.since` (and from the camp's
 * creation) on are measured: earlier ticks have no recorded day, so they
 * would count against the student unfairly.
 */
export function commitmentScore(sources: readonly InsightSource[], completion: CompletionDates, today: string): Commitment {
  let onTime = 0;
  let measured = 0;
  for (const { camp, result } of sources) {
    const windowStart = maxDateKey(completion.since, camp.createdAt);
    // A postponed task was first due on (or before) the day of its first shift.
    const firstShift = new Map<string, string>();
    for (const event of camp.shiftEvents) {
      if (event.origin === 'branch-added') continue;
      for (const id of event.itemIds) {
        const known = firstShift.get(id);
        if (!known || event.date < known) firstShift.set(id, event.date);
      }
    }
    for (const plan of result.plans) {
      for (const item of plan.items) {
        const firstDue = firstShift.get(item.id) ?? plan.date;
        if (firstDue < windowStart) continue;
        if (item.postponeCount) {
          measured++;
        } else if (item.completed) {
          const doneOn = completion.dates[item.videoId];
          if (!doneOn) continue;
          measured++;
          if (doneOn <= plan.date) onTime++;
        } else if (plan.date < today) {
          measured++;
        }
      }
    }
  }
  return { score: measured > 0 ? Math.round((onTime / measured) * 100) : null, onTime, measured, since: completion.since };
}

// ---------------------------------------------------------------------------
// Postponements

export type ReasonKey = PostponeReason | 'unspecified';

export interface ReasonShare {
  reason: ReasonKey;
  /** User shifts with this reason. */
  count: number;
  percent: number;
}

export type NamedReasonShare = ReasonShare & { reason: PostponeReason };

export interface BranchPostpones {
  subject: string;
  /** A branch with this name, for its colour. */
  playlistId: string;
  /** Times a task of this branch was carried forward (a task shifted twice counts twice). */
  count: number;
}

export interface PostponeAnalysis {
  /** The user's own shifts (app-made `branch-added` events are left out). */
  events: number;
  /** Most frequent first, only reasons that occur. */
  reasons: ReasonShare[];
  /** The most frequent reason the user named, if any. */
  topReason: NamedReasonShare | null;
  /** Most postponed first, only branches with postponements. */
  branches: BranchPostpones[];
  /**
   * The most postponed branch against the average of the other branches
   * shown (`ratio` is Infinity when no other branch was postponed). Only when
   * it clearly stands out: at least 3 postponements and 1.5 times the rest.
   */
  standout: { subject: string; count: number; ratio: number } | null;
}

export function analyzePostpones(sources: readonly InsightSource[]): PostponeAnalysis {
  const reasonCounts = new Map<ReasonKey, number>();
  const bySubject = new Map<string, BranchPostpones>();
  let events = 0;

  for (const { camp, result } of sources) {
    for (const branch of camp.branches) {
      if (!bySubject.has(branch.subject)) bySubject.set(branch.subject, { subject: branch.subject, playlistId: branch.id, count: 0 });
    }
    const itemsById = new Map<string, DailyPlanItem>();
    for (const plan of result.plans) for (const item of plan.items) itemsById.set(item.id, item);
    for (const item of result.unscheduledItems) itemsById.set(item.id, item);

    for (const event of camp.shiftEvents) {
      if (event.origin === 'branch-added') continue;
      events++;
      const key: ReasonKey = event.reason ?? 'unspecified';
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
      for (const id of new Set(event.itemIds)) {
        const item = itemsById.get(id);
        const entry = item ? bySubject.get(item.subject) : undefined;
        if (entry) entry.count++;
      }
    }
  }

  const order: ReasonKey[] = [...POSTPONE_REASONS, 'unspecified'];
  const reasons = order
    .map(reason => ({ reason, count: reasonCounts.get(reason) ?? 0 }))
    .filter(r => r.count > 0)
    .map(r => ({ ...r, percent: Math.round((r.count / events) * 100) }))
    .sort((a, b) => b.count - a.count || order.indexOf(a.reason) - order.indexOf(b.reason));
  const topReason = reasons.find((r): r is NamedReasonShare => r.reason !== 'unspecified') ?? null;

  const all = [...bySubject.values()].sort((a, b) => b.count - a.count);
  let standout: PostponeAnalysis['standout'] = null;
  const [top, ...others] = all;
  if (top && others.length > 0 && top.count >= 3) {
    const othersAverage = others.reduce((acc, b) => acc + b.count, 0) / others.length;
    const ratio = othersAverage === 0 ? Number.POSITIVE_INFINITY : top.count / othersAverage;
    if (ratio >= 1.5) standout = { subject: top.subject, count: top.count, ratio };
  }

  return { events, reasons, topReason, branches: all.filter(b => b.count > 0), standout };
}

// ---------------------------------------------------------------------------
// Everything the progress page shows

export type ChainDay = { date: string; state: 'done' | 'missed' | 'rest' | 'pending' };

export interface ProgressInsights {
  heatmap: Heatmap;
  streak: Streak;
  /** The last seven days up to today, as links of the chain. */
  chain: ChainDay[];
  commitment: Commitment;
  postpones: PostponeAnalysis;
  /** Completed videos with no recorded day. */
  undated: number;
  since: string;
}

export function progressInsights(
  sources: readonly InsightSource[],
  completedMap: Record<string, boolean>,
  completion: CompletionDates,
  today: string
): ProgressInsights {
  const activity = activityByDay(sources, completedMap, completion);
  const studyDays = studyDaysOf(sources);
  const chain = Array.from({ length: 7 }, (_, i): ChainDay => {
    const date = addDays(today, i - 6);
    if ((activity.get(date)?.count ?? 0) > 0) return { date, state: 'done' };
    if (!studyDays.has(date)) return { date, state: 'rest' };
    return { date, state: date === today ? 'pending' : 'missed' };
  });
  return {
    heatmap: buildHeatmap(activity, today),
    streak: computeStreak(activity, studyDays, today),
    chain,
    commitment: commitmentScore(sources, completion, today),
    postpones: analyzePostpones(sources),
    undated: undatedCompletions(sources, completedMap, completion),
    since: completion.since,
  };
}
