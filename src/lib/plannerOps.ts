import type { CampSchedule, ShiftEvent, StudyCamp, SubjectPlaylist } from '../types/index.ts';
import type { DraftVideo } from '../utils/youtubeParser.ts';
import type { PlaylistEntry } from '../utils/youtubePlaylist.ts';
import { videoFromDraft, withVideos } from './camps.ts';
import { addDays, buildCampSchedule } from './engine.ts';
import type { FocusSession } from './focus.ts';
import type { PlannerData } from './persistence.ts';
import { datesOfCompleted, pruneCompletion } from './persistence.ts';
import type { PlaylistFailure } from './playlistImport.ts';
import type { PlaylistSync } from './playlistSync.ts';
import { diffPlaylist, draftFromPending, pendingOf } from './playlistSync.ts';
import { withBranchOnWeekdays, withoutBranch } from './studyCamp.ts';

// Pure updates of the planner data. The store hook (`usePlanner`) applies
// them; tests call them directly. Every camp-level change touches only the
// camp it names: each camp keeps its own branches, tempo and shift events.

function mapCamp(data: PlannerData, campId: string, fn: (camp: StudyCamp) => StudyCamp): PlannerData {
  return { ...data, camps: data.camps.map(c => (c.id === campId ? fn(c) : c)) };
}

/** Ticks or unticks a video. A tick records `today` as its day; ticking an already done video keeps its first day. */
export function setCompleted(data: PlannerData, videoId: string, done: boolean, today: string): PlannerData {
  if (done === (data.completedMap[videoId] === true)) return data;
  const completedMap = { ...data.completedMap };
  const dates = { ...data.completionDates.dates };
  if (done) {
    completedMap[videoId] = true;
    dates[videoId] = today;
  } else {
    delete completedMap[videoId];
    delete dates[videoId];
  }
  return { ...data, completedMap, completionDates: { ...data.completionDates, dates } };
}

/** Keeps what one focus player session did. */
export function addFocusSession(data: PlannerData, session: FocusSession): PlannerData {
  return { ...data, focusSessions: [...data.focusSessions, session] };
}

/** `next` with the completion marks (and their dates) of `removed` videos dropped when no camp uses them any more. */
function withoutRemovedCompletion(data: PlannerData, next: PlannerData, removed: readonly string[]): PlannerData {
  const completedMap = pruneCompletion(data.completedMap, removed, next.camps);
  return { ...next, completedMap, completionDates: datesOfCompleted(data.completionDates, completedMap) };
}

/** Adds a new camp and makes it the active one. */
export function createCamp(data: PlannerData, camp: StudyCamp): PlannerData {
  return { ...data, camps: [...data.camps, camp], activeCampId: camp.id };
}

export function setActiveCamp(data: PlannerData, campId: string): PlannerData {
  return data.camps.some(c => c.id === campId) ? { ...data, activeCampId: campId } : data;
}

export function renameCamp(data: PlannerData, campId: string, name: string): PlannerData {
  return mapCamp(data, campId, c => ({ ...c, name }));
}

/** Replaces one camp's tempo (schedule). Other camps are left as they are. */
export function setCampSchedule(data: PlannerData, campId: string, schedule: CampSchedule): PlannerData {
  return mapCamp(data, campId, c => ({ ...c, schedule }));
}

export function removeCamp(data: PlannerData, campId: string): PlannerData {
  const camp = data.camps.find(c => c.id === campId);
  const camps = data.camps.filter(c => c.id !== campId);
  const removed = camp ? camp.branches.flatMap(b => b.videos.map(v => v.id)) : [];
  const next: PlannerData = {
    ...data,
    camps,
    activeCampId: data.activeCampId === campId ? (camps[0]?.id ?? null) : data.activeCampId,
    playlistSync: withoutBranchSync(data.playlistSync, camp ? camp.branches.map(b => b.id) : []),
  };
  return withoutRemovedCompletion(data, next, removed);
}

/**
 * `camp` with new branches, as the add-branch wizard previews and saves it.
 * The camp keeps its id, name, dates and tempo; in manual mode the new
 * branches join `weekdays` (mock exam days excepted). The plan is laid out
 * from the camp's start date, so new tasks that would land on past days are
 * carried forward from tomorrow with one stored shift event. The new tasks
 * on today go with them, so each new branch still starts at its first video.
 * That event is marked `origin: 'branch-added'`: it is not a postponement.
 * `carried` counts the carried tasks.
 */
