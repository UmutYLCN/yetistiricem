import type { CampSchedule, StudyCamp, SubjectPlaylist } from '../../src/types/index.ts';
import { playlist, prefs, repeat } from '../helpers.ts';

// Camps as they are stored today: no `tempoHistory`. `layout-before-tempo-history.json`
// holds what the engine laid out for each of them before tempo history existed
// (generated once from that engine, at 7214c6a); tests/tempoChange.test.ts checks the
// current engine still lays them out identically.

export interface LayoutScenario {
  name: string;
  camp: Pick<StudyCamp, 'branches' | 'schedule' | 'shiftEvents'>;
  completedMap: Record<string, boolean>;
  today: string;
}

const week = (): string[][] => [[], [], [], [], [], [], []];

function schedule(overrides: Partial<CampSchedule> = {}): CampSchedule {
  return { ...prefs(), mode: 'auto', targetEndDate: null, weekPlan: week(), ...overrides };
}

const tyt = (): SubjectPlaylist[] => [
  playlist('mat', repeat(8, 40), 'Matematik'),
  playlist('fiz', repeat(6, 50), 'Fizik'),
  playlist('kim', repeat(5, 30), 'Kimya'),
];

const ticked = (...ids: string[]) => Object.fromEntries(ids.map(id => [id, true]));

export const layoutScenarios: LayoutScenario[] = [
  {
    name: 'auto, Sunday rest, three branches a day',
    camp: { branches: tyt(), schedule: schedule({ activeDays: [1, 2, 3, 4, 5, 6], restDays: [0], maxSubjectsPerDay: 3 }), shiftEvents: [] },
    completedMap: ticked('mat-1', 'fiz-1', 'kim-1', 'mat-2'),
    today: '2026-09-23',
  },
  {
    name: 'auto, two branches a day, speed and practice share, mock Saturday',
    camp: {
      branches: tyt(),
      schedule: schedule({ playbackSpeed: 1.25, practiceMultiplier: 0.2, maxSubjectsPerDay: 2, activeDays: [1, 2, 3, 4, 5], restDays: [0], mockExamDays: [6] }),
      shiftEvents: [],
    },
    completedMap: {},
    today: '2026-09-28',
  },
  {
    name: 'auto with a red-card shift, a today shift and a branch-added event',
    camp: {
      branches: [...tyt(), playlist('bio', repeat(3, 35), 'Biyoloji')],
      schedule: schedule({ activeDays: [1, 2, 3, 4, 5, 6], restDays: [0], maxSubjectsPerDay: 3 }),
      shiftEvents: [
        { date: '2026-09-22', resumeDate: '2026-09-23', itemIds: ['mat-2', 'fiz-2', 'kim-2'], reason: 'exhausted' },
        { date: '2026-09-24', resumeDate: '2026-09-25', itemIds: ['mat-4', 'fiz-4'] },
        { date: '2026-09-25', resumeDate: '2026-09-26', itemIds: ['bio-1', 'bio-2'], origin: 'branch-added' },
      ],
    },
    completedMap: ticked('mat-1', 'fiz-1', 'kim-1', 'mat-2', 'fiz-2', 'kim-2', 'mat-3'),
    today: '2026-09-25',
  },
  {
    name: 'auto with a red-card shift that kept a task ticked that day',
    camp: {
      branches: tyt(),
      schedule: schedule({ activeDays: [1, 2, 3, 4, 5, 6], restDays: [0], maxSubjectsPerDay: 3 }),
      shiftEvents: [{ date: '2026-09-23', resumeDate: '2026-09-24', itemIds: ['mat-3', 'mat-4'], keepOnResume: ['fiz-4', 'kim-4'], reason: 'distraction' }],
    },
    completedMap: ticked('mat-1', 'fiz-1', 'kim-1', 'mat-2', 'fiz-2', 'kim-2', 'fiz-3', 'kim-3', 'fiz-4', 'kim-4'),
    today: '2026-09-25',
  },
  {
    name: 'manual week with free days and a branch on no weekday',
    camp: {
      branches: [playlist('geo', repeat(4, 45), 'Geometri'), playlist('kim', repeat(9, 30), 'Kimya'), playlist('tar', repeat(3, 20), 'Tarih')],
      schedule: schedule({
        mode: 'manual',
        dailyStudyHours: 1.5,
        weekPlan: [[], ['geo'], [], ['kim'], [], ['geo', 'kim'], []],
        activeDays: [1, 3, 5],
        restDays: [0, 2, 4, 6],
      }),
      shiftEvents: [{ date: '2026-09-23', resumeDate: '2026-09-24', itemIds: ['kim-1', 'kim-2'], reason: 'difficult' }],
    },
    completedMap: ticked('geo-1'),
    today: '2026-09-24',
  },
  {
    name: 'oversized videos and a repeated video',
    camp: {
      branches: [
        playlist('uzun', [150, 30, 200, 20], 'Uzun'),
        playlist('kisa', repeat(6, 25), 'Kısa'),
        { ...playlist('tekrar', [30, 30], 'Tekrar'), videos: playlist('kisa', [25, 25]).videos },
      ],
      schedule: schedule({ dailyStudyHours: 2 }),
      shiftEvents: [],
    },
    completedMap: ticked('uzun-1'),
    today: '2026-09-22',
  },
  {
    name: 'no study weekday',
    camp: { branches: tyt(), schedule: schedule({ activeDays: [], restDays: [0, 1, 2, 3, 4, 5, 6] }), shiftEvents: [] },
    completedMap: {},
    today: '2026-09-22',
  },
  {
    name: 'invalid stored hours fall back to the default',
    camp: { branches: tyt(), schedule: schedule({ dailyStudyHours: -1 }), shiftEvents: [] },
    completedMap: {},
    today: '2026-09-22',
  },
];
