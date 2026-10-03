import { addDays, dayOfWeek, diffDays, formatDateKey, weekdayName } from './engine.ts';
import { currentLanguage } from './language.ts';

const LOCALES = { tr: 'tr-TR', en: 'en-US', es: 'es-ES', fr: 'fr-FR' } as const;

export function dateLocale(): string {
  return LOCALES[currentLanguage()];
}

export function shortWeekdayName(day: number): string {
  return new Intl.DateTimeFormat(dateLocale(), { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2023, 0, 1 + ((day % 7) + 7) % 7)));
}

export function longWeekdayName(day: number): string {
  return new Intl.DateTimeFormat(dateLocale(), { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2023, 0, 1 + ((day % 7) + 7) % 7)));
}

/** 0 = Sunday, like `Date#getDay`. */
function localizedWeekdays(length: 'short' | 'long'): string[] {
  const weekdays = Array<string>(7).fill('');
  return new Proxy(weekdays, {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^(?:[0-6])$/.test(property)) {
        const day = Number(property);
        return new Intl.DateTimeFormat(dateLocale(), { weekday: length, timeZone: 'UTC' })
          .format(new Date(Date.UTC(2023, 0, 1 + day)));
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

export const SHORT_WEEKDAYS = localizedWeekdays('short');
export const LONG_WEEKDAYS = localizedWeekdays('long');
/** Monday-first order used by every week layout. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "45 dk", "1 sa 20 dk", "3 sa". */
export function formatMinutes(minutes: number): string {
  const labels = currentLanguage() === 'tr'
    ? { minute: 'dk', hour: 'sa' }
    : currentLanguage() === 'fr'
      ? { minute: 'min', hour: 'h' }
      : { minute: 'min', hour: 'h' };
  const number = (value: number) => new Intl.NumberFormat(dateLocale(), { maximumFractionDigits: 0 }).format(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return `0 ${labels.minute}`;
  const total = Math.round(minutes);
  if (total < 1) return `1 ${labels.minute}`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${number(m)} ${labels.minute}`;
  if (m === 0) return `${number(h)} ${labels.hour}`;
  return `${number(h)} ${labels.hour} ${number(m)} ${labels.minute}`;
}

/** A daily time as a plain hour count for "{hours} saat": "3", "3,5". */
export function formatHourCount(hours: number): string {
  return new Intl.NumberFormat(dateLocale(), { maximumFractionDigits: 1 }).format(Number.isFinite(hours) ? hours : 0);
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
  const hour = currentLanguage() === 'tr' ? 'sa' : 'h';
  if (!Number.isFinite(minutes) || minutes <= 0) return `0 ${hour}`;
  const hours = minutes / 60;
  if (hours < 1) return formatMinutes(minutes);
  return `${new Intl.NumberFormat(dateLocale(), { maximumFractionDigits: 0 }).format(Math.round(hours))} ${hour}`;
}

/** Turkish puts the percent sign first. */
export function formatPercent(value: number): string {
  const number = new Intl.NumberFormat(dateLocale(), { maximumFractionDigits: 0 }).format(Math.round(value));
  return currentLanguage() === 'tr' ? `%${number}` : `${number}%`;
}

// Possessive suffix of a number as it is read aloud ("yüzde elli beş" -> 'i),
// by its last word: the ones digit, else the tens, else "yüz" / "sıfır".
const ONES_SUFFIX = ['', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'];
const TENS_SUFFIX = ['', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı'];

/** "%55'i", "%50'si", "%40'ı", "%100'ü": a share, as in "Ertelemelerinin %55'i ...". */
export function formatPercentShare(value: number): string {
  const n = Math.max(0, Math.round(value));
  if (currentLanguage() !== 'tr') return formatPercent(n);
  const suffix = n === 0 ? 'ı' : n % 10 ? ONES_SUFFIX[n % 10] : n % 100 ? TENS_SUFFIX[(n % 100) / 10] : 'ü';
  return `%${n}'${suffix}`;
}

export function formatSpeed(speed: number): string {
  return `${speed.toLocaleString(dateLocale(), { maximumFractionDigits: 2 })}×`;
}

/** "Perşembe, 24 Eylül" */
export function formatDayTitle(key: string): string {
  return `${weekdayName(key, dateLocale())}, ${formatDateKey(key, undefined, dateLocale())}`;
}

/** "24 Eylül 2026" */
export function formatLongDate(key: string): string {
  return formatDateKey(key, { day: 'numeric', month: 'long', year: 'numeric' }, dateLocale());
}

/** "24 Eyl" */
export function formatShortDate(key: string): string {
  return formatDateKey(key, { day: 'numeric', month: 'short' }, dateLocale());
}

export function shortWeekday(key: string): string {
  return shortWeekdayName(dayOfWeek(key));
}

/** "Bugün", "Yarın", "Dün", "3 gün sonra", "2 gün önce". */
export function relativeDayLabel(key: string, today: string): string {
  const diff = diffDays(today, key);
  const language = currentLanguage();
  if (diff === 0) return ({ tr: 'Bugün', en: 'Today', es: 'Hoy', fr: 'Aujourd’hui' })[language];
  if (diff === 1) return ({ tr: 'Yarın', en: 'Tomorrow', es: 'Mañana', fr: 'Demain' })[language];
  if (diff === -1) return ({ tr: 'Dün', en: 'Yesterday', es: 'Ayer', fr: 'Hier' })[language];
  const amount = new Intl.NumberFormat(dateLocale()).format(Math.abs(diff));
  if (language === 'en') return diff > 0 ? `in ${amount} days` : `${amount} days ago`;
  if (language === 'es') return diff > 0 ? `dentro de ${amount} días` : `hace ${amount} días`;
  if (language === 'fr') return diff > 0 ? `dans ${amount} jours` : `il y a ${amount} jours`;
  return diff > 0 ? `${amount} gün sonra` : `${amount} gün önce`;
}

/** Short label for lists: "Bugün", "Yarın", or "Cum 26 Eyl". */
export function compactDayLabel(key: string, today: string): string {
  const diff = diffDays(today, key);
  const language = currentLanguage();
  if (diff === 0) return ({ tr: 'Bugün', en: 'Today', es: 'Hoy', fr: 'Aujourd’hui' })[language];
  if (diff === 1) return ({ tr: 'Yarın', en: 'Tomorrow', es: 'Mañana', fr: 'Demain' })[language];
  if (diff === -1) return ({ tr: 'Dün', en: 'Yesterday', es: 'Ayer', fr: 'Hier' })[language];
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
    ? formatDateKey(monday, { day: 'numeric' }, dateLocale())
    : formatDateKey(monday, sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }, dateLocale());
  return `${start} – ${formatLongDate(sunday)}`;
}

export function monthLabel(key: string): string {
  return formatDateKey(key, { month: 'long', year: 'numeric' }, dateLocale());
}
