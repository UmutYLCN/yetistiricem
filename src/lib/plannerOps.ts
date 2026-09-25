import type { CampSchedule, ShiftEvent, StudyCamp, SubjectPlaylist } from '../types';
import { addDays, buildCampSchedule } from './engine.ts';
import type { PlannerData } from './persistence.ts';
import { pruneCompletion } from './persistence.ts';
import { withBranchOnWeekdays, withoutBranch } from './studyCamp.ts';

// Pure updates of the planner data. The store hook (`usePlanner`) applies
// them; tests call them directly. Every camp-level change touches only the
// camp it names: each camp keeps its own branches, tempo and shift events.

function mapCamp(data: PlannerData, campId: string, fn: (camp: StudyCamp) => StudyCamp): PlannerData {
  return { ...data, camps: data.camps.map(c => (c.id === campId ? fn(c) : c)) };
}

export function setCompleted(data: PlannerData, videoId: string, done: boolean): PlannerData {
  const completedMap = { ...data.completedMap };
  if (done) completedMap[videoId] = true;
  else delete completedMap[videoId];
  return { ...data, completedMap };
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
  return {
    ...data,
    camps,
    activeCampId: data.activeCampId === campId ? (camps[0]?.id ?? null) : data.activeCampId,
    completedMap: pruneCompletion(data.completedMap, removed, camps),
  };
}

/**
 * `camp` with new branches, as the add-branch wizard previews and saves it.
 * The camp keeps its id, name, dates and tempo; in manual mode the new
 * branches join `weekdays` (mock exam days excepted). The plan is laid out
 * from the camp's start date, so new tasks that would land on past days are
 * carried forward from tomorrow with one stored shift event. The new tasks
 * on today go with them, so each new branch still starts at its first video.
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
  const shift: ShiftEvent = { date: today, resumeDate: addDays(today, 1), itemIds: newUntilToday.map(item => item.id) };
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

export function updateBranch(data: PlannerData, campId: string, branch: SubjectPlaylist): PlannerData {
  const before = data.camps.find(c => c.id === campId)?.branches.find(b => b.id === branch.id);
  const next = mapCamp(data, campId, c => ({ ...c, branches: c.branches.map(b => (b.id === branch.id ? branch : b)) }));
  const keptIds = new Set(branch.videos.map(v => v.id));
  const removed = before ? before.videos.filter(v => !keptIds.has(v.id)).map(v => v.id) : [];
  return { ...next, completedMap: pruneCompletion(data.completedMap, removed, next.camps) };
}

export function removeBranch(data: PlannerData, campId: string, branchId: string): PlannerData {
  const branch = data.camps.find(c => c.id === campId)?.branches.find(b => b.id === branchId);
  const next = mapCamp(data, campId, c => ({
    ...c,
    branches: c.branches.filter(b => b.id !== branchId),
    schedule: withoutBranch(c.schedule, branchId),
  }));
  const removed = branch ? branch.videos.map(v => v.id) : [];
  return { ...next, completedMap: pruneCompletion(data.completedMap, removed, next.camps) };
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
