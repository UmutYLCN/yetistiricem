import type { StudyCamp, UserPreferences } from '../types';
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
import type { LegacyData } from './studyCamp.ts';
import { allBranches, migrateLegacyData, normalizeCamps, normalizePlaylists } from './studyCamp.ts';

// Everything the planner keeps in localStorage.
//
// - `yt_camps` holds the study camps (`{ version, camps }`): each camp owns its
//   branches, schedule and shift events. `yt_active_camp` names the camp the
//   screens show.
// - `yt_completed`, `yt_day_notes` and `yt_selected_date` are shared by all
//   camps (video ids are unique, notes belong to a calendar day).
// - The older flat keys (`yt_playlists`, `yt_prefs`, `yt_shift_events`,
//   `yt_shifted_date`) are only read, once, to build the first camp when
//   `yt_camps` does not exist yet. They are never written or removed here, so
//   they stay as a snapshot of the pre-camp data (Reset clears them).
//
// Loading never throws away data silently: unreadable values are copied
// aside and reported as notices.

export const UI_KEYS = {
  selectedDate: 'yt_selected_date',
  dayNotes: 'yt_day_notes',
} as const;

export const CAMP_KEYS = {
  camps: 'yt_camps',
  activeCamp: 'yt_active_camp',
} as const;

export const CAMPS_VERSION = 1;

export const ALL_KEYS = [...Object.values(STORAGE_KEYS), ...Object.values(UI_KEYS), ...Object.values(CAMP_KEYS)];

export const MAX_NOTE_LENGTH = 2000;

export interface PlannerData {
  camps: StudyCamp[];
  /** The camp the screens show; null only when there is no camp. */
  activeCampId: string | null;
  completedMap: Record<string, boolean>;
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
  /**
   * Preferences saved by an older version that had no camp to carry them;
   * the camp wizard starts from them.
   */
  seedPreferences: UserPreferences | null;
}

export function emptyData(): PlannerData {
  return { camps: [], activeCampId: null, completedMap: {}, dayNotes: {} };
}

export function campStore(camps: StudyCamp[]) {
  return { version: CAMPS_VERSION, camps };
}

/** The camp the screens show: the active one, else the first. */
export function activeCampOf(data: PlannerData): StudyCamp | null {
  return data.camps.find(c => c.id === data.activeCampId) ?? data.camps[0] ?? null;
}

