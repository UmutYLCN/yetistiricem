import { DEMO_TEMPLATES, cloneTemplate } from '../data/demoTemplates';
import type { PlannerData } from './persistence';
import { addDays, buildSchedule, defaultPreferences } from './engine';

const DEMO_TEMPLATE_IDS = ['demo-tyt-matematik', 'demo-tyt-fizik', 'demo-tyt-turkce'];

/**
 * In-memory sample plan for the demo preview. It is never written to storage.
 * It starts four days ago so past, overdue, done and upcoming days all show.
 */
export function buildDemoData(today: string): PlannerData {
  const playlists = DEMO_TEMPLATES.filter(t => DEMO_TEMPLATE_IDS.includes(t.id)).map(cloneTemplate);
  const preferences = {
    ...defaultPreferences,
    dailyStudyHours: 3,
    playbackSpeed: 1.25,
    practiceMultiplier: 0.2,
    startDate: addDays(today, -4),
  };
  const { plans } = buildSchedule(playlists, preferences, { today });

  const completedMap: Record<string, boolean> = {};
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
      }
    } else if (plan.date === today && plan.items[0]) {
      completedMap[plan.items[0].videoId] = true;
    }
  }

  return {
    preferences,
    playlists,
    completedMap,
    shiftEvents: [],
    dayNotes: {
      [today]: 'Demo notu: Her konudan sonra 15–20 soru çöz, yanlışlarını deftere yaz.',
    },
  };
}
