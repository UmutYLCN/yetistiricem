import type { CampSchedule, ShiftEvent, StudyCamp, SubjectPlaylist } from '../types';
import type { PlannerData } from './persistence.ts';
import { MAX_NOTE_LENGTH, pruneCompletion } from './persistence.ts';
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
 * Adds a branch to a camp. `weekdays` (manual mode) lists the weekdays it
 * joins; `shift` carries its tasks that would land on past days.
 */
export function addBranch(
  data: PlannerData,
  campId: string,
  branch: SubjectPlaylist,
  options: { weekdays?: number[]; shift?: ShiftEvent | null } = {}
): PlannerData {
  return mapCamp(data, campId, c => ({
    ...c,
    branches: [...c.branches, branch],
    schedule: options.weekdays ? withBranchOnWeekdays(c.schedule, branch.id, options.weekdays) : c.schedule,
    shiftEvents: options.shift ? [...c.shiftEvents, options.shift] : c.shiftEvents,
  }));
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

export function setDayNote(data: PlannerData, date: string, text: string): PlannerData {
  const dayNotes = { ...data.dayNotes };
  const value = text.slice(0, MAX_NOTE_LENGTH);
  if (value.trim()) dayNotes[date] = value;
  else delete dayNotes[date];
  return { ...data, dayNotes };
}
