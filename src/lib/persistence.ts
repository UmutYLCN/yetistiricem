import type { SubjectPlaylist, UserPreferences, Video } from '../types';
import type { ShiftEvent } from './engine.ts';
import {
  STORAGE_KEYS,
  buildSchedule,
  createShiftEvent,
  defaultPreferences,
  inspectPreferences,
  isDateKey,
  normalizeCompletedMap,
  normalizeDateKey,
  normalizeShiftEvents,
  todayKey,
} from './engine.ts';

// Everything the planner keeps in localStorage. The engine owns the original
// keys (STORAGE_KEYS); the UI adds the selected day and day notes. Loading
// never throws away data silently: unreadable values are copied aside and
// reported as notices.

export const UI_KEYS = {
  selectedDate: 'yt_selected_date',
  dayNotes: 'yt_day_notes',
} as const;

export const ALL_KEYS = [...Object.values(STORAGE_KEYS), ...Object.values(UI_KEYS)];

export const MAX_NOTE_LENGTH = 2000;

export interface PlannerData {
  preferences: UserPreferences;
  playlists: SubjectPlaylist[];
  completedMap: Record<string, boolean>;
  shiftEvents: ShiftEvent[];
  dayNotes: Record<string, string>;
}

export interface Notice {
  id: string;
  tone: 'info' | 'warn';
  title: string;
  body: string;
}

export interface LoadResult {
  data: PlannerData;
  selectedDate: string;
  notices: Notice[];
  storageAvailable: boolean;
}

export function emptyData(today: string = todayKey()): PlannerData {
  return {
    preferences: { ...defaultPreferences, startDate: today },
    playlists: [],
    completedMap: {},
    shiftEvents: [],
    dayNotes: {},
  };
}

