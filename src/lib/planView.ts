import type { DailyPlan, DailyPlanItem, SubjectPlaylist, UserPreferences } from '../types';
import type { CampKind } from './camps';
import { classifyCamp, displayChannel } from './camps';
import { dayOfWeek } from './engine';
import { startOfWeek } from './format';
import type { SubjectColor } from './subjects';
import { resolveColor } from './subjects';

// Read-only views over the engine's plan, shaped for the screens.

export interface CampInfo {
  camp: SubjectPlaylist;
  kind: CampKind;
  color: SubjectColor;
  channel: string | null;
}

export function indexCamps(playlists: SubjectPlaylist[]): Map<string, CampInfo> {
  return new Map(
    playlists.map(camp => {
      const kind = classifyCamp(camp);
      return [camp.id, { camp, kind, color: resolveColor(camp.colorTag, camp.subject), channel: displayChannel(camp, kind) }];
    })
  );
}

export interface ScheduledItem {
  item: DailyPlanItem;
  date: string;
}

export interface PlanIndex {
  byDate: Map<string, DailyPlan>;
  /** First and last planned day (study or not), or null with no plan. */
  firstDate: string | null;
  lastDate: string | null;
  /** Every scheduled item in date order. */
  items: ScheduledItem[];
  /** Incomplete items on days before today. */
  overdue: ScheduledItem[];
}

export function indexPlans(plans: DailyPlan[], today: string): PlanIndex {
  const sorted = [...plans].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byDate = new Map(sorted.map(p => [p.date, p]));
  const items = sorted.flatMap(plan => plan.items.map(item => ({ item, date: plan.date })));
  return {
    byDate,
    firstDate: sorted[0]?.date ?? null,
    lastDate: sorted[sorted.length - 1]?.date ?? null,
    items,
    overdue: items.filter(s => s.date < today && !s.item.completed),
  };
}

export type DayKind = 'study' | 'rest' | 'mock';

/** Same precedence as the engine: mock exam, then rest, then study. */
export function dayKindFor(date: string, prefs: UserPreferences): DayKind {
  const dow = dayOfWeek(date);
  if (prefs.mockExamDays.includes(dow)) return 'mock';
  if (prefs.restDays.includes(dow) || !prefs.activeDays.includes(dow)) return 'rest';
  return 'study';
}

export interface DaySummary {
  date: string;
  plan: DailyPlan | undefined;
  kind: DayKind;
  total: number;
  done: number;
  minutes: number;
  doneMinutes: number;
}

export function summarizeDay(date: string, index: PlanIndex, prefs: UserPreferences): DaySummary {
  const plan = index.byDate.get(date);
  const kind: DayKind = plan ? (plan.isMockExamDay ? 'mock' : plan.isRestDay ? 'rest' : 'study') : dayKindFor(date, prefs);
  const items = plan?.items ?? [];
  const doneItems = items.filter(i => i.completed);
  return {
    date,
    plan,
    kind,
    total: items.length,
    done: doneItems.length,
    minutes: items.reduce((acc, i) => acc + i.effectiveMinutes, 0),
    doneMinutes: doneItems.reduce((acc, i) => acc + i.effectiveMinutes, 0),
  };
}

/** The next incomplete tasks from today on. */
export function nextUp(index: PlanIndex, today: string, limit: number): ScheduledItem[] {
  return index.items.filter(s => s.date >= today && !s.item.completed).slice(0, limit);
}

export interface CampProgress {
  total: number;
  done: number;
  remainingMinutes: number;
  /** Day of the camp's last incomplete task. */
  finishDate: string | null;
  /** Day of the camp's next incomplete task. */
  nextDate: string | null;
}

export function campProgress(campId: string, index: PlanIndex): CampProgress {
  const own = index.items.filter(s => s.item.playlistId === campId);
  const open = own.filter(s => !s.item.completed);
  return {
    total: own.length,
    done: own.length - open.length,
    remainingMinutes: open.reduce((acc, s) => acc + s.item.effectiveMinutes, 0),
    finishDate: open[open.length - 1]?.date ?? null,
    nextDate: open[0]?.date ?? null,
  };
}

export interface WeekOverview {
  monday: string;
  planned: number;
  done: number;
  minutes: number;
}

export function weeksOverview(index: PlanIndex): WeekOverview[] {
  const weeks = new Map<string, WeekOverview>();
  for (const { item, date } of index.items) {
    const monday = startOfWeek(date);
    const week = weeks.get(monday) ?? { monday, planned: 0, done: 0, minutes: 0 };
    week.planned++;
    if (item.completed) week.done++;
    week.minutes += item.effectiveMinutes;
    weeks.set(monday, week);
  }
  return [...weeks.values()].sort((a, b) => (a.monday < b.monday ? -1 : 1));
}