export const PREF_LABELS: Record<keyof UserPreferences, string> = {
  dailyStudyHours: 'günlük çalışma süresi',
  playbackSpeed: 'izleme hızı',
  practiceMultiplier: 'tekrar payı',
  maxSubjectsPerDay: 'günlük branş sayısı',
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

/** The stored camp list, or null when the value is not a camp store this version understands. */
function readCampStore(value: unknown): unknown[] | null {
  if (!isRecord(value) || !Array.isArray(value.camps)) return null;
  if (typeof value.version === 'number' && value.version > CAMPS_VERSION) return null;
  return value.camps;
}

interface LegacyRead extends LegacyData {
  /** The preferences were actually stored (not defaults). */
  hasPreferences: boolean;
}

/** Reads the older flat keys, with the same repair notices as before. */
function readLegacy(notices: Notice[], completedMap: Record<string, boolean>, today: string): LegacyRead {
  const legacy: LegacyRead = {
    preferences: { ...defaultPreferences, startDate: today },
    playlists: [],
    shiftEvents: [],
    hasPreferences: false,
  };

  const prefs = readRaw(STORAGE_KEYS.preferences);
  if (prefs.status === 'ok') {
    const inspected = inspectPreferences(prefs.value);
    legacy.preferences = inspected.preferences;
    legacy.hasPreferences = true;
    if (inspected.invalidFields.length > 0) {
      notices.push({
        id: 'prefs-invalid',
        tone: 'warn',
        title: 'Bazı ayarlar varsayılana döndü',
        body: `Kayıtlı ayarlarda kullanılamayan değerler vardı: ${inspected.invalidFields.map(f => PREF_LABELS[f]).join(', ')}. Kampının “Tempoyu düzenle” ekranından kontrol edebilirsin.`,
      });
    }
  } else if (prefs.status === 'unreadable') {
    notices.push(unreadableNotice(STORAGE_KEYS.preferences, keepUnreadable(STORAGE_KEYS.preferences, prefs.raw), 'ayarlar'));
  }

  const playlists = readRaw(STORAGE_KEYS.playlists);
  if (playlists.status === 'ok') {
    const normalized = normalizePlaylists(playlists.value);
    legacy.playlists = normalized.playlists;
    if (normalized.droppedCamps > 0 || normalized.droppedVideos > 0 || !Array.isArray(playlists.value)) {
      const copyKey = keepUnreadable(STORAGE_KEYS.playlists, JSON.stringify(playlists.value));
      notices.push({
        id: 'playlists-partial',
        tone: 'warn',
        title: 'Kamp verisinin bir kısmı okunamadı',
        body: `${normalized.droppedCamps} liste ve ${normalized.droppedVideos} video kimliksiz ya da bozuk olduğu için gösterilmiyor. Orijinal kayıt “${copyKey}” anahtarında duruyor.`,
      });
    }
  } else if (playlists.status === 'unreadable') {
    notices.push(unreadableNotice(STORAGE_KEYS.playlists, keepUnreadable(STORAGE_KEYS.playlists, playlists.raw), 'kamplar'));
  }

  const events = readRaw(STORAGE_KEYS.shiftEvents);
  if (events.status === 'ok') {
    legacy.shiftEvents = normalizeShiftEvents(events.value);
  } else if (events.status === 'unreadable') {
    notices.push(unreadableNotice(STORAGE_KEYS.shiftEvents, keepUnreadable(STORAGE_KEYS.shiftEvents, events.raw), 'kaydırmalar'));
  }

  // The oldest app re-applied `yt_shifted_date` on every render, so a completed
  // task could jump back. It becomes one durable shift event of the camp.
  const legacyShift = readRaw(STORAGE_KEYS.shiftedDate);
  if (legacyShift.status === 'ok' && legacyShift.value !== null && legacy.playlists.length > 0) {
    const legacyDate = normalizeDateKey(legacyShift.value, '');
    if (legacyDate) {
      // As documented in docs/planner-engine.md: resume the day after the
      // legacy date, which is where the old app showed those tasks.
      const { plans } = buildSchedule(legacy.playlists, legacy.preferences, {
        completedMap,
        shiftEvents: legacy.shiftEvents,
        today: legacyDate,
      });
      const event = createShiftEvent(legacyDate, plans, legacyDate);
      if (event) {
        legacy.shiftEvents = [...legacy.shiftEvents, event];
        notices.push({
          id: 'legacy-shift',
          tone: 'info',
          title: 'Eski telafi kaydırman korundu',
          body: `Önceki sürümde ${event.itemIds.length} görevi ileri kaydırmıştın. Bu kaydırma artık kalıcı: görev işaretledikçe yerinden oynamayacak.`,
        });
      }
    }
  }
  return legacy;
}

function loadFromStorage(): LoadResult {
  const today = todayKey();
  const notices: Notice[] = [];
  const data = emptyData();
  let seedPreferences: UserPreferences | null = null;

  const completed = readRaw(STORAGE_KEYS.completed);
  if (completed.status === 'ok') {
    data.completedMap = normalizeCompletedMap(completed.value);
  } else if (completed.status === 'unreadable') {
    notices.push(unreadableNotice(STORAGE_KEYS.completed, keepUnreadable(STORAGE_KEYS.completed, completed.raw), 'tamamlananlar'));
  }

  const notes = readRaw(UI_KEYS.dayNotes);
  if (notes.status === 'ok') {
    data.dayNotes = normalizeDayNotes(notes.value);
  } else if (notes.status === 'unreadable') {
    notices.push(unreadableNotice(UI_KEYS.dayNotes, keepUnreadable(UI_KEYS.dayNotes, notes.raw), 'gün notları'));
  }

  const stored = readRaw(CAMP_KEYS.camps);
  const storedCamps = stored.status === 'ok' ? readCampStore(stored.value) : null;

  if (storedCamps) {
    const normalized = normalizeCamps(storedCamps, today);
    data.camps = normalized.camps;
    if (normalized.droppedCamps > 0 || normalized.droppedBranches > 0 || normalized.droppedVideos > 0) {
      const copyKey = keepUnreadable(CAMP_KEYS.camps, JSON.stringify(stored.status === 'ok' ? stored.value : null));
      notices.push({
        id: 'camps-partial',
        tone: 'warn',
        title: 'Kamp verisinin bir kısmı okunamadı',
        body: `${normalized.droppedCamps} kamp, ${normalized.droppedBranches} branş ve ${normalized.droppedVideos} video kimliksiz ya da bozuk olduğu için gösterilmiyor. Orijinal kayıt “${copyKey}” anahtarında duruyor.`,
      });
    }
    for (const invalid of normalized.invalidSchedules) {
      notices.push({
        id: `schedule-invalid-${invalid.name}`,
        tone: 'warn',
        title: 'Bazı ayarlar varsayılana döndü',
        body: `“${invalid.name}” temposunda kullanılamayan değerler vardı: ${invalid.fields.map(f => PREF_LABELS[f]).join(', ')}. “Tempoyu düzenle” ekranından kontrol edebilirsin.`,
      });
    }
  } else {
    if (stored.status !== 'missing') {
      // Corrupt, or written by a newer version: keep it aside and rebuild from
      // the older flat keys if they are still there.
      const raw = stored.status === 'unreadable' ? stored.raw : JSON.stringify(stored.value);
      notices.push(unreadableNotice(CAMP_KEYS.camps, keepUnreadable(CAMP_KEYS.camps, raw), 'kamplar'));
    }
    const legacy = readLegacy(notices, data.completedMap, today);
    if (legacy.playlists.length > 0) {
      const camp = migrateLegacyData(legacy, today);
      data.camps = [camp];
      data.activeCampId = camp.id;
      // Save the new layout first; the older keys stay untouched either way.
      const saved = writeKey(CAMP_KEYS.camps, campStore(data.camps)) && writeKey(CAMP_KEYS.activeCamp, camp.id);
      notices.push(
        saved
          ? {
              id: 'camps-migrated',
              tone: 'info',
              title: `Kampların “${camp.name}” altında toplandı`,
              body: `Önceki ${camp.branches.length} kampın artık bu kampın branşları. Videoların, ilerlemen, notların, ileri taşımaların ve ayarların aynen korundu. Kampın adını Kamplar’dan değiştirebilir, temposunu “Tempoyu düzenle” ile ayarlayabilirsin.`,
            }
          : {
              id: 'camps-migrated-unsaved',
              tone: 'warn',
              title: 'Yeni kamp düzeni kaydedilemedi',
              body: 'Verilerin eski kayıtlarından okundu ve yerinde duruyor, ancak tarayıcı depolaması yeni düzeni kaydetmedi. Ayarlar’dan yedek indirmeni öneririz.',
            }
      );
    } else if (legacy.hasPreferences) {
      seedPreferences = legacy.preferences;
    }
  }

  const active = readRaw(CAMP_KEYS.activeCamp);
  const activeId = active.status === 'ok' && typeof active.value === 'string' ? active.value : null;
  data.activeCampId = data.camps.find(c => c.id === activeId)?.id ?? data.activeCampId ?? data.camps[0]?.id ?? null;

  const selected = readRaw(UI_KEYS.selectedDate);
  const selectedDate = selected.status === 'ok' && isDateKey(selected.value) ? selected.value : today;

  return { data, selectedDate, notices, storageAvailable: true, seedPreferences };
}

let cached: LoadResult | null = null;

/** Reads storage once per page load (safe under StrictMode double renders). */
export function loadPlannerOnce(): LoadResult {
  if (cached) return cached;
  cached = loadPlanner();
  return cached;
}

/** Reads storage now. Prefer `loadPlannerOnce` in the app. */
export function loadPlanner(): LoadResult {
  try {
    return loadFromStorage();
  } catch (error) {
    console.error('Storage unavailable', error);
    return {
      data: emptyData(),
      selectedDate: todayKey(),
      storageAvailable: false,
      seedPreferences: null,
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

/** Drops completion marks of videos that are no longer in any camp. */
export function pruneCompletion(completed: Record<string, boolean>, removedIds: Iterable<string>, camps: readonly StudyCamp[]) {
  const stillUsed = new Set(allBranches(camps).flatMap(b => b.videos.map(v => v.id)));
  const next = { ...completed };
  for (const id of removedIds) {
    if (!stillUsed.has(id)) delete next[id];
  }
  return next;
}

// ---------------------------------------------------------------------------
// Backups

export const BACKUP_APP = 'yetistiricem';
/** 3: camps. 2 and 1 (flat playlists + preferences) are still read. */
export const BACKUP_VERSION = 3;

export interface BackupSummary {
  camps: number;
  branches: number;
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
    camps: data.camps,
    activeCampId: data.activeCampId,
    completedMap: data.completedMap,
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
 * Validates a backup file. Accepts this version's camp backups and the older
 * flat ones (`{ preferences, playlists, completedMap, shiftEvents? }`), which
 * become one camp exactly as stored data does.
 */
export function parseBackup(text: string, today: string = todayKey()): BackupParse {
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

  const warnings: string[] = [];
  let camps: StudyCamp[];
  if (version >= 3) {
    if (!Array.isArray(raw.camps)) {
      return { ok: false, error: 'Yedekte kamp listesi yok; dosya eksik ya da farklı bir biçimde.' };
    }
    const normalized = normalizeCamps(raw.camps, today);
    if (normalized.droppedCamps > 0 || normalized.droppedBranches > 0 || normalized.droppedVideos > 0) {
      return {
        ok: false,
        error: `Yedekteki ${normalized.droppedCamps} kamp, ${normalized.droppedBranches} branş ve ${normalized.droppedVideos} video bozuk. Eksik veriyle geri yüklemek yerine işlem durduruldu.`,
      };
    }
    camps = normalized.camps;
    for (const invalid of normalized.invalidSchedules) {
      warnings.push(`“${invalid.name}” içinde şu ayarlar varsayılana dönecek: ${invalid.fields.map(f => PREF_LABELS[f]).join(', ')}.`);
    }
  } else {
    if (!Array.isArray(raw.playlists)) {
      return { ok: false, error: 'Yedekte kamp listesi yok; dosya eksik ya da farklı bir biçimde.' };
    }
    const playlists = normalizePlaylists(raw.playlists);
    if (playlists.droppedCamps > 0 || playlists.droppedVideos > 0) {
      return {
        ok: false,
        error: `Yedekteki ${playlists.droppedCamps} kamp ve ${playlists.droppedVideos} video bozuk. Eksik veriyle geri yüklemek yerine işlem durduruldu.`,
      };
    }
    let preferences: UserPreferences = { ...defaultPreferences, startDate: today };
    if (raw.preferences !== undefined) {
      const inspected = inspectPreferences(raw.preferences);
      preferences = inspected.preferences;
      if (inspected.invalidFields.length > 0) {
        warnings.push(`Şu ayarlar varsayılana dönecek: ${inspected.invalidFields.map(f => PREF_LABELS[f]).join(', ')}.`);
      }
    } else {
      warnings.push('Yedekte ayar yok; varsayılan ayarlar kullanılacak.');
    }
    camps =
      playlists.playlists.length > 0
        ? [migrateLegacyData({ preferences, playlists: playlists.playlists, shiftEvents: normalizeShiftEvents(raw.shiftEvents) }, today)]
        : [];
    if (camps.length > 0) warnings.push(`Eski biçimli yedek: ${camps[0].branches.length} kamp, “${camps[0].name}” altında branş olarak açılacak.`);
  }

  const completedMap = normalizeCompletedMap(raw.completedMap);
  const dayNotes = normalizeDayNotes(raw.dayNotes);
  const videoIds = new Set(allBranches(camps).flatMap(p => p.videos.map(v => v.id)));
  const completed = Object.keys(completedMap).filter(id => videoIds.has(id)).length;
  const activeCampId =
    typeof raw.activeCampId === 'string' && camps.some(c => c.id === raw.activeCampId) ? raw.activeCampId : (camps[0]?.id ?? null);

  return {
    ok: true,
    data: { camps, activeCampId, completedMap, dayNotes },
    selectedDate: isDateKey(raw.selectedDate) ? raw.selectedDate : null,
    warnings,
    summary: {
      camps: camps.length,
      branches: allBranches(camps).length,
      videos: videoIds.size,
      completed,
      shifts: camps.reduce((acc, c) => acc + c.shiftEvents.length, 0),
      notes: Object.keys(dayNotes).length,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
      version,
    },
  };
}
