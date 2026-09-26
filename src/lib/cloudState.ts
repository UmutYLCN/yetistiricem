import type { PlannerData } from './persistence.ts';
import { createBackup, datesOfCompleted, parseBackup } from './persistence.ts';

// Each account's plan lives in Supabase (`planner_states`, one row per user:
// the backup document plus a revision), and this browser keeps a working copy
// in the usual `yt_*` keys. `yt_sync` says whose copy it is, which cloud
// revision it builds on and whether it has changes not saved yet. Pure parts
// only; the network side is `src/lib/cloudSync.ts`. See docs/kesfet.md.

export const SYNC_KEY = 'yt_sync';

export interface SyncMeta {
  /** The account this browser's copy belongs to. */
  owner: string;
  /** The cloud revision the copy builds on; 0 = not in the cloud yet. */
  revision: number;
  /** The copy has changes the cloud does not have yet. */
  dirty: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function readSyncMetaValue(raw: unknown): SyncMeta | null {
  if (!isRecord(raw) || typeof raw.owner !== 'string' || !raw.owner) return null;
  const revision = typeof raw.revision === 'number' && Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0;
  return { owner: raw.owner, revision, dirty: raw.dirty === true };
}

/** Changes of an account that could not reach the cloud before it signed out, kept for its next sign-in here. */
export function unsyncedKey(owner: string): string {
  return `yt_unsynced__${owner}`;
}

/** Local changes that lost to newer cloud data (another device saved first); kept, never dropped. */
export const CONFLICT_KEY = 'yt_sync__cakisma';

/** The cloud document: a backup without the per-device parts. */
export function toCloudDocument(data: PlannerData) {
  const { exportedAt: _exportedAt, selectedDate: _selectedDate, ...document } = createBackup(data, '');
  return document;
}

/** The plan in a cloud document, checked like a backup file; null when it is not usable. */
export function fromCloudDocument(raw: unknown, today: string): PlannerData | null {
  const parsed = parseBackup(JSON.stringify(raw), today);
  return parsed.ok ? parsed.data : null;
}

/**
 * `extra` joined into `base` (the account's plan): camps `base` does not have
 * are added, progress, dates and notes are combined, and `base` wins wherever
 * both have a value. Nothing of either is dropped.
 */
export function mergePlannerData(base: PlannerData, extra: PlannerData): PlannerData {
  const campIds = new Set(base.camps.map(c => c.id));
  const completedMap = { ...extra.completedMap, ...base.completedMap };
  return {
    camps: [...base.camps, ...extra.camps.filter(c => !campIds.has(c.id))],
    activeCampId: base.activeCampId ?? extra.activeCampId,
    completedMap,
    completionDates: datesOfCompleted(
      {
        since: base.completionDates.since < extra.completionDates.since ? base.completionDates.since : extra.completionDates.since,
        dates: { ...extra.completionDates.dates, ...base.completionDates.dates },
      },
      completedMap
    ),
    focusSessions: [...base.focusSessions, ...extra.focusSessions],
    playlistSync: {
      ...base.playlistSync,
      branches: { ...extra.playlistSync.branches, ...base.playlistSync.branches },
    },
    dayNotes: { ...extra.dayNotes, ...base.dayNotes },
  };
}

export type HydrationPlan =
  /** The cloud copy replaces this browser's. */
  | { kind: 'use-remote' }
  /** This browser's copy is the account's newest: keep it and save its changes. */
  | { kind: 'keep-local' }
  /** This browser's copy (from before accounts, or never saved) joins the cloud copy. */
  | { kind: 'merge-local' }
  /** Unsaved changes here lost to newer cloud data: keep them aside, use the cloud copy. */
  | { kind: 'conflict' }
  /** The account has no cloud copy yet: this browser's copy becomes it. */
  | { kind: 'upload-local' }
  /** No cloud copy and nothing of this account here: start empty. */
  | { kind: 'start-empty' }
  /** Offline, and the copy here is this account's (or from before accounts): use it, save later. */
  | { kind: 'offline-local' }
  /** Offline, and nothing of this account here to show. */
  | { kind: 'offline-blocked' };

/**
 * What to do with this browser's copy when `userId` signs in. A copy from
 * before accounts (no owner) goes to the first account that signs in here;
 * another account's copy is never shown.
 */
export function planHydration(input: {
  userId: string;
  meta: SyncMeta | null;
  /** This browser holds planner data. */
  hasLocal: boolean;
  /** The account's cloud copy, none yet, or the cloud could not be reached. */
  remote: { revision: number } | null | 'offline';
}): HydrationPlan {
  const { userId, meta, hasLocal, remote } = input;
  const anonymous = meta === null && hasLocal;
  const mine = meta?.owner === userId;

  if (remote === 'offline') return mine || anonymous ? { kind: 'offline-local' } : { kind: 'offline-blocked' };

  if (remote === null) {
    if ((mine || anonymous) && hasLocal) return { kind: 'upload-local' };
    return { kind: 'start-empty' };
  }

  if (mine && meta) {
    if (!meta.dirty) return { kind: 'use-remote' };
    if (meta.revision === 0) return { kind: 'merge-local' };
    return meta.revision === remote.revision ? { kind: 'keep-local' } : { kind: 'conflict' };
  }
  return anonymous ? { kind: 'merge-local' } : { kind: 'use-remote' };
}
