import type { StudyCamp, UserPreferences } from '../types/index.ts';
import type { FocusSession } from './focus.ts';
import { normalizeFocusSessions } from './focus.ts';
import type { PlaylistSync } from './playlistSync.ts';
import { emptyPlaylistSync, normalizePlaylistSync, playlistSyncStore } from './playlistSync.ts';
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
import type { CampScope } from './allCamps.ts';
import { isCampScope } from './allCamps.ts';
import type { LegacyData } from './studyCamp.ts';
import { allBranches, migrateLegacyData, normalizeCamps, normalizePlaylists } from './studyCamp.ts';

// Everything the planner keeps in localStorage.
//
// - `yt_camps` holds the study camps (`{ version, camps }`): each camp owns its
//   branches, schedule and shift events. `yt_active_camp` names the camp the
//   screens show.
// - `yt_completed`, `yt_day_notes` and `yt_selected_date` are shared by all
//   camps (video ids are unique, notes belong to a calendar day).
// - `yt_camp_scope` remembers whether the plan screens combine every camp
//   (`all`, "Tüm Kamplar") or show the active camp (`camp`). Missing = no
//   choice yet. It never holds a camp id; `yt_active_camp` always does.
// - `yt_completed_on` (`{ version, since, dates }`) records the day each video
//   was ticked, from `since` (the first day a version with this key ran) on.
//   `yt_completed` stays the source of truth for what is done; older ticks
//   simply have no date.
// - `yt_focus_sessions` (`{ version, sessions }`) keeps one record per focus
//   player session (see `src/lib/focus.ts`).
// - `yt_playlist_sync` (`{ version, lastAttempt, lastFailure, branches }`)
//   remembers the daily playlist check: what each branch's playlist held and
//   the new videos waiting in the bell (see `src/lib/playlistSync.ts`).
// - The older flat keys (`yt_playlists`, `yt_prefs`, `yt_shift_events`,
//   `yt_shifted_date`) are only read, once, to build the first camp when
//   `yt_camps` does not exist yet and migration has never completed. They are
//   never written here; `yt_camps_migrated` prevents an old snapshot from
//   becoming a new camp if the current store later goes missing.
//
// Loading never throws away data silently: unreadable values are copied
// aside and reported as notices.

export const UI_KEYS = {
  selectedDate: 'yt_selected_date',
  dayNotes: 'yt_day_notes',
  campScope: 'yt_camp_scope',
} as const;

export const CAMP_KEYS = {
  camps: 'yt_camps',
  activeCamp: 'yt_active_camp',
} as const;

export const PROGRESS_KEYS = {
  completionDates: 'yt_completed_on',
  focusSessions: 'yt_focus_sessions',
  playlistSync: 'yt_playlist_sync',
} as const;

export const CAMPS_VERSION = 1;
export const LEGACY_MIGRATION_KEY = 'yt_camps_migrated';
export const COMPLETION_DATES_VERSION = 1;
export const FOCUS_SESSIONS_VERSION = 1;


/** Keys holding the planner's data (not view choices or the sign-in session). */
export const DATA_KEYS = [
  ...Object.values(STORAGE_KEYS),
  UI_KEYS.dayNotes,
  ...Object.values(CAMP_KEYS),
  ...Object.values(PROGRESS_KEYS),
];

/** Everything "Tüm verileri sil" removes: the data and the view choices. The account stays signed in. */
export const ALL_KEYS = [...DATA_KEYS, UI_KEYS.selectedDate, UI_KEYS.campScope, LEGACY_MIGRATION_KEY];

export const MAX_NOTE_LENGTH = 2000;

/**
 * The local day each video was ticked, recorded from `since` on. Ticks made
 * before `since` have no date: they still count as done, but the activity map,
 * the streak and the commitment score only use what was recorded.
 */
export interface CompletionDates {
  since: string;
  /** videoId -> date key; only ids that are completed. */
  dates: Record<string, string>;
}

export interface PlannerData {
  camps: StudyCamp[];
  /** The camp the screens show; null only when there is no camp. */
  activeCampId: string | null;
  completedMap: Record<string, boolean>;
  completionDates: CompletionDates;
  focusSessions: FocusSession[];
  playlistSync: PlaylistSync;
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
  /** The stored "Tüm Kamplar" / one camp choice; null when none was made. */
  campScope: CampScope | null;
  notices: Notice[];
  storageAvailable: boolean;
  /**
   * Preferences saved by an older version that had no camp to carry them;
   * the camp wizard starts from them.
   */
  seedPreferences: UserPreferences | null;
}

export function emptyCompletionDates(since: string = todayKey()): CompletionDates {
  return { since, dates: {} };
}

