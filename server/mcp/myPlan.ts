// What the student's plan says, for an AI that coaches them: each camp's
// progress against its schedule, the days ahead, and the habits the Progress
// page shows (streak, on-time share, postponement reasons). Built with the
// app's own engine and insight code from the plan saved in their account, so
// the numbers match what the app shows.
import type { PlannerData } from '../../src/lib/persistence.ts';
import type { InsightSource } from '../../src/lib/insights.ts';
import { activityByDay, progressInsights } from '../../src/lib/insights.ts';
import { addDays, dayOfWeek } from '../../src/utils/date.ts';
import { buildCampSchedule } from '../../src/utils/roadmapEngine.ts';

const REASON_LABELS: Record<string, string> = {
  distraction: 'social media / distraction',
  difficult: 'the lesson felt hard',
  exhausted: 'tired / low energy',
  emergency: 'no time / something came up',
  low_motivation: 'low motivation',
  unspecified: 'no reason given',
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;
const hours = (minutes: number) => round(minutes / 60);

function sourcesOf(data: PlannerData, today: string): InsightSource[] {
  return data.camps
    .filter(camp => camp.branches.some(b => b.videos.length > 0))
    .map(camp => ({ camp, result: buildCampSchedule(camp, { today, completedMap: data.completedMap }) }));
}

function campSummary({ camp, result }: InsightSource, today: string) {
  const items = result.plans.flatMap(plan => plan.items.map(item => ({ item, date: plan.date })));
  const open = items.filter(s => !s.item.completed);
  const overdue = open.filter(s => s.date < today);
  const todays = items.filter(s => s.date === today);
  const finishDate = open.at(-1)?.date ?? null;
  const target = camp.schedule.targetEndDate;
  const s = camp.schedule;
  return {
    name: camp.name,
    createdAt: camp.createdAt,
    startDate: s.startDate,
    tempo: {
      mode: s.mode,
      dailyStudyHours: s.dailyStudyHours,
      playbackSpeed: s.playbackSpeed,
      practiceMultiplier: s.practiceMultiplier,
      studyDays: s.activeDays.map(d => WEEKDAYS[d]),
      mockExamDays: s.mockExamDays.map(d => WEEKDAYS[d]),
    },
    branches: camp.branches.map(b => {
      const own = items.filter(x => x.item.playlistId === b.id);
      return { subject: b.subject, done: own.filter(x => x.item.completed).length, total: own.length };
    }),
    tasks: { done: items.length - open.length, total: items.length, percent: items.length ? Math.round(((items.length - open.length) / items.length) * 100) : 0 },
    remainingHours: hours(open.reduce((acc, x) => acc + x.item.effectiveMinutes, 0)),
    overdue: { tasks: overdue.length, hours: hours(overdue.reduce((acc, x) => acc + x.item.effectiveMinutes, 0)), since: overdue[0]?.date ?? null },
    today: { tasks: todays.length, done: todays.filter(x => x.item.completed).length, hours: hours(todays.reduce((acc, x) => acc + x.item.effectiveMinutes, 0)) },
    finishDate,
    targetDate: target,
    onTrack: target && finishDate ? finishDate <= target : null,
    postponements: camp.shiftEvents.filter(e => !e.origin).length,
  };
}

/** The student's standing: every camp, and their habits over all camps. */
export function progressOverview(data: PlannerData, today: string) {
  const sources = sourcesOf(data, today);
  const insights = progressInsights(sources, data.completedMap, data.completionDates, today);
  const activity = activityByDay(sources, data.completedMap, data.completionDates);
  const lastDays = (n: number) => {
    let videos = 0;
    let minutes = 0;
    for (let i = 0; i < n; i++) {
      const day = activity.get(addDays(today, -i));
      videos += day?.count ?? 0;
      minutes += day?.minutes ?? 0;
    }
    return { videos, hours: hours(minutes) };
  };
  const focusWeek = data.focusSessions.filter(f => f.date > addDays(today, -7));
  const notes = Object.entries(data.dayNotes)
    .filter(([date, note]) => date > addDays(today, -14) && note.trim())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7)
    .map(([date, note]) => ({ date, note: note.trim().slice(0, 300) }));

  return {
    today,
    camps: sources.map(source => campSummary(source, today)),
    emptyCamps: data.camps.filter(c => !sources.some(s => s.camp.id === c.id)).map(c => c.name),
    habits: {
      streak: { current: insights.streak.current, best: insights.streak.best, todayDone: insights.streak.todayDone, todayIsStudyDay: insights.streak.todayIsStudyDay },
      lastSevenDays: insights.chain.map(d => `${d.date} ${d.state}`),
      studied: { last7Days: lastDays(7), last30Days: lastDays(30) },
      onTimeShare: {
        percent: insights.commitment.score,
        onTime: insights.commitment.onTime,
        measured: insights.commitment.measured,
        since: insights.commitment.since,
      },
      postponements: {
        total: insights.postpones.events,
        reasons: insights.postpones.reasons.map(r => ({ reason: REASON_LABELS[r.reason] ?? r.reason, count: r.count, percent: r.percent })),
        mostPostponedBranches: insights.postpones.branches.slice(0, 5).map(b => ({ subject: b.subject, count: b.count })),
      },
      focusMode: { sessions: focusWeek.length, hours: hours(focusWeek.reduce((acc, f) => acc + f.watchedSeconds / 60, 0)), finished: focusWeek.filter(f => f.ended).length },
    },
    recentNotes: notes,
  };
}

export interface PlanDay {
  date: string;
  weekday: string;
  kind: 'study' | 'rest' | 'mock';
  tasks: { camp: string; subject: string; title: string; minutes: number; done: boolean; postponed: number }[];
}

/** The tasks of `days` days from `from`, every camp together; with `from` = today, overdue ones come first. */
export function planDays(data: PlannerData, today: string, from: string, days: number): { overdue: PlanDay['tasks']; days: PlanDay[] } {
  const until = addDays(from, days - 1);
  const byDate = new Map<string, PlanDay>();
  const overdue: PlanDay['tasks'] = [];
  for (const { camp, result } of sourcesOf(data, today)) {
    const subjectOf = new Map(camp.branches.map(b => [b.id, b.subject]));
    for (const plan of result.plans) {
      const task = (item: (typeof plan.items)[number]) => ({
        camp: camp.name,
        subject: subjectOf.get(item.playlistId) ?? item.subject,
        title: item.title,
        minutes: round(item.effectiveMinutes),
        done: item.completed,
        postponed: item.postponeCount ?? 0,
      });
      if (plan.date < today && from === today) overdue.push(...plan.items.filter(i => !i.completed).map(task));
      if (plan.date < from || plan.date > until) continue;
      const day: PlanDay = byDate.get(plan.date) ?? { date: plan.date, weekday: WEEKDAY_NAMES[dayOfWeek(plan.date)], kind: plan.isMockExamDay ? 'mock' : plan.isRestDay ? 'rest' : 'study', tasks: [] };
      if (plan.items.length > 0) day.kind = 'study';
      day.tasks.push(...plan.items.map(task));
      byDate.set(plan.date, day);
    }
  }
  const list = Array.from({ length: days }, (_, i) => addDays(from, i)).map((date): PlanDay => byDate.get(date) ?? { date, weekday: WEEKDAY_NAMES[dayOfWeek(date)], kind: 'rest', tasks: [] });
  return { overdue, days: list };
}
