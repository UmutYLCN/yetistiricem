import type { StudyCamp } from '../types';
import { DEMO_TEMPLATES, cloneTemplate } from '../data/demoTemplates.ts';
import type { PlannerData } from './persistence';
import { addDays, buildCampSchedule } from './engine.ts';
import { defaultSchedule } from './studyCamp.ts';

const DEMO_TEMPLATE_IDS = ['demo-tyt-matematik', 'demo-tyt-fizik', 'demo-tyt-turkce'];

/**
 * In-memory sample camp for the demo preview. It is never written to storage.
 * It starts four days ago so past, overdue, done and upcoming days all show.
 * Its sample ticks are dated on their planned day, so the progress page has
 * something to show; the demo banner labels all of it as sample data.
 */
export function buildDemoData(today: string): PlannerData {
  const branches = DEMO_TEMPLATES.filter(t => DEMO_TEMPLATE_IDS.includes(t.id)).map(cloneTemplate);
  const start = addDays(today, -4);
  const camp: StudyCamp = {
    id: 'demo-camp',
    name: 'Demo: TYT kampı',
    // Made when it started, like a real camp; the commitment score measures from here.
    createdAt: start,
    branches,
    schedule: {
      ...defaultSchedule(start),
      dailyStudyHours: 3,
      playbackSpeed: 1.25,
      practiceMultiplier: 0.2,
      targetEndDate: addDays(today, 40),
    },
    shiftEvents: [],
  };
  const { plans } = buildCampSchedule(camp, { today });

  const completedMap: Record<string, boolean> = {};
  const dates: Record<string, string> = {};
  let leftOpen = 0;
  for (const plan of plans) {
    if (plan.date < today) {
      for (const item of plan.items) {
        // Leave the last task of the most recent past study days open, so the
        // catch-up flow has something to show.
        const isLast = item === plan.items[plan.items.length - 1];
        if (isLast && plan.date >= addDays(today, -2) && leftOpen < 2) {
          leftOpen++;
          continue;
        }
        completedMap[item.videoId] = true;
        dates[item.videoId] = plan.date;
      }
    } else if (plan.date === today && plan.items[0]) {
      completedMap[plan.items[0].videoId] = true;
      dates[plan.items[0].videoId] = today;
    }
  }

  return {
    camps: [camp],
    activeCampId: camp.id,
    completedMap,
    completionDates: { since: camp.schedule.startDate, dates },
    focusSessions: [],
    dayNotes: {
      [today]: 'Demo notu: Her konudan sonra 15–20 soru çöz, yanlışlarını deftere yaz.',
    },
  };
}