export function emptyData(): PlannerData {
  return {
    camps: [],
    activeCampId: null,
    completedMap: {},
    completionDates: emptyCompletionDates(),
    focusSessions: [],
    playlistSync: emptyPlaylistSync(),
    dayNotes: {},
  };
}

export function campStore(camps: StudyCamp[]) {
  return { version: CAMPS_VERSION, camps };
}

export function completionDatesStore(value: CompletionDates) {
  return { version: COMPLETION_DATES_VERSION, since: value.since, dates: value.dates };
}

export function focusSessionsStore(sessions: FocusSession[]) {
  return { version: FOCUS_SESSIONS_VERSION, sessions };
}

/** A stored `yt_focus_sessions` value, or null when it is not one this version understands. */
export function readFocusSessions(raw: unknown): FocusSession[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.sessions)) return null;
  if (typeof raw.version === 'number' && raw.version > FOCUS_SESSIONS_VERSION) return null;
  return normalizeFocusSessions(raw.sessions);
}

/** Keeps only the dates of videos that are still completed. */
export function datesOfCompleted(value: CompletionDates, completedMap: Record<string, boolean>): CompletionDates {
  const dates: Record<string, string> = {};
  for (const [id, date] of Object.entries(value.dates)) if (completedMap[id] === true) dates[id] = date;
  return { since: value.since, dates };
}

/** A stored `yt_completed_on` value, or null when it is not one this version understands. */
export function normalizeCompletionDates(raw: unknown, fallbackSince: string): CompletionDates | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.version === 'number' && raw.version > COMPLETION_DATES_VERSION) return null;
  const dates: Record<string, string> = {};
  if (isRecord(raw.dates)) {
    for (const [id, date] of Object.entries(raw.dates)) if (isDateKey(date)) dates[id] = date;
  }
  return { since: isDateKey(raw.since) ? raw.since : fallbackSince, dates };
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

  // Missing: dates are recorded from today on. Save that day now, so it stays
  // the start of the record even before the first tick.
  const completion = readRaw(PROGRESS_KEYS.completionDates);
  const completionDates = completion.status === 'ok' ? normalizeCompletionDates(completion.value, today) : null;
  if (completionDates) {
    data.completionDates = datesOfCompleted(completionDates, data.completedMap);
  } else {
    data.completionDates = emptyCompletionDates(today);
    if (completion.status === 'missing') {
      writeKey(PROGRESS_KEYS.completionDates, completionDatesStore(data.completionDates));
    } else {
      const raw = completion.status === 'unreadable' ? completion.raw : JSON.stringify(completion.value);
      notices.push(unreadableNotice(PROGRESS_KEYS.completionDates, keepUnreadable(PROGRESS_KEYS.completionDates, raw), 'tamamlanma tarihleri'));
    }
  }

  const focus = readRaw(PROGRESS_KEYS.focusSessions);
  const focusSessions = focus.status === 'ok' ? readFocusSessions(focus.value) : null;
  if (focusSessions) {
    data.focusSessions = focusSessions;
  } else if (focus.status !== 'missing') {
    const raw = focus.status === 'unreadable' ? focus.raw : JSON.stringify(focus.value);
    notices.push(unreadableNotice(PROGRESS_KEYS.focusSessions, keepUnreadable(PROGRESS_KEYS.focusSessions, raw), 'odak oturumları'));
  }

  const sync = readRaw(PROGRESS_KEYS.playlistSync);
  const playlistSync = sync.status === 'ok' ? normalizePlaylistSync(sync.value) : null;
  if (playlistSync) {
    data.playlistSync = playlistSync;
  } else if (sync.status !== 'missing') {
    const raw = sync.status === 'unreadable' ? sync.raw : JSON.stringify(sync.value);
    notices.push(unreadableNotice(PROGRESS_KEYS.playlistSync, keepUnreadable(PROGRESS_KEYS.playlistSync, raw), 'oynatma listesi kontrolleri'));
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
    if (localStorage.getItem(LEGACY_MIGRATION_KEY) === null) writeKey(LEGACY_MIGRATION_KEY, true);
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
      // Corrupt, or written by a newer version: keep it aside. Older flat keys
      // could be a snapshot of camps that were later deleted.
      const raw = stored.status === 'unreadable' ? stored.raw : JSON.stringify(stored.value);
      notices.push(unreadableNotice(CAMP_KEYS.camps, keepUnreadable(CAMP_KEYS.camps, raw), 'kamplar'));
    }
    const mayMigrate = stored.status === 'missing' && localStorage.getItem(LEGACY_MIGRATION_KEY) === null && localStorage.getItem('yt_sync') === null;
    const legacy = mayMigrate ? readLegacy(notices, data.completedMap, today) : null;
    if (legacy && legacy.playlists.length > 0) {
      const camp = migrateLegacyData(legacy, today);
      data.camps = [camp];
      data.activeCampId = camp.id;
      // Save the new layout first; the older keys stay untouched either way.
      const saved = writeKey(CAMP_KEYS.camps, campStore(data.camps)) && writeKey(CAMP_KEYS.activeCamp, camp.id) && writeKey(LEGACY_MIGRATION_KEY, true);
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
    } else if (legacy?.hasPreferences) {
      seedPreferences = legacy.preferences;
    }
  }

  const active = readRaw(CAMP_KEYS.activeCamp);
  const activeId = active.status === 'ok' && typeof active.value === 'string' ? active.value : null;
  data.activeCampId = data.camps.find(c => c.id === activeId)?.id ?? data.activeCampId ?? data.camps[0]?.id ?? null;

  const selected = readRaw(UI_KEYS.selectedDate);
  const selectedDate = selected.status === 'ok' && isDateKey(selected.value) ? selected.value : today;

  const scope = readRaw(UI_KEYS.campScope);
  const campScope = scope.status === 'ok' && isCampScope(scope.value) ? scope.value : null;

  return { data, selectedDate, campScope, notices, storageAvailable: true, seedPreferences };
}

