import { addDays, dayOfWeek, diffDays, formatDateKey, weekdayName } from './engine.ts';

/** 0 = Sunday, like `Date#getDay`. */
export const SHORT_WEEKDAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const LONG_WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
/** Monday-first order used by every week layout. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "45 dk", "1 sa 20 dk", "3 sa". */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 dk';
  const total = Math.round(minutes);
  if (total < 1) return '1 dk';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

/** Exact video length: "4:05", "38:23", "1:02:03". */
export function formatClock(totalSeconds: number): string {
  const seconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Rounded hours for large totals: "64 sa". */
export function formatHours(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 sa';
  const hours = minutes / 60;
  if (hours < 1) return formatMinutes(minutes);
  return `${Math.round(hours)} sa`;
}

/** Turkish puts the percent sign first. */
export function formatPercent(value: number): string {
  return `%${Math.round(value)}`;
}

export function formatSpeed(speed: number): string {
  return `${speed.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}x`;
}

/** "Perşembe, 24 Eylül" */
export function formatDayTitle(key: string): string {
  return `${weekdayName(key)}, ${formatDateKey(key)}`;
}

/** "24 Eylül 2026" */
export function formatLongDate(key: string): string {
  return formatDateKey(key, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "24 Eyl" */
export function formatShortDate(key: string): string {
  return formatDateKey(key, { day: 'numeric', month: 'short' });
}

export function shortWeekday(key: string): string {
  return SHORT_WEEKDAYS[dayOfWeek(key)];
}

/** "Bugün", "Yarın", "Dün", "3 gün sonra", "2 gün önce". */
export function relativeDayLabel(key: string, today: string): string {
  const diff = diffDays(today, key);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Yarın';
  if (diff === -1) return 'Dün';
  if (diff > 1) return `${diff} gün sonra`;
  return `${-diff} gün önce`;
}

/** Short label for lists: "Bugün", "Yarın", or "Cum 26 Eyl". */
export function compactDayLabel(key: string, today: string): string {
  const diff = diffDays(today, key);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Yarın';
  if (diff === -1) return 'Dün';
  return `${shortWeekday(key)} ${formatShortDate(key)}`;
}

/** Monday of the week containing `key`. */
export function startOfWeek(key: string): string {
  const offset = (dayOfWeek(key) + 6) % 7;
  return addDays(key, -offset);
}

/** The seven date keys of the week containing `key`, Monday first. */
export function weekKeys(key: string): string[] {
  const monday = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** "22 – 28 Eylül 2026" or "29 Eylül – 5 Ekim 2026". */
export function formatWeekRange(monday: string): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  const sameYear = monday.slice(0, 4) === sunday.slice(0, 4);
  const start = sameMonth
    ? formatDateKey(monday, { day: 'numeric' })
    : formatDateKey(monday, sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  return `${start} – ${formatLongDate(sunday)}`;
}

export function monthLabel(key: string): string {
  return formatDateKey(key, { month: 'long', year: 'numeric' });
}
