import type { DailyPlan, DailyPlanItem, RoadmapStats, ShiftEvent, StudyCamp, UserPreferences } from '../types';
import type { DeadlineStatus, ScheduleResult } from './engine.ts';
import { assessDeadline, buildCampSchedule, calculateStats, countCompletedVideos, createShiftEvent } from './engine.ts';
import type { DayKind, DaySummary, PlanIndex } from './planView.ts';
import { dayKindFor, daySummaryOf, indexPlans, planKind } from './planView.ts';

// "Tüm Kamplar": the plan screens show several camps as one date-ordered flow.
// Each camp keeps its own schedule (start and target dates, daily time, weekly
// form, shift events) and is built alone with `buildCampSchedule`; only the
// finished days are merged by date. Capacities and shift histories are never
// combined, and a shift is stored on the camp that owns the tasks.

/**
 * What the plan screens show. `all` is a view scope, never a camp id: the camp
 * that Kamplar manages (`activeCampId`) is always a real camp.
 */
export type CampScope = 'all' | 'camp';

export function isCampScope(value: unknown): value is CampScope {
  return value === 'all' || value === 'camp';
}

/** "Tüm Kamplar" is offered once there are two camps to combine. */
export function offersAllCamps(campCount: number): boolean {
  return campCount >= 2;
}

/**
 * The scope in effect. With two or more camps the view is combined unless the
 * user picked one camp (`stored === 'camp'`); with fewer there is nothing to
 * combine, so a stored `all` falls back to the one camp without being lost.
 */
export function resolveCampScope(campCount: number, stored: CampScope | null): CampScope {
  return offersAllCamps(campCount) && stored !== 'camp' ? 'all' : 'camp';
}

/**
 * Camps the combined view includes: the ones with a plan, i.e. at least one
 * video (the same rule that shows "Bu kampta branş yok" for a single camp).
 * Finished and not yet started camps take part with their own dates.
 */
export function campsWithPlans(camps: readonly StudyCamp[]): StudyCamp[] {
  return camps.filter(c => c.branches.some(b => b.videos.length > 0));
}

// ---------------------------------------------------------------------------
// Merging days

/** A task in the combined view: the camp's own item plus the camp it belongs to. */
export interface CampPlanItem extends DailyPlanItem {
  campId: string;
}

/** The camp of a task from the combined view; null for a one-camp task. */
export function campIdOf(item: DailyPlanItem): string | null {
  return 'campId' in item && typeof item.campId === 'string' ? item.campId : null;
}

/** One camp's own day inside a merged day. */
export interface CampDay {
  campId: string;
  /** The camp's plan of that day, exactly as its own schedule built it. */
  plan: DailyPlan;
  items: CampPlanItem[];
}

/**
 * A calendar day across camps. `items` are the camps' tasks in camp order.
 * It is a study day when any camp studies; otherwise a mock exam day if any
 * camp has one, else a rest day. `camps` keeps each camp's own day type.
 */
export interface MergedDailyPlan extends DailyPlan {
  items: CampPlanItem[];
  /** Camps whose plan covers this day, in camp order. */
  camps: CampDay[];
}

export interface CampPlans {
  campId: string;
  plans: readonly DailyPlan[];
}

function mergeDay(date: string, days: CampDay[]): MergedDailyPlan {
  const items = days.flatMap(d => d.items);
  const studying = days.filter(d => planKind(d.plan) === 'study');
  const offKind: DayKind | null = studying.length > 0 ? null : days.some(d => d.plan.isMockExamDay) ? 'mock' : 'rest';
  const first = days[0].plan;
  return {
    date,
    dayName: first.dayName,
    isToday: first.isToday,
    isPast: first.isPast,
    isRestDay: offKind === 'rest',
    isMockExamDay: offKind === 'mock',
    ...(items.length === 0 && studying.length > 0 && studying.every(d => d.plan.isFreeDay) ? { isFreeDay: true } : {}),
    items,
    totalMinutes: items.reduce((acc, item) => acc + item.effectiveMinutes, 0),
    isAllCompleted: items.length > 0 && items.every(item => item.completed),
    camps: days,
  };
}

/**
 * Combines camps' finished plans by date. Pure: the inputs are not changed and
 * nothing is rescheduled, so every task stays on the day its own camp gave it.
 * A day only lists the camps whose plan covers it (not before a camp starts or
 * after it ends). The result is sorted by date.
 */
export function mergeDailyPlans(sources: readonly CampPlans[]): MergedDailyPlan[] {
  const byDate = new Map<string, CampDay[]>();
  for (const { campId, plans } of sources) {
    for (const plan of plans) {
      const day: CampDay = { campId, plan, items: plan.items.map(item => ({ ...item, campId })) };
      const days = byDate.get(plan.date);
      if (days) days.push(day);
      else byDate.set(plan.date, [day]);
    }
  }
  return [...byDate.keys()].sort().map(date => mergeDay(date, byDate.get(date)!));
}

// ---------------------------------------------------------------------------
// Screens

/** One camp's share of a merged day, for the day list and the week cards. */
export interface CampDaySummary {
  campId: string;
  /** The camp's own day type. */
  kind: DayKind;
  /** Manual camp: this weekday's branches have nothing left. */
  free: boolean;
  items: CampPlanItem[];
  total: number;
  done: number;
  minutes: number;
  doneMinutes: number;
}

