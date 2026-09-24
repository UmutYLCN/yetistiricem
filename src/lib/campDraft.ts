import type { CampSchedule, PlanMode, StudyCamp, SubjectPlaylist, UserPreferences } from '../types';
import { isDateKey, sanitizeWeekPlan } from './engine.ts';
import { PALETTE, defaultColorKey } from './subjects.ts';
import type { AutoRhythm, ManualRhythm, ScheduleBase } from './studyCamp.ts';
import {
  DEFAULT_AUTO_RHYTHM,
  MAX_BRANCH_NAME,
  MAX_CAMP_NAME,
  MAX_DAILY_HOURS,
  MIN_DAILY_HOURS,
  WEEKDAYS,
  autoRhythmOf,
  createStudyCamp,
  emptyWeekPlan,
  manualRhythmOf,
  normalizeCampSchedule,
  resolveAutoRhythm,
  scheduleFromAuto,
  scheduleFromManual,
  suggestWeekPlan,
  unassignedBranches,
} from './studyCamp.ts';

// The camp wizard's draft: what each step edits, how it is validated and how
// it becomes a camp. Kept free of React so the rules are tested directly.

export interface RhythmDraft {
  /** Null until the user picks how the week is formed. */
  mode: PlanMode | null;
  auto: AutoRhythm;
  manual: ManualRhythm;
  playbackSpeed: number;
  practiceMultiplier: number;
}

export interface CampDraft {
  branches: SubjectPlaylist[];
  name: string;
  startDate: string;
  /** '' = no target date. */
  targetEndDate: string;
  rhythm: RhythmDraft;
}

/** Watch speed and practice share: personal habits a new camp may borrow from another camp. */
export type StudyHabits = Pick<UserPreferences, 'playbackSpeed' | 'practiceMultiplier'>;

/**
 * Starting values: an older version's saved preferences (if any), else the
 * balanced preset. `habits` only lends speed and practice share, so a new
 * camp never inherits another camp's tempo.
 */
export function initialRhythm(seed: UserPreferences | null, habits: StudyHabits | null = null): RhythmDraft {
  const auto = seed
    ? autoRhythmOf({ ...seed, mode: 'auto', targetEndDate: null, weekPlan: emptyWeekPlan() })
    : { ...DEFAULT_AUTO_RHYTHM };
  return {
    mode: null,
    auto,
    manual: { hours: resolveAutoRhythm(auto).hours, dayTypes: WEEKDAYS.map(d => (d === 0 ? 'rest' : 'study')), weekPlan: emptyWeekPlan() },
    playbackSpeed: seed?.playbackSpeed ?? habits?.playbackSpeed ?? 1,
    practiceMultiplier: seed?.practiceMultiplier ?? habits?.practiceMultiplier ?? 0.2,
  };
}

export function initialDraft(today: string, seed: UserPreferences | null, habits: StudyHabits | null = null): CampDraft {
  return { branches: [], name: '', startDate: today, targetEndDate: '', rhythm: initialRhythm(seed, habits) };
}

/**
 * Manual mode's first week: the study weekdays of the current automatic
 * rhythm, each with a fair rotation of the branches.
 */
export function startManualWeek(rhythm: RhythmDraft, branches: SubjectPlaylist[]): ManualRhythm {
  const auto = resolveAutoRhythm(rhythm.auto);
  const ids = branches.map(b => b.id);
  return {
    hours: auto.hours,
    dayTypes: WEEKDAYS.map(d => (auto.days.includes(d) ? 'study' : auto.mockDays.includes(d) ? 'mock' : 'rest')),
    weekPlan: suggestWeekPlan(ids, auto.days, Math.min(auto.perDay, ids.length)),
  };
}

/** Keeps a manual week plan in step with the branch list (removed branches drop out). */
export function syncManual(manual: ManualRhythm, branches: SubjectPlaylist[]): ManualRhythm {
  return { ...manual, weekPlan: sanitizeWeekPlan(manual.weekPlan, branches.map(b => b.id)) };
}

/**
 * Puts every unassigned branch on the study day that has the fewest
 * branches (earliest in the week on ties), so nothing is left out.
 */