export function withAddedBranches(
  camp: StudyCamp,
  branches: readonly SubjectPlaylist[],
  options: { weekdays?: readonly number[]; completedMap?: Record<string, boolean>; today: string }
): { camp: StudyCamp; carried: number } {
  if (branches.length === 0) return { camp, carried: 0 };
  const { weekdays, completedMap = {}, today } = options;
  let schedule = camp.schedule;
  if (schedule.mode === 'manual' && weekdays) {
    for (const branch of branches) schedule = withBranchOnWeekdays(schedule, branch.id, weekdays);
  }
  const next: StudyCamp = { ...camp, branches: [...camp.branches, ...branches], schedule };
  const newIds = new Set(branches.map(b => b.id));
  const { plans } = buildCampSchedule(next, { completedMap, today });
  const newUntilToday = plans
    .filter(plan => plan.date <= today)
    .flatMap(plan => plan.items.filter(item => newIds.has(item.playlistId) && !item.completed).map(item => ({ id: item.id, date: plan.date })));
  if (!newUntilToday.some(item => item.date < today)) return { camp: next, carried: 0 };
  const shift: ShiftEvent = {
    date: today,
    resumeDate: addDays(today, 1),
    itemIds: newUntilToday.map(item => item.id),
    origin: 'branch-added',
  };
  return { camp: { ...next, shiftEvents: [...next.shiftEvents, shift] }, carried: shift.itemIds.length };
}

/** Adds branches to one existing camp (see `withAddedBranches`). No camp is created and no other camp changes. */
export function addBranches(
  data: PlannerData,
  campId: string,
  branches: readonly SubjectPlaylist[],
  options: { weekdays?: readonly number[]; today: string }
): PlannerData {
  if (branches.length === 0) return data;
  return mapCamp(data, campId, c => withAddedBranches(c, branches, { ...options, completedMap: data.completedMap }).camp);
}

/** Edits one branch. A new playlist link starts its playlist record over. */
export function updateBranch(data: PlannerData, campId: string, branch: SubjectPlaylist): PlannerData {
  const before = data.camps.find(c => c.id === campId)?.branches.find(b => b.id === branch.id);
  const edited = mapCamp(data, campId, c => ({ ...c, branches: c.branches.map(b => (b.id === branch.id ? branch : b)) }));
  const next =
    before && before.playlistUrl !== branch.playlistUrl
      ? { ...edited, playlistSync: withoutBranchSync(data.playlistSync, [branch.id]) }
      : edited;
  const keptIds = new Set(branch.videos.map(v => v.id));
  const removed = before ? before.videos.filter(v => !keptIds.has(v.id)).map(v => v.id) : [];
  return withoutRemovedCompletion(data, next, removed);
}

export function removeBranch(data: PlannerData, campId: string, branchId: string): PlannerData {
  const branch = data.camps.find(c => c.id === campId)?.branches.find(b => b.id === branchId);
  const next = mapCamp({ ...data, playlistSync: withoutBranchSync(data.playlistSync, [branchId]) }, campId, c => ({
    ...c,
    branches: c.branches.filter(b => b.id !== branchId),
    schedule: withoutBranch(c.schedule, branchId),
  }));
  const removed = branch ? branch.videos.map(v => v.id) : [];
  return withoutRemovedCompletion(data, next, removed);
}

export function addShiftEvent(data: PlannerData, campId: string, event: ShiftEvent): PlannerData {
  return mapCamp(data, campId, c => ({ ...c, shiftEvents: [...c.shiftEvents, event] }));
}

export function removeShiftEvent(data: PlannerData, campId: string, event: ShiftEvent): PlannerData {
  return mapCamp(data, campId, c => ({ ...c, shiftEvents: c.shiftEvents.filter(e => e !== event) }));
}

/** Several camps' shifts as one change (the "Tüm Kamplar" view): each event goes to its own camp only. */
export function addShiftEvents(data: PlannerData, shifts: readonly { campId: string; event: ShiftEvent }[]): PlannerData {
  return shifts.reduce((next, { campId, event }) => addShiftEvent(next, campId, event), data);
}

