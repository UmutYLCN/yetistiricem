import type { RoadmapStats, StudyCamp, UserPreferences } from '../types/index.ts';
import { buildDemoData } from './demo.ts';
import { addDays, buildCampSchedule, calculateStats, countCompletedVideos } from './engine.ts';
import { weekKeys } from './format.ts';
import type { CampInfo, DaySummary, PlanIndex } from './planView.ts';
import { indexCamps, indexPlans, summarizeDay } from './planView.ts';

// The landing page's product shots: the demo camp (`buildDemoData`) run
// through the real engine, so the page shows what "Demo ile göz at" opens.

export interface LandingPreview {
  today: string;
  camp: StudyCamp;
  /** The day on show: today, or the next day with tasks when today has none (e.g. a rest day). */
  day: DaySummary;
  /** The week of `day`, Monday first. */
  week: DaySummary[];
  /** Whichever of that week and the next has more days with tasks, for pictures of the weekly rhythm. */
  rhythmWeek: DaySummary[];
  index: PlanIndex;
  stats: RoadmapStats;
  prefs: UserPreferences;
  branches: Map<string, CampInfo>;
}

/** `alsoDone`: videos to show as completed on top of the demo's own progress. */
export function buildLandingPreview(today: string, alsoDone: readonly string[] = []): LandingPreview {
  const data = buildDemoData(today);
  const camp = data.camps[0];
  const completedMap = { ...data.completedMap };
  for (const videoId of alsoDone) completedMap[videoId] = true;

  const schedule = buildCampSchedule(camp, { completedMap, today });
  const index = indexPlans(schedule.plans, today);
  const prefs = schedule.preferences;
  const shownDate =
    Array.from({ length: 7 }, (_, offset) => addDays(today, offset)).find(date => summarizeDay(date, index, prefs).total > 0) ?? today;
  const totalVideos = camp.branches.reduce((acc, b) => acc + b.videos.length, 0);
  const week = weekKeys(shownDate).map(date => summarizeDay(date, index, prefs));
  const nextWeek = weekKeys(addDays(shownDate, 7)).map(date => summarizeDay(date, index, prefs));
  const planned = (days: DaySummary[]) => days.filter(d => d.total > 0).length;

  return {
    today,
    camp,
    day: summarizeDay(shownDate, index, prefs),
    week,
    rhythmWeek: planned(nextWeek) > planned(week) ? nextWeek : week,
    index,
    stats: calculateStats(schedule.plans, totalVideos, countCompletedVideos(camp.branches, completedMap)),
    prefs,
    branches: indexCamps(camp.branches),
  };
}