export function assignLeftovers(manual: ManualRhythm, branches: SubjectPlaylist[]): ManualRhythm {
  const weekPlan = manual.weekPlan.map(day => [...day]);
  const studyDays = [1, 2, 3, 4, 5, 6, 0].filter(d => manual.dayTypes[d] === 'study');
  if (studyDays.length === 0) return manual;
  for (const branch of unassignedBranches(manual, branches)) {
    const target = studyDays.reduce((best, d) => (weekPlan[d].length < weekPlan[best].length ? d : best), studyDays[0]);
    weekPlan[target].push(branch.id);
  }
  return syncManual({ ...manual, weekPlan }, branches);
}

/** The form values that reproduce a saved schedule (the tempo dialog starts from these). */
export function rhythmDraftOf(schedule: CampSchedule, branchIds: readonly string[]): RhythmDraft {
  return {
    mode: schedule.mode,
    auto: autoRhythmOf(schedule),
    manual: manualRhythmOf(schedule, branchIds),
    playbackSpeed: schedule.playbackSpeed,
    practiceMultiplier: schedule.practiceMultiplier,
  };
}

/**
 * Whether two schedules plan the same way (after the same normalization the
 * stored data gets). Used so an unchanged tempo form never rewrites a camp.
 */
export function sameSchedule(a: CampSchedule, b: CampSchedule, branchIds: readonly string[]): boolean {
  const norm = (s: CampSchedule) => {
    const { schedule } = normalizeCampSchedule(s, branchIds);
    const { preset: _preset, ...rest } = schedule;
    // Compare what the planner uses: the effective study, mock and rest weekdays.
    const study = rest.activeDays.filter(d => !rest.restDays.includes(d) && !rest.mockExamDays.includes(d));
    return JSON.stringify({ ...rest, activeDays: study, restDays: WEEKDAYS.filter(d => !study.includes(d) && !rest.mockExamDays.includes(d)) });
  };
  return norm(a) === norm(b);
}

export function scheduleOf(draft: Pick<CampDraft, 'startDate' | 'targetEndDate' | 'rhythm'>): CampSchedule {
  const { rhythm } = draft;
  const base: ScheduleBase = {
    startDate: draft.startDate,
    targetEndDate: draft.targetEndDate || null,
    playbackSpeed: rhythm.playbackSpeed,
    practiceMultiplier: rhythm.practiceMultiplier,
  };
  if (rhythm.mode === 'manual') {
    return scheduleFromManual(base, rhythm.manual, { maxSubjectsPerDay: resolveAutoRhythm(rhythm.auto).perDay, preset: rhythm.auto.preset });
  }
  return scheduleFromAuto(base, rhythm.auto, rhythm.manual.weekPlan);
}

/** The camp the draft would create (fresh id). */
export function campFromDraft(draft: CampDraft, today: string): StudyCamp {
  return createStudyCamp({ name: draft.name, branches: draft.branches, schedule: scheduleOf(draft) }, today);
}

// ---------------------------------------------------------------------------
// Validation, one step at a time. Each returns user-facing Turkish messages.

export interface SourceErrors {
  /** No branch yet. */
  empty?: string;
  /** Per branch id. */
  branches: Record<string, string>;
}

export function sourceErrors(branches: SubjectPlaylist[]): SourceErrors {
  const errors: SourceErrors = { branches: {} };
  if (branches.length === 0) errors.empty = 'En az bir oynatma listesi ya da video ekle.';
  for (const branch of branches) {
    if (!branch.subject.trim()) errors.branches[branch.id] = 'Branşa bir ad ver.';
    else if (branch.subject.trim().length > MAX_BRANCH_NAME) errors.branches[branch.id] = `Branş adı en fazla ${MAX_BRANCH_NAME} karakter olabilir.`;
    else if (branch.videos.length === 0) errors.branches[branch.id] = 'Bu branşta video yok; video ekle ya da branşı kaldır.';
  }
  return errors;
}

export function hasSourceErrors(errors: SourceErrors): boolean {
  return Boolean(errors.empty) || Object.keys(errors.branches).length > 0;
}