const PREF_LABELS: Record<keyof UserPreferences, string> = {
  dailyStudyHours: 'günlük çalışma süresi',
  playbackSpeed: 'izleme hızı',
  practiceMultiplier: 'tekrar payı',
  maxSubjectsPerDay: 'günlük ders sayısı',
  activeDays: 'çalışma günleri',
  restDays: 'dinlenme günleri',
  mockExamDays: 'deneme günleri',
  startDate: 'başlangıç tarihi',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type RawRead = { status: 'missing' } | { status: 'ok'; value: unknown } | { status: 'unreadable'; raw: string };

function readRaw(key: string): RawRead {
  const raw = localStorage.getItem(key);
  if (raw === null) return { status: 'missing' };
  try {
    return { status: 'ok', value: JSON.parse(raw) };
  } catch {
    return { status: 'unreadable', raw };
  }
}

/** Keeps a copy of a value we could not read, so a later save cannot erase it. */
function keepUnreadable(key: string, raw: string) {
  const copyKey = `${key}__okunamadi`;
  try {
    if (localStorage.getItem(copyKey) === null) localStorage.setItem(copyKey, raw);
  } catch {
    // Storage full or blocked: the notice still tells the user.
  }
  return copyKey;
}

export function writeKey(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Could not save ${key}`, error);
    return false;
  }
}

function normalizeVideo(raw: unknown): Video | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  const duration = typeof raw.durationMinutes === 'number' && Number.isFinite(raw.durationMinutes) ? raw.durationMinutes : 0;
  return {
    id: raw.id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Başlıksız video',
    durationMinutes: Math.max(0, duration),
    videoUrl: typeof raw.videoUrl === 'string' ? raw.videoUrl : '',
    thumbnailUrl: typeof raw.thumbnailUrl === 'string' ? raw.thumbnailUrl : '',
    completed: raw.completed === true,
    ...(typeof raw.channelName === 'string' && raw.channelName.trim() ? { channelName: raw.channelName } : {}),
  };
}

interface PlaylistNormalization {
  playlists: SubjectPlaylist[];
  droppedCamps: number;
  droppedVideos: number;
}

export function normalizePlaylists(raw: unknown): PlaylistNormalization {
  const result: PlaylistNormalization = { playlists: [], droppedCamps: 0, droppedVideos: 0 };
  if (!Array.isArray(raw)) return result;
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || seen.has(item.id)) {
      result.droppedCamps++;
      continue;
    }
    seen.add(item.id);
    const rawVideos = Array.isArray(item.videos) ? item.videos : [];
    const videos = rawVideos.map(normalizeVideo).filter((v): v is Video => v !== null);
    result.droppedVideos += rawVideos.length - videos.length;
    const subject = typeof item.subject === 'string' && item.subject.trim() ? item.subject : 'Diğer';
    result.playlists.push({
      id: item.id,
      title: typeof item.title === 'string' && item.title.trim() ? item.title : 'Adsız kamp',
      subject,
      channelName: typeof item.channelName === 'string' ? item.channelName : '',
      playlistUrl: typeof item.playlistUrl === 'string' ? item.playlistUrl : '',
      videos,
      colorTag: typeof item.colorTag === 'string' ? item.colorTag : '',
      totalDurationMinutes: videos.reduce((acc, v) => acc + v.durationMinutes, 0),
      ...(item.source === 'manual' || item.source === 'demo-template' ? { source: item.source } : {}),
    });
  }
  return result;
}

export function normalizeDayNotes(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const notes: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isDateKey(key) && typeof value === 'string' && value.trim()) {
      notes[key] = value.slice(0, MAX_NOTE_LENGTH);
    }
  }
  return notes;
}

function unreadableNotice(key: string, copyKey: string, what: string): Notice {
  return {
    id: `unreadable-${key}`,
    tone: 'warn',
    title: `Kayıtlı ${what} okunamadı`,
    body: `Tarayıcıdaki “${key}” kaydı bozuk görünüyor. Ham hali “${copyKey}” anahtarına yedeklendi; uygulama bu veri olmadan açıldı.`,
  };
}

function loadFromStorage(): LoadResult {
  const today = todayKey();
  const notices: Notice[] = [];
  const data = emptyData(today);

  const prefs = readRaw(STORAGE_KEYS.preferences);
  if (prefs.status === 'ok') {
    const inspected = inspectPreferences(prefs.value);
    data.preferences = inspected.preferences;
    if (inspected.invalidFields.length > 0) {
      notices.push({
        id: 'prefs-invalid',
        tone: 'warn',
        title: 'Bazı ayarlar varsayılana döndü',
        body: `Kayıtlı ayarlarda kullanılamayan değerler vardı: ${inspected.invalidFields.map(f => PREF_LABELS[f]).join(', ')}. Ayarlar sayfasından kontrol edebilirsin.`,
      });
    }
  } else if (prefs.status === 'unreadable') {
    notices.push(unreadableNotice(STORAGE_KEYS.preferences, keepUnreadable(STORAGE_KEYS.preferences, prefs.raw), 'ayarlar'));
  }

  const playlists = readRaw(STORAGE_KEYS.playlists);
  if (playlists.status === 'ok') {
    const normalized = normalizePlaylists(playlists.value);
    data.playlists = normalized.playlists;
    if (normalized.droppedCamps > 0 || normalized.droppedVideos > 0 || !Array.isArray(playlists.value)) {
      const copyKey = keepUnreadable(STORAGE_KEYS.playlists, JSON.stringify(playlists.value));
      notices.push({
        id: 'playlists-partial',
        tone: 'warn',
        title: 'Kamp verisinin bir kısmı okunamadı',
        body: `${normalized.droppedCamps} kamp ve ${normalized.droppedVideos} video kimliksiz ya da bozuk olduğu için gösterilmiyor. Orijinal kayıt “${copyKey}” anahtarında duruyor.`,
      });
    }
  } else if (playlists.status === 'unreadable') {
    notices.push(unreadableNotice(STORAGE_KEYS.playlists, keepUnreadable(STORAGE_KEYS.playlists, playlists.raw), 'kamplar'));
  }

  const completed = readRaw(STORAGE_KEYS.completed);
  if (completed.status === 'ok') {
    data.completedMap = normalizeCompletedMap(completed.value);
  } else if (completed.status === 'unreadable') {
    notices.push(unreadableNotice(STORAGE_KEYS.completed, keepUnreadable(STORAGE_KEYS.completed, completed.raw), 'tamamlananlar'));
  }

  const events = readRaw(STORAGE_KEYS.shiftEvents);
  if (events.status === 'ok') {
    data.shiftEvents = normalizeShiftEvents(events.value);
  } else if (events.status === 'unreadable') {
    notices.push(unreadableNotice(STORAGE_KEYS.shiftEvents, keepUnreadable(STORAGE_KEYS.shiftEvents, events.raw), 'kaydırmalar'));
  }

  const notes = readRaw(UI_KEYS.dayNotes);
  if (notes.status === 'ok') {
    data.dayNotes = normalizeDayNotes(notes.value);
  } else if (notes.status === 'unreadable') {
    notices.push(unreadableNotice(UI_KEYS.dayNotes, keepUnreadable(UI_KEYS.dayNotes, notes.raw), 'gün notları'));
  }

  // The old app re-applied `yt_shifted_date` on every render, so a completed
  // task could jump back. Turn it into one durable shift event, once.
  const legacyShift = readRaw(STORAGE_KEYS.shiftedDate);
  if (legacyShift.status === 'ok' && legacyShift.value !== null) {
    const legacyDate = normalizeDateKey(legacyShift.value, '');
    if (legacyDate) {
      // As documented in docs/planner-engine.md: resume the day after the
      // legacy date, which is where the old app showed those tasks.
      const { plans } = buildSchedule(data.playlists, data.preferences, {
        completedMap: data.completedMap,
        shiftEvents: data.shiftEvents,
        today: legacyDate,
      });
      const event = createShiftEvent(legacyDate, plans, legacyDate);
      if (event) {
        data.shiftEvents = [...data.shiftEvents, event];
        if (writeKey(STORAGE_KEYS.shiftEvents, data.shiftEvents)) {
          writeKey(STORAGE_KEYS.shiftedDate, null);
        }
        notices.push({
          id: 'legacy-shift',
          tone: 'info',
          title: 'Eski telafi kaydırman korundu',
          body: `Önceki sürümde ${event.itemIds.length} görevi ileri kaydırmıştın. Bu kaydırma artık kalıcı: görev işaretledikçe yerinden oynamayacak.`,
        });
      } else {
        writeKey(STORAGE_KEYS.shiftedDate, null);
      }
    }
  }

  // Camps without saved settings would restart the plan from "today" on every
  // visit. Pin the defaults the plan is using right now.
  if (prefs.status === 'missing' && data.playlists.length > 0) {
    writeKey(STORAGE_KEYS.preferences, data.preferences);
  }

  const selected = readRaw(UI_KEYS.selectedDate);
  const selectedDate = selected.status === 'ok' && isDateKey(selected.value) ? selected.value : today;

  return { data, selectedDate, notices, storageAvailable: true };
}

let cached: LoadResult | null = null;

/** Reads storage once per page load (safe under StrictMode double renders). */
export function loadPlannerOnce(): LoadResult {
  if (cached) return cached;
  try {
    cached = loadFromStorage();
  } catch (error) {
    console.error('Storage unavailable', error);
    cached = {
      data: emptyData(),
      selectedDate: todayKey(),
      storageAvailable: false,
      notices: [
        {
          id: 'storage-unavailable',
          tone: 'warn',
          title: 'Tarayıcı depolamasına erişilemiyor',
          body: 'Gizli sekme ya da engellenmiş site verisi nedeniyle değişiklikler bu oturumdan sonra kaybolacak. Yedek indirerek saklayabilirsin.',
        },
      ],
    };
  }
  return cached;
}

export function clearAllStorage() {
  for (const key of ALL_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing more to do; the in-memory state is reset either way.
    }
  }
}

// ---------------------------------------------------------------------------
// Backups

export const BACKUP_APP = 'yetistiricem';
export const BACKUP_VERSION = 2;

export interface BackupSummary {
  camps: number;
  videos: number;
  completed: number;
  shifts: number;
  notes: number;
  exportedAt: string | null;
  version: number;
}

export function createBackup(data: PlannerData, selectedDate: string) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    preferences: data.preferences,
    playlists: data.playlists,
    completedMap: data.completedMap,
    shiftEvents: data.shiftEvents,
    dayNotes: data.dayNotes,
    selectedDate,
  };
}

export function backupFileName(today: string = todayKey()): string {
  return `yetistiricem-yedek-${today}.json`;
}

export type BackupParse =
  | { ok: true; data: PlannerData; selectedDate: string | null; summary: BackupSummary; warnings: string[] }
  | { ok: false; error: string };

/**
 * Validates a backup file. Accepts this version's files and the older
 * `{ preferences, playlists, completedMap }` files.
 */
export function parseBackup(text: string): BackupParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Dosya okunamadı: geçerli bir JSON değil.' };
  }
  if (!isRecord(raw)) return { ok: false, error: 'Bu dosya bir Yetiştiricem yedeği değil.' };
  if (raw.app !== undefined && raw.app !== BACKUP_APP) {
    return { ok: false, error: 'Bu dosya başka bir uygulamaya ait.' };
  }
  const version = typeof raw.version === 'number' ? raw.version : 1;
  if (version > BACKUP_VERSION) {
    return { ok: false, error: 'Bu yedek daha yeni bir sürümle alınmış; bu sürüm açamıyor.' };
  }
  if (!Array.isArray(raw.playlists)) {
    return { ok: false, error: 'Yedekte kamp listesi yok; dosya eksik ya da farklı bir biçimde.' };
  }

  const warnings: string[] = [];
  const playlists = normalizePlaylists(raw.playlists);
  if (playlists.droppedCamps > 0 || playlists.droppedVideos > 0) {
    return {
      ok: false,
      error: `Yedekteki ${playlists.droppedCamps} kamp ve ${playlists.droppedVideos} video bozuk. Eksik veriyle geri yüklemek yerine işlem durduruldu.`,
    };
  }

  let preferences = { ...defaultPreferences, startDate: todayKey() };
  if (raw.preferences !== undefined) {
    const inspected = inspectPreferences(raw.preferences);
    preferences = inspected.preferences;
    if (inspected.invalidFields.length > 0) {
      warnings.push(`Şu ayarlar varsayılana dönecek: ${inspected.invalidFields.map(f => PREF_LABELS[f]).join(', ')}.`);
    }
  } else {
    warnings.push('Yedekte ayar yok; varsayılan ayarlar kullanılacak.');
  }

  const completedMap = normalizeCompletedMap(raw.completedMap);
  const shiftEvents = normalizeShiftEvents(raw.shiftEvents);
  const dayNotes = normalizeDayNotes(raw.dayNotes);
  const videoIds = new Set(playlists.playlists.flatMap(p => p.videos.map(v => v.id)));
  const completed = Object.keys(completedMap).filter(id => videoIds.has(id)).length;

  return {
    ok: true,
    data: { preferences, playlists: playlists.playlists, completedMap, shiftEvents, dayNotes },
    selectedDate: isDateKey(raw.selectedDate) ? raw.selectedDate : null,
    warnings,
    summary: {
      camps: playlists.playlists.length,
      videos: videoIds.size,
      completed,
      shifts: shiftEvents.length,
      notes: Object.keys(dayNotes).length,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
      version,
    },
  };
}
