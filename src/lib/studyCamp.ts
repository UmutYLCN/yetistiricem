import type { CampSchedule, PlanMode, RhythmPreset, ShiftEvent, StudyCamp, SubjectPlaylist, UserPreferences, Video } from '../types';
import {
  defaultPreferences,
  inspectPreferences,
  normalizeDateKey,
  normalizeShiftEvents,
  sanitizeWeekPlan,
  todayKey,
} from './engine.ts';
import { newId } from './camps.ts';
import { SUBJECTS } from './subjects.ts';

// Study camps: a named program (e.g. "TYT 2027") that owns several branches
// (Matematik, Fizik, … — each an ordered video list) and one schedule.
// Pure data helpers: normalizing stored camps, migrating the older flat data,
// rhythm presets and the manual week plan. No storage access here.

export const DEFAULT_CAMP_NAME = 'Çalışma kampım';
export const MAX_CAMP_NAME = 80;
export const MAX_BRANCH_NAME = 40;
/** Hours a day the planner accepts from the forms. */
export const MIN_DAILY_HOURS = 0.5;
export const MAX_DAILY_HOURS = 16;

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// ---------------------------------------------------------------------------
// Rhythm presets

export interface RhythmValues {
  /** Daily study time in hours. */
  hours: number;
  /** Distinct branches per study day (automatic mode). */
  perDay: number;
  /** Study weekdays (0 = Sunday). */
  days: number[];
  /** Mock exam weekdays. */
  mockDays: number[];
}

export interface RhythmPresetInfo extends RhythmValues {
  label: string;
  summary: string;
}

export const RHYTHM_PRESETS: Record<RhythmPreset, RhythmPresetInfo> = {
  light: { label: 'Hafif', summary: 'Hafta içi, günde 2 saat ve 2 branş', hours: 2, perDay: 2, days: [1, 2, 3, 4, 5], mockDays: [] },
  balanced: {
    label: 'Dengeli',
    summary: 'Pazartesi–Cumartesi, günde 4 saat ve 3 branş',
    hours: 4,
    perDay: 3,
    days: [1, 2, 3, 4, 5, 6],
    mockDays: [],
  },
  intense: {
    label: 'Yoğun',
    summary: 'Pazartesi–Cumartesi 6 saat, 4 branş; Pazar deneme',
    hours: 6,
    perDay: 4,
    days: [1, 2, 3, 4, 5, 6],
    mockDays: [0],
  },
};

export const PRESET_ORDER: RhythmPreset[] = ['light', 'balanced', 'intense'];

/** Automatic rhythm: a preset plus the fields the user set themselves (null = use the preset). */
export interface AutoRhythm {
  preset: RhythmPreset;
  hours: number | null;
  perDay: number | null;
  days: number[] | null;
  mockDays: number[] | null;
}

export const DEFAULT_AUTO_RHYTHM: AutoRhythm = { preset: 'balanced', hours: null, perDay: null, days: null, mockDays: null };

export function resolveAutoRhythm(rhythm: AutoRhythm): RhythmValues {
  const preset = RHYTHM_PRESETS[rhythm.preset] ?? RHYTHM_PRESETS.balanced;
  const days = [...(rhythm.days ?? preset.days)].sort((a, b) => a - b);
  // A study weekday cannot also be a mock exam day.
  const mockDays = (rhythm.mockDays ?? preset.mockDays).filter(d => !days.includes(d));
  return { hours: rhythm.hours ?? preset.hours, perDay: rhythm.perDay ?? preset.perDay, days, mockDays };
}

/** The automatic rhythm that reproduces a stored schedule: its preset, with every differing field as an override. */
export function autoRhythmOf(schedule: CampSchedule): AutoRhythm {
  const preset = schedule.preset && RHYTHM_PRESETS[schedule.preset] ? schedule.preset : 'balanced';
  const base = RHYTHM_PRESETS[preset];
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((d, i) => d === b[i]);
  const days = schedule.activeDays.filter(d => !schedule.restDays.includes(d) && !schedule.mockExamDays.includes(d));
  return {
    preset,
    hours: schedule.dailyStudyHours === base.hours ? null : schedule.dailyStudyHours,
    perDay: schedule.maxSubjectsPerDay === base.perDay ? null : schedule.maxSubjectsPerDay,
    days: same(days, base.days) ? null : days,
    mockDays: same(schedule.mockExamDays, base.mockDays) ? null : [...schedule.mockExamDays],
  };
}

// ---------------------------------------------------------------------------
// Manual week plan

