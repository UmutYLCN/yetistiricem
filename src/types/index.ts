export interface Video {
  id: string;
  title: string;
  durationMinutes: number;
  videoUrl: string;
  thumbnailUrl: string;
  completed: boolean;
}

export interface SubjectPlaylist {
  id: string;
  title: string;
  subject: string;
  channelName: string;
  playlistUrl: string;
  videos: Video[];
  colorTag: string;
  totalDurationMinutes: number;
}

export interface UserPreferences {
  dailyStudyHours: number;
  playbackSpeed: number; // 1, 1.25, 1.5, 1.75, 2
  practiceMultiplier: number; // extra time allocated for practice, e.g. 0.5 for 50% more time
  maxSubjectsPerDay: number;
  activeDays: number[]; // 0 for Sunday, 1 for Monday, etc.
  restDays: number[];
  mockExamDays: number[]; // e.g. Sunday
  startDate: string; // ISO date string
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
