import type { DailyPlan, SubjectPlaylist, UserPreferences } from '../src/types/index.ts';

export function playlist(id: string, durations: number[], subject: string = id): SubjectPlaylist {
  return {
    id,
    title: `${id} kampı`,
    subject,
    channelName: 'Kanal',
    playlistUrl: `https://youtube.com/playlist?list=${id}`,
    colorTag: 'bg-indigo-500',
    totalDurationMinutes: durations.reduce((a, b) => a + b, 0),
    videos: durations.map((durationMinutes, i) => ({
      id: `${id}-${i + 1}`,
      title: `${id} ders ${i + 1}`,
      durationMinutes,
      videoUrl: `https://youtube.com/watch?v=${id}${i + 1}`,
      thumbnailUrl: '',
      completed: false,
    })),
  };
}

export const repeat = (n: number, minutes: number) => Array.from({ length: n }, () => minutes);

/** Every weekday is a study day, 2 hours a day, no speed-up or practice. */
export function prefs(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    dailyStudyHours: 2,
    playbackSpeed: 1,
    practiceMultiplier: 0,
    maxSubjectsPerDay: 10,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    restDays: [],
    mockExamDays: [],
    startDate: '2026-09-21', // Monday
    ...overrides,
  };
}

/** item id -> date */
export function dateById(plans: DailyPlan[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const plan of plans) for (const item of plan.items) map.set(item.id, plan.date);
  return map;
}

export function allIds(plans: DailyPlan[]): string[] {
  return plans.flatMap(p => p.items.map(i => i.id));
}

/** The layout without completion flags. */
export function layout(plans: DailyPlan[]) {
  return plans.map(p => ({
    date: p.date,
    isRestDay: p.isRestDay,
    isMockExamDay: p.isMockExamDay,
    items: p.items.map(i => i.id),
  }));
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
