// Calendar-date helpers built on local `YYYY-MM-DD` keys.
//
// A date key names a calendar day, not an instant. Arithmetic and weekday
// lookups run on UTC components, so they give the same answer in every time
// zone and across DST changes. Only "what day is it now" (`todayKey`) and
// converting a legacy timestamp (`normalizeDateKey`) read the local zone.
// Never parse a key with `new Date('YYYY-MM-DD')`: that reads it as UTC
// midnight and shows the previous day in negative offsets.

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T/;
const MS_PER_DAY = 86_400_000;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function keyParts(key: string): [number, number, number] | null {
  const match = DATE_KEY_RE.exec(key);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return [y, m, d];
}

function requireParts(key: string): [number, number, number] {
  const parts = keyParts(key);
  if (!parts) throw new RangeError(`Invalid date key: ${key}`);
  return parts;
}

function utcMs(key: string): number {
  const [y, m, d] = requireParts(key);
  return Date.UTC(y, m - 1, d);
}

function keyFromUtcMs(ms: number): string {
  const date = new Date(ms);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** True when `value` is a real calendar day written as `YYYY-MM-DD`. */
export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && keyParts(value) !== null;
}

/** The local calendar day of an instant. */
export function toDateKey(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local calendar day. */
export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

/** Local midnight of a date key, for UI code that needs a `Date`. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = requireParts(key);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  return keyFromUtcMs(utcMs(key) + Math.trunc(days) * MS_PER_DAY);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function diffDays(from: string, to: string): number {
  return Math.round((utcMs(to) - utcMs(from)) / MS_PER_DAY);
}

/** 0 = Sunday ... 6 = Saturday, like `Date#getDay`. */
export function dayOfWeek(key: string): number {
  return new Date(utcMs(key)).getUTCDay();
}

export function maxDateKey(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * Turns stored date values into a date key.
 * - `YYYY-MM-DD` is kept as the calendar day it names.
 * - Legacy ISO timestamps (the old `new Date().toISOString()` start date),
 *   `Date` objects and epoch milliseconds become the local day of that instant.
 * - Anything unreadable becomes `fallback`.
 */
export function normalizeDateKey(value: unknown, fallback: string = todayKey()): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : toDateKey(value);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? normalizeDateKey(new Date(value), fallback) : fallback;
  }
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (keyParts(trimmed)) return trimmed;
  // `new Date` rolls impossible days over (Feb 30 -> Mar 2), so check the day first.
  if (TIMESTAMP_RE.test(trimmed) && keyParts(trimmed.slice(0, 10))) {
    const instant = new Date(trimmed);
    return Number.isNaN(instant.getTime()) ? trimmed.slice(0, 10) : toDateKey(instant);
  }
  return fallback;
}

/** Formats a date key as its calendar day, independent of the local zone. */
export function formatDateKey(
  key: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' },
  locale = 'tr-TR'
): string {
  return new Date(utcMs(key)).toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
}

export function weekdayName(key: string, locale = 'tr-TR'): string {
  return formatDateKey(key, { weekday: 'long' }, locale);
}