export type WeekdayType = 'study' | 'mock' | 'rest';

/** Manual rhythm as the form edits it: a type and the branches of every weekday. */
export interface ManualRhythm {
  hours: number;
  dayTypes: WeekdayType[];
  weekPlan: string[][];
}

export function emptyWeekPlan(): string[][] {
  return WEEKDAYS.map(() => []);
}

/**
 * A starting week plan: `perDay` branches on each study day, rotating so each
 * branch gets a fair share of the week.
 */
export function suggestWeekPlan(branchIds: readonly string[], studyDays: readonly number[], perDay: number): string[][] {
  const plan = emptyWeekPlan();
  if (branchIds.length === 0 || studyDays.length === 0) return plan;
  const count = Math.max(1, Math.min(Math.floor(perDay) || 1, branchIds.length));
  // Monday-first, so the rotation reads naturally through the week.
  const ordered = [...studyDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  let next = 0;
  for (const dow of ordered) {
    const day: string[] = [];
    for (let i = 0; i < count; i++) day.push(branchIds[(next + i) % branchIds.length]);
    next = (next + count) % branchIds.length;
    plan[dow] = branchIds.filter(id => day.includes(id));
  }
  return plan;
}

export function manualRhythmOf(schedule: CampSchedule, branchIds: readonly string[]): ManualRhythm {
  const weekPlan = sanitizeWeekPlan(schedule.weekPlan, branchIds);
  const dayTypes = WEEKDAYS.map((dow): WeekdayType =>
    schedule.mockExamDays.includes(dow) ? 'mock' : weekPlan[dow].length > 0 ? 'study' : 'rest'
  );
  return { hours: schedule.dailyStudyHours, dayTypes, weekPlan };
}

/**
 * Adds a branch to the given weekdays of a schedule's week plan. In manual
 * mode the study weekdays follow the plan (a rest weekday that gets the
 * branch becomes a study day); mock exam days stay as they are.
 */
export function withBranchOnWeekdays(schedule: CampSchedule, branchId: string, weekdays: readonly number[]): CampSchedule {
  const weekPlan = WEEKDAYS.map(dow =>
    weekdays.includes(dow) && !schedule.mockExamDays.includes(dow) && !schedule.weekPlan[dow]?.includes(branchId)
      ? [...(schedule.weekPlan[dow] ?? []), branchId]
      : [...(schedule.weekPlan[dow] ?? [])]
  );
  if (schedule.mode !== 'manual') return { ...schedule, weekPlan };
  const mock = schedule.mockExamDays;
  const activeDays = WEEKDAYS.filter(d => weekPlan[d].length > 0 && !mock.includes(d));
  return { ...schedule, weekPlan, activeDays, restDays: WEEKDAYS.filter(d => !activeDays.includes(d) && !mock.includes(d)) };
}

/** Removes a branch from a schedule's week plan (manual study weekdays follow). */
export function withoutBranch(schedule: CampSchedule, branchId: string): CampSchedule {
  const weekPlan = schedule.weekPlan.map(day => day.filter(id => id !== branchId));
  if (schedule.mode !== 'manual') return { ...schedule, weekPlan };
  const mock = schedule.mockExamDays;
  const activeDays = WEEKDAYS.filter(d => (weekPlan[d]?.length ?? 0) > 0 && !mock.includes(d));
  return { ...schedule, weekPlan, activeDays, restDays: WEEKDAYS.filter(d => !activeDays.includes(d) && !mock.includes(d)) };
}

/** Branches with videos that no study weekday includes. */
export function unassignedBranches(manual: ManualRhythm, branches: readonly SubjectPlaylist[]): SubjectPlaylist[] {
  const used = new Set(WEEKDAYS.flatMap(d => (manual.dayTypes[d] === 'study' ? manual.weekPlan[d] : [])));
  return branches.filter(b => b.videos.length > 0 && !used.has(b.id));
}

// ---------------------------------------------------------------------------
// Building a schedule from the forms

export interface ScheduleBase {
  startDate: string;
  targetEndDate: string | null;
  playbackSpeed: number;
  practiceMultiplier: number;
}

export function scheduleFromAuto(base: ScheduleBase, rhythm: AutoRhythm, keepWeekPlan: string[][] = emptyWeekPlan()): CampSchedule {
  const values = resolveAutoRhythm(rhythm);
  return {
    dailyStudyHours: values.hours,
    playbackSpeed: base.playbackSpeed,
    practiceMultiplier: base.practiceMultiplier,
    maxSubjectsPerDay: values.perDay,
    activeDays: values.days,
    restDays: WEEKDAYS.filter(d => !values.days.includes(d) && !values.mockDays.includes(d)),
    mockExamDays: values.mockDays,
    startDate: base.startDate,
    mode: 'auto',
    targetEndDate: base.targetEndDate,
    weekPlan: keepWeekPlan,
    preset: rhythm.preset,
  };
}

export function scheduleFromManual(base: ScheduleBase, manual: ManualRhythm, keep: { maxSubjectsPerDay: number; preset?: RhythmPreset }): CampSchedule {
  const study = WEEKDAYS.filter(d => manual.dayTypes[d] === 'study' && manual.weekPlan[d].length > 0);
  const mock = WEEKDAYS.filter(d => manual.dayTypes[d] === 'mock');
  return {
    dailyStudyHours: manual.hours,
    playbackSpeed: base.playbackSpeed,
    practiceMultiplier: base.practiceMultiplier,
    maxSubjectsPerDay: keep.maxSubjectsPerDay,
    activeDays: study,
    restDays: WEEKDAYS.filter(d => !study.includes(d) && !mock.includes(d)),
    mockExamDays: mock,
    startDate: base.startDate,
    mode: 'manual',
    targetEndDate: base.targetEndDate,
    weekPlan: WEEKDAYS.map(d => (study.includes(d) ? [...manual.weekPlan[d]] : [])),
    ...(keep.preset ? { preset: keep.preset } : {}),
  };
}

// ---------------------------------------------------------------------------
// Normalizing stored data

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

export interface PlaylistNormalization {
  playlists: SubjectPlaylist[];
  droppedCamps: number;
  droppedVideos: number;
}

/** Branch lists (the older versions' `yt_playlists`); `seen` keeps ids unique across camps. */
export function normalizePlaylists(raw: unknown, seen: Set<string> = new Set()): PlaylistNormalization {
  const result: PlaylistNormalization = { playlists: [], droppedCamps: 0, droppedVideos: 0 };
  if (!Array.isArray(raw)) return result;
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
      title: typeof item.title === 'string' && item.title.trim() ? item.title : 'Adsız liste',
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

export interface ScheduleNormalization {
  schedule: CampSchedule;
  invalidFields: (keyof UserPreferences)[];
}

/**
 * Validates a stored camp schedule. The planner fields go through the same
 * checks as the older global preferences; `mode`, `targetEndDate` and
 * `weekPlan` fall back quietly (auto mode, no deadline, empty week).
 */
export function normalizeCampSchedule(raw: unknown, branchIds: readonly string[]): ScheduleNormalization {
  const input = isRecord(raw) ? raw : {};
  const { preferences, invalidFields } = inspectPreferences(input);
  const mode: PlanMode = input.mode === 'manual' ? 'manual' : 'auto';
  const targetEndDate = normalizeDateKey(input.targetEndDate, '') || null;
  const weekPlan = sanitizeWeekPlan(Array.isArray(input.weekPlan) ? (input.weekPlan as string[][]) : null, branchIds);
  const preset = typeof input.preset === 'string' && input.preset in RHYTHM_PRESETS ? (input.preset as RhythmPreset) : undefined;
  const schedule: CampSchedule = {
    ...preferences,
    mode,
    targetEndDate: targetEndDate && targetEndDate >= preferences.startDate ? targetEndDate : null,
    weekPlan,
    ...(preset ? { preset } : {}),
  };
  if (mode === 'manual') {
    // Keep the weekday lists in charge, as the engine does.
    const mock = schedule.mockExamDays;
    schedule.activeDays = WEEKDAYS.filter(d => weekPlan[d].length > 0 && !mock.includes(d));
    schedule.restDays = WEEKDAYS.filter(d => !schedule.activeDays.includes(d) && !mock.includes(d));
    schedule.weekPlan = WEEKDAYS.map(d => (schedule.activeDays.includes(d) ? weekPlan[d] : []));
  }
  return { schedule, invalidFields };
}

export interface CampsNormalization {
  camps: StudyCamp[];
  droppedCamps: number;
  droppedBranches: number;
  droppedVideos: number;
  /** Per camp name: planner fields that fell back to defaults. */
  invalidSchedules: { name: string; fields: (keyof UserPreferences)[] }[];
}

export function normalizeCamps(raw: unknown, today: string = todayKey()): CampsNormalization {
  const result: CampsNormalization = { camps: [], droppedCamps: 0, droppedBranches: 0, droppedVideos: 0, invalidSchedules: [] };
  if (!Array.isArray(raw)) return result;
  const campIds = new Set<string>();
  const branchIds = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || campIds.has(item.id)) {
      result.droppedCamps++;
      continue;
    }
    campIds.add(item.id);
    const branches = normalizePlaylists(item.branches, branchIds);
    result.droppedBranches += branches.droppedCamps;
    result.droppedVideos += branches.droppedVideos;
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, MAX_CAMP_NAME) : DEFAULT_CAMP_NAME;
    const { schedule, invalidFields } = normalizeCampSchedule(item.schedule, branches.playlists.map(b => b.id));
    if (invalidFields.length > 0) result.invalidSchedules.push({ name, fields: invalidFields });
    result.camps.push({
      id: item.id,
      name,
      createdAt: normalizeDateKey(item.createdAt, today),
      branches: branches.playlists,
      schedule,
      shiftEvents: normalizeShiftEvents(item.shiftEvents),
      ...(item.origin === 'migrated' ? { origin: 'migrated' as const } : {}),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Creating camps

export function createStudyCamp(input: { name: string; branches: SubjectPlaylist[]; schedule: CampSchedule }, today: string = todayKey()): StudyCamp {
  return {
    id: newId('camp'),
    name: input.name.trim().slice(0, MAX_CAMP_NAME) || DEFAULT_CAMP_NAME,
    createdAt: today,
    branches: input.branches,
    schedule: { ...input.schedule, weekPlan: sanitizeWeekPlan(input.schedule.weekPlan, input.branches.map(b => b.id)) },
    shiftEvents: [],
  };
}

/** The camp id used for data migrated from the older flat layout; fixed so a retried migration is identical. */
export const MIGRATED_CAMP_ID = 'camp-migrated';

export interface LegacyData {
  preferences: UserPreferences;
  playlists: SubjectPlaylist[];
  shiftEvents: ShiftEvent[];
}

/**
 * Wraps the older flat data (every "camp" a separate playlist, one global
 * preference set) into one parent camp. Branches, videos, links, durations,
 * ids and shift events are kept exactly, and the schedule stays automatic
 * with the same preferences, so the plan layout does not change. Nothing is
 * invented: the only new values are the camp's name, id and creation day.
 */
export function migrateLegacyData(legacy: LegacyData, today: string = todayKey()): StudyCamp {
  return {
    id: MIGRATED_CAMP_ID,
    name: DEFAULT_CAMP_NAME,
    createdAt: today,
    branches: legacy.playlists,
    schedule: { ...legacy.preferences, mode: 'auto', targetEndDate: null, weekPlan: emptyWeekPlan() },
    shiftEvents: legacy.shiftEvents,
    origin: 'migrated',
  };
}

export function defaultSchedule(startDate: string): CampSchedule {
  return { ...defaultPreferences, startDate, mode: 'auto', targetEndDate: null, weekPlan: emptyWeekPlan(), preset: 'balanced' };
}

// ---------------------------------------------------------------------------
// Branch names

const SUBJECT_ALIASES: Record<string, string[]> = {
  Matematik: ['matematik', 'math'],
  Geometri: ['geometri', 'geometry'],
  Fizik: ['fizik', 'physics'],
  Kimya: ['kimya', 'chemistry'],
  Biyoloji: ['biyoloji', 'biology'],
  Türkçe: ['türkçe', 'paragraf', 'dil bilgisi', 'dilbilgisi'],
  Edebiyat: ['edebiyat'],
  Tarih: ['tarih', 'inkılap'],
  Coğrafya: ['coğrafya'],
  Felsefe: ['felsefe', 'mantık', 'psikoloji', 'sosyoloji'],
  'Din Kültürü': ['din kültürü'],
  İngilizce: ['ingilizce', 'english', 'yds', 'ydt'],
};

/**
 * A branch name suggestion for a source list: the first school subject its
 * title mentions ("2026 TYT Matematik Kampı" → Matematik), else the title
 * itself. Only a label; the user can rename it.
 */
export function guessBranchName(title: string): string {
  const lower = title.toLocaleLowerCase('tr-TR');
  for (const subject of SUBJECTS) {
    if ((SUBJECT_ALIASES[subject] ?? []).some(alias => lower.includes(alias))) return subject;
  }
  const clean = title.replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, MAX_BRANCH_NAME) : 'Yeni branş';
}

/** Every branch of every camp, for id lookups and completion pruning. */
export function allBranches(camps: readonly StudyCamp[]): SubjectPlaylist[] {
  return camps.flatMap(c => c.branches);
}
