import type { StudyCamp } from '../types';
import { DEMO_TEMPLATES, cloneTemplate } from '../data/demoTemplates.ts';
import type { PlannerData } from './persistence';
import { addDays, buildCampSchedule } from './engine.ts';
import { defaultSchedule } from './studyCamp.ts';

const DEMO_TEMPLATE_IDS = ['demo-tyt-matematik', 'demo-tyt-fizik', 'demo-tyt-turkce'];

/**
 * In-memory sample camp for the demo preview. It is never written to storage.
 * It starts four days ago so past, overdue, done and upcoming days all show.
 */
export function buildDemoData(today: string): PlannerData {
  const branches = DEMO_TEMPLATES.filter(t => DEMO_TEMPLATE_IDS.includes(t.id)).map(cloneTemplate);
  const camp: StudyCamp = {
    id: 'demo-camp',
    name: 'Demo: TYT kampı',
    createdAt: today,
    branches,
    schedule: {
      ...defaultSchedule(addDays(today, -4)),
      dailyStudyHours: 3,
      playbackSpeed: 1.25,
      practiceMultiplier: 0.2,
      targetEndDate: addDays(today, 40),
    },
    shiftEvents: [],
  };
  const { plans } = buildCampSchedule(camp, { today });

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
    camps: [camp],
    activeCampId: camp.id,
    completedMap,
    dayNotes: {
      [today]: 'Demo notu: Her konudan sonra 15–20 soru çöz, yanlışlarını deftere yaz.',
    },
  };
}