let cached: LoadResult | null = null;
let startupNotices: Notice[] = [];

/** Notices from before the planner opened (e.g. the account's plan was merged), shown with the load notices. */
export function addStartupNotices(notices: readonly Notice[]) {
  startupNotices = [...startupNotices, ...notices];
}

/** Reads storage once per page load (safe under StrictMode double renders). */
export function loadPlannerOnce(): LoadResult {
  if (cached) return cached;
  const loaded = loadPlanner();
  cached = { ...loaded, notices: [...startupNotices, ...loaded.notices] };
  return cached;
}

/**
 * Replaces the planner's data in storage (the signed-in account's plan, as the
 * cloud holds it). The older flat keys go too, so they are never migrated again.
 * Returns false when storage refused a write.
 */
export function writePlannerData(data: PlannerData): boolean {
  clearPlannerData();
  const saved = [
    writeKey(CAMP_KEYS.camps, campStore(data.camps)),
    data.activeCampId === null || writeKey(CAMP_KEYS.activeCamp, data.activeCampId),
    writeKey(STORAGE_KEYS.completed, data.completedMap),
    writeKey(PROGRESS_KEYS.completionDates, completionDatesStore(data.completionDates)),
    writeKey(PROGRESS_KEYS.focusSessions, focusSessionsStore(data.focusSessions)),
    writeKey(PROGRESS_KEYS.playlistSync, playlistSyncStore(data.playlistSync)),
    writeKey(UI_KEYS.dayNotes, data.dayNotes),
  ].every(Boolean);
  return saved && writeKey(LEGACY_MIGRATION_KEY, true);
}

/** Removes the planner's data from this browser (after it is safe in the account, or before another account's plan). */
export function clearPlannerData() {
  for (const key of DATA_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked: nothing was stored either.
    }
  }
}

/** Whether a load found any planner data at all. */
export function hasPlannerData(data: PlannerData): boolean {
  return (
    data.camps.length > 0 ||
    Object.keys(data.completedMap).length > 0 ||
    Object.keys(data.dayNotes).length > 0 ||
    data.focusSessions.length > 0
  );
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
      campScope: null,
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

/** Drops completion marks of videos that are no longer in any camp (their dates go with `datesOfCompleted`). */
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
    completionDates: data.completionDates,
    focusSessions: data.focusSessions,
    playlistSync: data.playlistSync,
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
  if (!isRecord(raw)) return { ok: false, error: 'Bu dosya bir Yetişir yedeği değil.' };
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
  // Backups from before completion dates: the record starts on the restore day.
  const completionDates = datesOfCompleted(
    normalizeCompletionDates(raw.completionDates, today) ?? emptyCompletionDates(today),
    completedMap
  );
  const focusSessions = normalizeFocusSessions(raw.focusSessions);
  const playlistSync = normalizePlaylistSync(raw.playlistSync) ?? emptyPlaylistSync();
  const dayNotes = normalizeDayNotes(raw.dayNotes);
  const videoIds = new Set(allBranches(camps).flatMap(p => p.videos.map(v => v.id)));
  const completed = Object.keys(completedMap).filter(id => videoIds.has(id)).length;
  const activeCampId =
    typeof raw.activeCampId === 'string' && camps.some(c => c.id === raw.activeCampId) ? raw.activeCampId : (camps[0]?.id ?? null);

  return {
    ok: true,
    data: { camps, activeCampId, completedMap, completionDates, focusSessions, playlistSync, dayNotes },
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
