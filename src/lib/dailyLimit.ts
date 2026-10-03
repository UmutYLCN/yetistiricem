import { MAX_DAILY_HOURS, MIN_DAILY_HOURS } from './studyCamp.ts';

// The student's own ceiling on daily study time ("Günlük üst sınır" in
// Tercihler). The deadline-overrun prompt never offers more than this.
// A per-device preference like `yt_theme` and `yt_language`.

export const DAILY_LIMIT_KEY = 'yt_daily_limit';
export const DEFAULT_DAILY_LIMIT = 8;

/** `value` on the half-hour grid within the daily time a camp accepts, or the default when it is not a number. */
export function normalizeDailyLimit(value: unknown): number {
  const hours = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(hours)) return DEFAULT_DAILY_LIMIT;
  return Math.min(MAX_DAILY_HOURS, Math.max(MIN_DAILY_HOURS, Math.round(hours * 2) / 2));
}

export function getDailyLimit(): number {
  try {
    return normalizeDailyLimit(localStorage.getItem(DAILY_LIMIT_KEY));
  } catch {
    return DEFAULT_DAILY_LIMIT;
  }
}

export function saveDailyLimit(hours: number): number {
  const limit = normalizeDailyLimit(hours);
  try {
    if (limit === DEFAULT_DAILY_LIMIT) localStorage.removeItem(DAILY_LIMIT_KEY);
    else localStorage.setItem(DAILY_LIMIT_KEY, String(limit));
  } catch {
    // The preference just won't survive a reload.
  }
  return limit;
}