function campDaySummary(day: CampDay): CampDaySummary {
  const { total, done, minutes, doneMinutes } = daySummaryOf(day.plan.date, day.plan, planKind(day.plan));
  return { campId: day.campId, kind: planKind(day.plan), free: day.plan.isFreeDay === true, items: day.items, total, done, minutes, doneMinutes };
}

/**
 * A combined day with no camp on a study day (each one rests or has a mock
 * exam): the only day that gets a full empty-day state. A camp on a free or
 * shifted study day has no tasks either, but it is not off, so such a day
 * lists every camp's own day type instead.
 */
export function everyCampOff(parts: readonly Pick<CampDaySummary, 'kind'>[]): boolean {
  return parts.every(part => part.kind !== 'study');
}

/** Same precedence as a merged day: any study day wins, then a mock exam day. */
export function combineDayKinds(kinds: readonly DayKind[]): DayKind {
  if (kinds.includes('study')) return 'study';
  if (kinds.includes('mock')) return 'mock';
  return 'rest';
}

/**
 * `summarizeDay` for the combined view: totals over every camp plus each
 * camp's own share. A day no camp's plan covers takes its type from the camps'
 * weekly rhythms, as a single camp does outside its plan.
 */
export function summarizeAllCampsDay(date: string, index: PlanIndex<MergedDailyPlan>, prefs: readonly UserPreferences[]): DaySummary {
  const plan = index.byDate.get(date);
  if (!plan) return { ...daySummaryOf(date, undefined, combineDayKinds(prefs.map(p => dayKindFor(date, p)))), camps: [] };
  return { ...daySummaryOf(date, plan, planKind(plan)), camps: plan.camps.map(campDaySummary) };
}

export interface ScopedCamp {
  camp: StudyCamp;
  /** The camp's own schedule. */
  result: ScheduleResult;
}

/** How the combined view names a camp and shows its own daily goal. */
export interface CampLabel {
  id: string;
  name: string;
  /** The camp's daily study time (its day capacity), in minutes. */
  dailyMinutes: number;
  playbackSpeed: number;
}

export function campLabelsOf(camps: readonly ScopedCamp[]): Map<string, CampLabel> {
  return new Map(
    camps.map(({ camp, result }) => [
      camp.id,
      { id: camp.id, name: camp.name, dailyMinutes: result.capacityMinutes, playbackSpeed: result.preferences.playbackSpeed },
    ])
  );
}

export interface AllCampsPlan {
  camps: ScopedCamp[];
  plans: MergedDailyPlan[];
  index: PlanIndex<MergedDailyPlan>;
  stats: RoadmapStats;
}

/** Stats over some camps' plans (one camp, or a merged plan of several). */
export function statsFor(camps: readonly StudyCamp[], plans: DailyPlan[], completedMap: Record<string, boolean>): RoadmapStats {
  const branches = camps.flatMap(c => c.branches);
  const total = branches.reduce((acc, b) => acc + b.videos.length, 0);
  return calculateStats(plans, total, countCompletedVideos(branches, completedMap));
}

/** One camp's own progress in the combined İlerleme view. */
export interface CampOverview extends ScopedCamp {
  stats: RoadmapStats;
  /** Against the camp's own target date; null once every video is done. */
  deadline: DeadlineStatus | null;
}

export function campOverview({ camp, result }: ScopedCamp, completedMap: Record<string, boolean>): CampOverview {
  const stats = statsFor([camp], result.plans, completedMap);
  const finished = stats.totalVideos > 0 && stats.completedVideos === stats.totalVideos;
  const deadline = finished
    ? null
    : assessDeadline({
        finishDate: stats.estimatedFinishDate,
        targetEndDate: camp.schedule.targetEndDate,
        unscheduledCount: result.unscheduledItems.length,
      });
  return { camp, result, stats, deadline };
}

/** Every camp with a plan, each built with its own schedule, then merged by date. */
export function buildAllCampsPlan(camps: readonly StudyCamp[], options: { completedMap: Record<string, boolean>; today: string }): AllCampsPlan {
  const scoped = campsWithPlans(camps).map(camp => ({ camp, result: buildCampSchedule(camp, options) }));
  const plans = mergeDailyPlans(scoped.map(({ camp, result }) => ({ campId: camp.id, plans: result.plans })));
  return {
    camps: scoped,
    plans,
    index: indexPlans(plans, options.today),
    stats: statsFor(scoped.map(s => s.camp), plans, options.completedMap),
  };
}

// ---------------------------------------------------------------------------
// Shifting

export interface CampShift {
  campId: string;
  event: ShiftEvent;
}

/**
 * "Kalanları ileri taşı" for `date` across camps: one stored event per camp
 * that still has unfinished tasks on or before `date`, made from that camp's
 * own plan. So an event only ever names its own camp's tasks, and a camp with
 * nothing to carry gets no event and keeps its plan.
 */
export function shiftEventsByCamp(sources: readonly CampPlans[], date: string, today: string): CampShift[] {
  return sources.flatMap(({ campId, plans }) => {
    const event = createShiftEvent(date, [...plans], today);
    return event ? [{ campId, event }] : [];
  });
}
