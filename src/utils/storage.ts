import type { UserPreferences } from '../types';
import type { ShiftEvent } from './roadmapEngine.ts';
import { isDateKey, normalizeDateKey, todayKey } from './date.ts';

export const STORAGE_KEYS = {
  preferences: 'yt_prefs',
  playlists: 'yt_playlists',
  completed: 'yt_completed',
  /** Legacy single shift date; superseded by `shiftEvents`. */
  shiftedDate: 'yt_shifted_date',
  shiftEvents: 'yt_shift_events',
} as const;

export const loadData = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item) {
      return JSON.parse(item);
    }
  } catch (error) {
    console.error('Error loading data', error);
  }
  return defaultValue;
};

export const saveData = (key: string, data: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving data', error);
  }
};

export const defaultPreferences: UserPreferences = {
  dailyStudyHours: 4,
  playbackSpeed: 1,
  practiceMultiplier: 0.2, // 20% extra time for practice
  maxSubjectsPerDay: 3,
  activeDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
  restDays: [0], // Sunday
  mockExamDays: [],
  startDate: todayKey() // local YYYY-MM-DD
};

export interface PreferencesInspection {
  preferences: UserPreferences;
  /** Fields that were missing or unusable and fell back to a default. */
  invalidFields: (keyof UserPreferences)[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validates stored or user-entered preferences. Unusable values (missing,
 * NaN, zero or negative hours/speed, bad weekday lists) fall back to
 * `defaultPreferences`, and legacy ISO timestamps in `startDate` become the
 * local calendar day.
 */
export function inspectPreferences(raw: unknown): PreferencesInspection {
  const input = isRecord(raw) ? raw : {};
  const invalidFields: (keyof UserPreferences)[] = [];

  const number = <K extends keyof UserPreferences>(key: K, valid: (n: number) => boolean): number => {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value) && valid(value)) return value;
    invalidFields.push(key);
    return defaultPreferences[key] as number;
  };

  const weekdays = <K extends keyof UserPreferences>(key: K): number[] => {
    const value = input[key];
    if (Array.isArray(value) && value.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return [...new Set(value as number[])].sort((a, b) => a - b);
    }
    invalidFields.push(key);
    return [...(defaultPreferences[key] as number[])];
  };

  let startDate = normalizeDateKey(input.startDate, '');
  if (!startDate) {
    invalidFields.push('startDate');
    startDate = todayKey();
  }

  const preferences: UserPreferences = {
    dailyStudyHours: Math.min(24, number('dailyStudyHours', n => n > 0)),
    playbackSpeed: number('playbackSpeed', n => n > 0),
    practiceMultiplier: number('practiceMultiplier', n => n >= 0),
    maxSubjectsPerDay: Math.floor(number('maxSubjectsPerDay', n => n >= 1)),
    activeDays: weekdays('activeDays'),
    restDays: weekdays('restDays'),
    mockExamDays: weekdays('mockExamDays'),
    startDate,
  };
  return { preferences, invalidFields };
}

export function normalizePreferences(raw: unknown): UserPreferences {
  return inspectPreferences(raw).preferences;
}

export function normalizeCompletedMap(raw: unknown): Record<string, boolean> {
  if (!isRecord(raw)) return {};
  const result: Record<string, boolean> = {};
  for (const [id, done] of Object.entries(raw)) {
    if (done === true) result[id] = true;
  }
  return result;
}

export function normalizeShiftEvents(raw: unknown): ShiftEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((event): ShiftEvent[] => {
    if (!isRecord(event) || !isDateKey(event.date) || !isDateKey(event.resumeDate)) return [];
    if (event.resumeDate <= event.date || !Array.isArray(event.itemIds)) return [];
    const itemIds = event.itemIds.filter((id): id is string => typeof id === 'string');
    return itemIds.length > 0 ? [{ date: event.date, resumeDate: event.resumeDate, itemIds }] : [];
  });
}

export const loadPreferences = (): UserPreferences =>
  normalizePreferences(loadData<unknown>(STORAGE_KEYS.preferences, null));

export const loadCompletedMap = (): Record<string, boolean> =>
  normalizeCompletedMap(loadData<unknown>(STORAGE_KEYS.completed, {}));

export const loadShiftEvents = (): ShiftEvent[] =>
  normalizeShiftEvents(loadData<unknown>(STORAGE_KEYS.shiftEvents, []));

export const saveShiftEvents = (events: ShiftEvent[]) => saveData(STORAGE_KEYS.shiftEvents, events);