export interface DetailErrors {
  name?: string;
  startDate?: string;
  targetEndDate?: string;
}

const isUsableDate = (value: string) => isDateKey(value) && value >= '2000-01-01' && value <= '2100-12-31';

export function detailErrors(draft: Pick<CampDraft, 'name' | 'startDate' | 'targetEndDate'>): DetailErrors {
  const errors: DetailErrors = {};
  if (!draft.name.trim()) errors.name = 'Kampına bir ad ver.';
  else if (draft.name.trim().length > MAX_CAMP_NAME) errors.name = `Ad en fazla ${MAX_CAMP_NAME} karakter olabilir.`;
  if (!isUsableDate(draft.startDate)) errors.startDate = 'Geçerli bir başlangıç tarihi seç.';
  if (draft.targetEndDate) {
    if (!isUsableDate(draft.targetEndDate)) errors.targetEndDate = 'Geçerli bir tarih seç ya da boş bırak.';
    else if (isUsableDate(draft.startDate) && draft.targetEndDate < draft.startDate) errors.targetEndDate = 'Hedef tarih başlangıçtan önce olamaz.';
  }
  return errors;
}

export interface RhythmErrors {
  mode?: string;
  days?: string;
  hours?: string;
  /** Manual mode: weekday → message. */
  weekdays: Record<number, string>;
  /** Manual mode: branches no study weekday includes. */
  unassigned?: string;
}

export function hoursError(hours: number): string | undefined {
  if (!Number.isFinite(hours)) return 'Saat olarak bir sayı seç.';
  if (hours < MIN_DAILY_HOURS) return 'Günde en az yarım saat olmalı.';
  if (hours > MAX_DAILY_HOURS) return `Günde en fazla ${MAX_DAILY_HOURS} saat seçebilirsin.`;
  return undefined;
}

export function rhythmErrors(rhythm: RhythmDraft, branches: SubjectPlaylist[]): RhythmErrors {
  const errors: RhythmErrors = { weekdays: {} };
  if (rhythm.mode === null) {
    errors.mode = 'Haftalık planın nasıl oluşacağını seç.';
    return errors;
  }
  if (rhythm.mode === 'auto') {
    const values = resolveAutoRhythm(rhythm.auto);
    if (values.days.length === 0) errors.days = 'En az bir çalışma günü seç; yoksa videolar hiçbir güne yerleşmez.';
    const hours = hoursError(values.hours);
    if (hours) errors.hours = hours;
    return errors;
  }
  const { manual } = rhythm;
  const hours = hoursError(manual.hours);
  if (hours) errors.hours = hours;
  for (const dow of WEEKDAYS) {
    if (manual.dayTypes[dow] === 'study' && manual.weekPlan[dow].length === 0) {
      errors.weekdays[dow] = 'Bu güne branş seç ya da günü dinlenme yap.';
    }
  }
  if (!manual.dayTypes.includes('study')) errors.days = 'En az bir günü ders günü yap.';
  const left = unassignedBranches(manual, branches);
  if (left.length > 0) {
    errors.unassigned = `${left.map(b => b.subject).join(', ')} hiçbir güne yerleşmedi; videoları plana giremez.`;
  }
  return errors;
}

export function hasRhythmErrors(errors: RhythmErrors): boolean {
  return Boolean(errors.mode || errors.days || errors.hours || errors.unassigned) || Object.keys(errors.weekdays).length > 0;
}

// ---------------------------------------------------------------------------

/** The subject's own colour if no branch uses it yet, else the first unused one. */
export function pickColor(subject: string, used: readonly string[]): string {
  const preferred = defaultColorKey(subject);
  if (!used.includes(preferred)) return preferred;
  return PALETTE.find(c => !used.includes(c.key))?.key ?? preferred;
}

/** Branch names used more than once (they count as one branch in the automatic daily cap). */
export function sharedBranchNames(branches: SubjectPlaylist[]): Set<string> {
  const seen = new Map<string, number>();
  for (const b of branches) {
    const key = b.subject.trim().toLocaleLowerCase('tr-TR');
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return new Set([...seen].filter(([, n]) => n > 1).map(([name]) => name));
}