export function removeShiftEvents(data: PlannerData, shifts: readonly { campId: string; event: ShiftEvent }[]): PlannerData {
  return shifts.reduce((next, { campId, event }) => removeShiftEvent(next, campId, event), data);
}

// ---------------------------------------------------------------------------
// Playlist sync (see `src/lib/playlistSync.ts`)

function withoutBranchSync(sync: PlaylistSync, branchIds: readonly string[]): PlaylistSync {
  if (!branchIds.some(id => id in sync.branches)) return sync;
  const branches = { ...sync.branches };
  for (const id of branchIds) delete branches[id];
  return { ...sync, branches };
}

/** Stores what a fresh read of one branch's playlist found. */
export function recordPlaylistCheck(data: PlannerData, campId: string, branchId: string, entries: readonly PlaylistEntry[], today: string): PlannerData {
  const branch = data.camps.find(c => c.id === campId)?.branches.find(b => b.id === branchId);
  if (!branch) return data;
  const record = diffPlaylist(branch, entries, data.playlistSync.branches[branchId], today);
  return { ...data, playlistSync: { ...data.playlistSync, branches: { ...data.playlistSync.branches, [branchId]: record } } };
}

/** Ends the day's check; `failure` says why it stopped early, if it did. */
export function finishPlaylistCheck(data: PlannerData, today: string, failure: Exclude<PlaylistFailure, 'aborted'> | null): PlannerData {
  return { ...data, playlistSync: { ...data.playlistSync, lastAttempt: today, lastFailure: failure } };
}

/**
 * `camp` with `videos` appended to the end of one branch, in order. Like
 * `withAddedBranches`, new tasks that would land on past days are carried
 * (with the new ones on today) to tomorrow by one app-made event
 * (`origin: 'videos-added'`), so none of them starts overdue.
 */
export function withAppendedVideos(
  camp: StudyCamp,
  branchId: string,
  drafts: readonly DraftVideo[],
  options: { completedMap?: Record<string, boolean>; today: string }
): { camp: StudyCamp; carried: number } {
  const branch = camp.branches.find(b => b.id === branchId);
  if (!branch || drafts.length === 0) return { camp, carried: 0 };
  const start = branch.videos.length;
  const added = drafts.map((draft, i) => videoFromDraft(draft, branch.id, start + i + 1));
  const next: StudyCamp = {
    ...camp,
    branches: camp.branches.map(b => (b.id === branchId ? withVideos(b, [...b.videos, ...added]) : b)),
  };
  const { today, completedMap = {} } = options;
  const newIds = new Set(added.map(v => v.id));
  const { plans } = buildCampSchedule(next, { completedMap, today });
  const untilToday = plans
    .filter(plan => plan.date <= today)
    .flatMap(plan => plan.items.filter(item => newIds.has(item.videoId) && !item.completed).map(item => ({ id: item.id, date: plan.date })));
  if (!untilToday.some(item => item.date < today)) return { camp: next, carried: 0 };
  const shift: ShiftEvent = { date: today, resumeDate: addDays(today, 1), itemIds: untilToday.map(item => item.id), origin: 'videos-added' };
  return { camp: { ...next, shiftEvents: [...next.shiftEvents, shift] }, carried: shift.itemIds.length };
}

/** "Planımın sonuna ekle": the branch's waiting playlist videos join its end and the plan is laid out again. */
export function acceptPlaylistVideos(data: PlannerData, campId: string, branchId: string, today: string): PlannerData {
  const branch = data.camps.find(c => c.id === campId)?.branches.find(b => b.id === branchId);
  if (!branch) return data;
  const drafts = pendingOf(data.playlistSync, branch).map(draftFromPending);
  const cleared = dismissPlaylistVideos(data, branchId);
  if (drafts.length === 0) return cleared;
  return mapCamp(cleared, campId, c => withAppendedVideos(c, branchId, drafts, { completedMap: data.completedMap, today }).camp);
}

/** "Göz ardı et": the waiting videos are dropped; they stay seen, so they are not offered again. */
export function dismissPlaylistVideos(data: PlannerData, branchId: string): PlannerData {
  const record = data.playlistSync.branches[branchId];
  if (!record || record.pending.length === 0) return data;
  return {
    ...data,
    playlistSync: { ...data.playlistSync, branches: { ...data.playlistSync.branches, [branchId]: { ...record, pending: [] } } },
  };
}
