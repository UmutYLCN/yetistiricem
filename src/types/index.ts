export interface Video {
  id: string;
  title: string;
  durationMinutes: number;
  videoUrl: string;
  thumbnailUrl: string;
  completed: boolean;
  /** The uploading channel, as YouTube reported it (playlist imports only). */
  channelName?: string;
}

/**
 * One branch of a study camp (e.g. Matematik): an ordered list of videos,
 * usually one YouTube playlist. Older versions called each of these a "camp";
 * the shape is unchanged so stored data and backups keep working.
 * `subject` is the branch name shown in the plan, `title` the source list's name.
 */
export interface SubjectPlaylist {
  id: string;
  title: string;
  subject: string;
  channelName: string;
  playlistUrl: string;
  videos: Video[];
  colorTag: string;
  totalDurationMinutes: number;
  /**
   * Where the branch came from. `manual`: videos the user entered or imported
   * from a YouTube playlist (real links and durations). `demo-template`:
   * a built-in sample topic list with no video links. Missing on data saved by
   * older versions (see `src/lib/camps.ts` for how those are classified).
   */
  source?: 'manual' | 'demo-template';
}

export interface UserPreferences {
  dailyStudyHours: number;
  playbackSpeed: number; // 1, 1.25, 1.5, 1.75, 2
  practiceMultiplier: number; // extra time allocated for practice, e.g. 0.5 for 50% more time
  /** Most distinct branches (subjects) on one study day, in automatic mode. */
  maxSubjectsPerDay: number;
  activeDays: number[]; // 0 for Sunday, 1 for Monday, etc.
  restDays: number[];
  mockExamDays: number[]; // e.g. Sunday
  startDate: string; // local YYYY-MM-DD
}

/** Durable record of one "shift incomplete tasks" action. */
export interface ShiftEvent {
  /** Items still incomplete on or before this day were carried forward. */
  date: string;
  /** First day the carried items (and everything after) were replanned onto. */
  resumeDate: string;
  /** `DailyPlanItem.id`s carried forward, frozen when the shift was made. */
  itemIds: string[];
}

/**
 * - `auto`: the planner spreads every branch over the study weekdays.
 * - `manual`: the user picks the branches of each weekday (`weekPlan`).
 */
export type PlanMode = 'auto' | 'manual';

export type RhythmPreset = 'light' | 'balanced' | 'intense';

/** A camp's schedule: the planner preferences plus how the week is formed. */
export interface CampSchedule extends UserPreferences {
  mode: PlanMode;
  /** Optional deadline (local date key). It never changes the layout; it is only assessed. */
  targetEndDate: string | null;
  /**
   * Manual mode: branch ids studied on each weekday (index 0 = Sunday).
   * In manual mode `activeDays` / `restDays` mirror it. Kept (not read) in auto mode.
   */
  weekPlan: string[][];
  /** Rhythm preset the automatic values started from (informational). */
  preset?: RhythmPreset;
}

/** A named study program (e.g. "TYT 2027") with its branches and schedule. */
export interface StudyCamp {
  id: string;
  name: string;
  /** Local date key of creation (or of the migration that created it). */
  createdAt: string;
  branches: SubjectPlaylist[];
  schedule: CampSchedule;
  shiftEvents: ShiftEvent[];
  /** `migrated`: built from an older version's flat data. */
  origin?: 'migrated';
}

export interface DailyPlanItem {
  id: string;
  videoId: string;
  playlistId: string;
  subject: string;
  title: string;
  durationMinutes: number;
  effectiveMinutes: number;
  completed: boolean;
  videoUrl: string;
}

export interface DailyPlan {
  date: string; // YYYY-MM-DD
  dayName: string;
  isToday: boolean;
  isPast: boolean;
  isRestDay: boolean;
  isMockExamDay: boolean;
  /**
   * Manual mode: a study weekday whose assigned branches have no videos left
   * (other branches still have work on their own days).
   */
  isFreeDay?: boolean;
  items: DailyPlanItem[];
  totalMinutes: number;
  isAllCompleted: boolean;
}

export interface RoadmapStats {
  totalVideos: number;
  completedVideos: number;
  totalMinutes: number;
  effectiveRemainingHours: number;
  estimatedFinishDate: string;
  daysRemaining: number;
  progressPercent: number;
}
