import type { SyncMeta } from './cloudState';
import {
  CONFLICT_KEY,
  SYNC_KEY,
  fromCloudDocument,
  mergePlannerData,
  planHydration,
  readSyncMetaValue,
  toCloudDocument,
  unsyncedKey,
} from './cloudState';
import { getSupabase } from './catalogApi';
import type { Notice, PlannerData } from './persistence';
import { addStartupNotices, clearPlannerData, hasPlannerData, loadPlanner, writeKey, writePlannerData } from './persistence';

// The browser side of the account's cloud plan (see `src/lib/cloudState.ts`).

export function readSyncMeta(): SyncMeta | null {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    return raw ? readSyncMetaValue(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeSyncMeta(meta: SyncMeta | null) {
  try {
    if (meta) localStorage.setItem(SYNC_KEY, JSON.stringify(meta));
    else localStorage.removeItem(SYNC_KEY);
  } catch {
    // Storage blocked: the next load checks the cloud again.
  }
}

type Remote = { data: PlannerData | null; revision: number } | null | 'offline';

/** The signed-in account's cloud plan (`data` null when the stored document is unusable). */
async function fetchPlannerState(today: string): Promise<Remote> {
  const client = await getSupabase();
  if (!client) return 'offline';
  try {
    const { data, error } = await client.from('planner_states').select('data, revision').maybeSingle();
    if (error) return 'offline';
    if (!data) return null;
    return { data: fromCloudDocument(data.data, today), revision: Number(data.revision) };
  } catch {
    return 'offline';
  }
}

export type SaveResult = { ok: true; revision: number } | { ok: false; reason: 'conflict' | 'offline' | 'error' };

/** Saves the plan on top of `baseRevision` (0: the account's first save). */
export async function savePlannerState(data: PlannerData, baseRevision: number): Promise<SaveResult> {
  const client = await getSupabase();
  if (!client) return { ok: false, reason: 'offline' };
  try {
    const { data: revision, error } = await client.rpc('save_planner_state', { p_data: toCloudDocument(data), p_base_revision: baseRevision });
    if (error) {
      if (error.message.includes('revision_conflict')) return { ok: false, reason: 'conflict' };
      return { ok: false, reason: /fetch|network/i.test(error.message) ? 'offline' : 'error' };
    }
    return { ok: true, revision: Number(revision) };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

function keepAside(key: string, value: unknown) {
  writeKey(key, value);
}

/** Moves unsaved changes of another account out of the working copy before it is replaced. */
function setAsideOthersChanges(meta: SyncMeta | null, local: PlannerData) {
  if (meta && meta.dirty) keepAside(unsyncedKey(meta.owner), { revision: meta.revision, data: toCloudDocument(local) });
}

/** Unsaved changes this account left here when it signed out offline, if any. */
function takeOwnUnsynced(userId: string, today: string): { revision: number; data: PlannerData } | null {
  try {
    const raw = localStorage.getItem(unsyncedKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { revision?: unknown; data?: unknown };
    const data = fromCloudDocument(parsed.data, today);
    localStorage.removeItem(unsyncedKey(userId));
    return data ? { revision: typeof parsed.revision === 'number' ? parsed.revision : 0, data } : null;
  } catch {
    return null;
  }
}

export type HydrationResult = { ok: true } | { ok: false; error: string };

/**
 * Makes this browser's copy the signed-in account's plan before the planner
 * opens (it reads storage once per page load). A copy from before accounts
 * joins the first account that signs in; another account's copy is replaced
 * (its unsaved changes kept aside for its next sign-in here).
 */
export async function hydrateAccount(userId: string, today: string): Promise<HydrationResult> {
  let meta = readSyncMeta();
  let local = loadPlanner().data;

  const own = meta?.owner === userId ? null : takeOwnUnsynced(userId, today);
  if (own) {
    setAsideOthersChanges(meta, local);
    writePlannerData(own.data);
    local = own.data;
    meta = { owner: userId, revision: own.revision, dirty: true };
    writeSyncMeta(meta);
  }

  const remote = await fetchPlannerState(today);
  if (remote && remote !== 'offline' && remote.data === null) {
    // Never replace (or later overwrite) a cloud plan this version cannot read.
    return { ok: false, error: 'Hesabındaki plan bu sürümde okunamadı; verilerine dokunulmadı. Sayfayı yenileyip tekrar dene.' };
  }
  const plan = planHydration({
    userId,
    meta,
    hasLocal: hasPlannerData(local),
    remote: remote === 'offline' || remote === null ? remote : { revision: remote.revision },
  });
  const notices: Notice[] = [];

  switch (plan.kind) {
    case 'use-remote':
    case 'conflict': {
      if (remote === 'offline' || remote === null) break;
      if (plan.kind === 'conflict') {
        keepAside(CONFLICT_KEY, { savedAt: new Date().toISOString(), data: toCloudDocument(local) });
        notices.push({
          id: 'sync-conflict',
          tone: 'warn',
          title: 'Başka bir cihazdaki değişiklikler yüklendi',
          body: `Bu cihazdaki kaydedilmemiş değişiklikler, başka bir cihazdan kaydedilen daha yeni planla çakıştı. Yeni plan açıldı; bu cihazdakiler “${CONFLICT_KEY}” anahtarında yedekte duruyor.`,
        });
      } else if (meta?.owner !== userId) {
        setAsideOthersChanges(meta, local);
      }
      if (remote.data) writePlannerData(remote.data);
      else clearPlannerData();
      writeSyncMeta({ owner: userId, revision: remote.revision, dirty: false });
      break;
    }
    case 'keep-local':
      if (remote && remote !== 'offline') writeSyncMeta({ owner: userId, revision: remote.revision, dirty: true });
      break;
    case 'merge-local': {
      if (remote === 'offline' || remote === null) break;
      const merged = remote.data ? mergePlannerData(remote.data, local) : local;
      writePlannerData(merged);
      writeSyncMeta({ owner: userId, revision: remote.revision, dirty: true });
      notices.push({
        id: 'sync-merged',
        tone: 'info',
        title: 'Bu tarayıcıdaki planın hesabına eklendi',
        body: 'Hesabındaki kampların yanına bu tarayıcıda kayıtlı kampların ve ilerlemen eklendi; hiçbiri silinmedi.',
      });
      break;
    }
    case 'upload-local':
      if (meta?.owner !== userId) {
        notices.push({
          id: 'sync-moved',
          tone: 'info',
          title: 'Bu tarayıcıdaki planın hesabına taşındı',
          body: 'Giriş yapmadan önce kaydettiğin kampların ve ilerlemen artık hesabında; başka cihazlardan da açabilirsin.',
        });
      }
      writeSyncMeta({ owner: userId, revision: meta?.owner === userId ? meta.revision : 0, dirty: true });
      break;
    case 'start-empty':
      setAsideOthersChanges(meta, local);
      clearPlannerData();
      writeSyncMeta({ owner: userId, revision: 0, dirty: false });
      break;
    case 'offline-local':
      // A copy from before accounts becomes this account's; it is saved once the cloud is reachable.
      if (meta?.owner !== userId) writeSyncMeta({ owner: userId, revision: 0, dirty: true });
      notices.push({
        id: 'sync-offline',
        tone: 'info',
        title: 'Çevrimdışı çalışıyorsun',
        body: 'Hesabına şu an ulaşılamadı; bu cihazdaki planın açıldı. Değişikliklerin bağlantı gelince hesabına kaydedilir.',
      });
      break;
    case 'offline-blocked':
      return { ok: false, error: 'Planına ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.' };
  }

  addStartupNotices(notices);
  return { ok: true };
}

/**
 * Signing out: this browser's copy leaves, so the next account never sees it.
 * Changes the cloud does not have yet are kept aside for this account's next
 * sign-in here.
 */
export function leaveAccountLocally(data: PlannerData) {
  const meta = readSyncMeta();
  if (meta?.dirty) keepAside(unsyncedKey(meta.owner), { revision: meta.revision, data: toCloudDocument(data) });
  clearPlannerData();
  writeSyncMeta(null);
}
