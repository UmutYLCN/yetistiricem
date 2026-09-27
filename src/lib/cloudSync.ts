import type { SyncMeta } from './cloudState.ts';
import {
  CONFLICT_KEY,
  SYNC_KEY,
  UNCLAIMED_KEY,
  UNCLAIMED_NOTICE_KEY,
  fromCloudDocument,
  planHydration,
  readSyncMetaValue,
  toCloudDocument,
  unsyncedKey,
} from './cloudState.ts';
import type { Notice, PlannerData } from './persistence.ts';
import { CAMP_KEYS, DATA_KEYS, addStartupNotices, clearPlannerData, emptyData, hasPlannerData, loadPlanner, writeKey, writePlannerData } from './persistence.ts';
import { STORAGE_KEYS } from '../utils/storage.ts';

// The browser side of the account's cloud plan (see `src/lib/cloudState.ts`).

export function readSyncMeta(): SyncMeta | null {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    return raw ? readSyncMetaValue(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeSyncMeta(meta: SyncMeta | null): boolean {
  try {
    if (meta) localStorage.setItem(SYNC_KEY, JSON.stringify(meta));
    else localStorage.removeItem(SYNC_KEY);
    return true;
  } catch {
    return false;
  }
}

type Remote = { data: PlannerData | null; revision: number } | null | 'offline' | 'owner-changed';

/** The signed-in account's cloud plan (`data` null when the stored document is unusable). */
async function fetchPlannerState(today: string, userId: string): Promise<Remote> {
  try {
    const { getSupabaseForAccount } = await import('./catalogApi.ts');
    const scoped = await getSupabaseForAccount(userId);
    if (scoped.status !== 'ready') return scoped.status;
    const { data, error } = await scoped.client.from('planner_states').select('data, revision').maybeSingle();
    if (error) return 'offline';
    if (!data) return null;
    return { data: fromCloudDocument(data.data, today), revision: Number(data.revision) };
  } catch {
    return 'offline';
  }
}

export type SaveResult = { ok: true; revision: number } | { ok: false; reason: 'conflict' | 'offline' | 'error' | 'owner-changed' };

/** Saves the plan on top of `baseRevision` (0: the account's first save). */
export async function savePlannerState(data: PlannerData, baseRevision: number, userId: string): Promise<SaveResult> {
  try {
    const { getSupabaseForAccount } = await import('./catalogApi.ts');
    const scoped = await getSupabaseForAccount(userId);
    if (scoped.status !== 'ready') return { ok: false, reason: scoped.status };
    const { data: revision, error } = await scoped.client.rpc('save_planner_state', { p_data: toCloudDocument(data), p_base_revision: baseRevision });
    if (error) {
      if (error.message.includes('revision_conflict')) return { ok: false, reason: 'conflict' };
      return { ok: false, reason: /fetch|network/i.test(error.message) ? 'offline' : 'error' };
    }
    return { ok: true, revision: Number(revision) };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

function freeBackupKey(base: string): string | null {
  try {
    if (localStorage.getItem(base) === null) return base;
    let index = 0;
    let key: string;
    do {
      key = `${base}__${Date.now()}_${index++}`;
    } while (localStorage.getItem(key) !== null);
    return key;
  } catch {
    return null;
  }
}

function keepAside(key: string, value: unknown): string | null {
  const target = freeBackupKey(key);
  return target && writeKey(target, value) ? target : null;
}

/** The fixed key holds the newest unsaved copy; older ones remain archived. */
function keepLatestUnsynced(meta: SyncMeta, local: PlannerData): boolean {
  const key = unsyncedKey(meta.owner);
  try {
    const previous = localStorage.getItem(key);
    if (previous !== null) {
      const archive = freeBackupKey(`${key}__onceki`);
      if (!archive) return false;
      localStorage.setItem(archive, previous);
    }
  } catch {
    return false;
  }
  return writeKey(key, { revision: meta.revision, data: toCloudDocument(local) });
}

function snapshotPlannerStorage(): Record<string, string> | null {
  try {
    const raw: Record<string, string> = {};
    for (const key of DATA_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) raw[key] = value;
    }
    return raw;
  } catch {
    return null;
  }
}

function hasUnclaimedContent(local: PlannerData, seedPreferences: unknown, notices: readonly Notice[]): boolean {
  if (hasPlannerData(local) || seedPreferences !== null || notices.length > 0 || Object.keys(local.playlistSync.branches).length > 0) return true;
  try {
    return [STORAGE_KEYS.playlists, STORAGE_KEYS.preferences, STORAGE_KEYS.shiftEvents, STORAGE_KEYS.shiftedDate].some(key =>
      localStorage.getItem(key) !== null
    );
  } catch {
    return true;
  }
}

function keepUnclaimed(local: PlannerData, owner?: string): boolean {
  const raw = snapshotPlannerStorage();
  if (!raw) return false;
  const key = keepAside(UNCLAIMED_KEY, { savedAt: new Date().toISOString(), owner, data: toCloudDocument(local), raw });
  if (!key) return false;
  writeKey(UNCLAIMED_NOTICE_KEY, key);
  return true;
}

/** Moves another account's unsaved changes out of the working copy. */
function setAsideOthersChanges(meta: SyncMeta | null, local: PlannerData): boolean {
  return !meta || !meta.dirty || keepLatestUnsynced(meta, local);
}

function unclaimedNotice(): Notice | null {
  try {
    const raw = localStorage.getItem(UNCLAIMED_NOTICE_KEY);
    if (!raw) return null;
    const key = JSON.parse(raw);
    if (typeof key !== 'string' || !key.startsWith(UNCLAIMED_KEY)) return null;
    localStorage.removeItem(UNCLAIMED_NOTICE_KEY);
    return {
      id: 'sync-unclaimed',
      tone: 'warn',
      title: 'Bu cihazdaki eski veya eksik plan ayrı saklandı',
      body: `Doğrulanamayan yerel kayıt hesabına eklenmedi. Kopyası “${key}” anahtarında duruyor.`,
    };
  } catch {
    return null;
  }
}

/** Unsaved changes this account left here when it signed out offline, if any. */
function takeOwnUnsynced(userId: string, today: string): { revision: number; data: PlannerData } | null {
  try {
    const raw = localStorage.getItem(unsyncedKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { revision?: unknown; data?: unknown };
    const data = fromCloudDocument(parsed.data, today);
    const revision = typeof parsed.revision === 'number' && Number.isInteger(parsed.revision) && parsed.revision >= 0 ? parsed.revision : 0;
    return data ? { revision, data } : null;
  } catch {
    return null;
  }
}

export type HydrationResult = { ok: true } | { ok: false; error: string };

/**
 * Makes this browser's copy the signed-in account's plan before the planner
 * opens (it reads storage once per page load). An ownerless copy is backed up,
 * never silently added to an account; another account's unsaved changes are
 * kept aside for that account's next sign-in here.
 */
export async function hydrateAccount(
  userId: string,
  today: string,
  signal?: AbortSignal,
  fetchRemote: (today: string, userId: string) => Promise<Remote> = fetchPlannerState
): Promise<HydrationResult> {
  if (signal?.aborted) return { ok: false, error: 'Oturum değişti; plan yeniden açılmalı.' };
  let meta = readSyncMeta();
  const loaded = loadPlanner();
  let local = loaded.data;
  const hasUnclaimedLocal = hasUnclaimedContent(local, loaded.seedPreferences, loaded.notices);

  const own = meta?.owner === userId ? null : takeOwnUnsynced(userId, today);
  if (own) {
    if (!setAsideOthersChanges(meta, local) || (!meta && hasUnclaimedLocal && !keepUnclaimed(local)) || !writePlannerData(own.data)) {
      return { ok: false, error: 'Bu cihazdaki kaydedilmemiş plan güvenle açılamadı. Depolama alanını kontrol edip tekrar dene.' };
    }
    local = own.data;
    meta = { owner: userId, revision: own.revision, dirty: true };
    if (!writeSyncMeta(meta)) return { ok: false, error: 'Bu cihazdaki planın hesap bilgisi kaydedilemedi. Tekrar dene.' };
    try {
      localStorage.removeItem(unsyncedKey(userId));
    } catch {
      // The working copy is now durable; a duplicate recovery copy is harmless.
    }
  }

  const remote = await fetchRemote(today, userId);
  if (signal?.aborted) return { ok: false, error: 'Oturum değişti; plan yeniden açılmalı.' };
  if (remote === 'owner-changed') return { ok: false, error: 'Oturum değişti; plan yeniden açılmalı.' };
  if (remote && remote !== 'offline' && remote.data === null) {
    // Never replace (or later overwrite) a cloud plan this version cannot read.
    return { ok: false, error: 'Hesabındaki plan bu sürümde okunamadı; verilerine dokunulmadı. Sayfayı yenileyip tekrar dene.' };
  }
  let hasWorkingCopy = false;
  try {
    hasWorkingCopy = localStorage.getItem(CAMP_KEYS.camps) !== null;
  } catch {
    // The planner cannot trust an inaccessible local copy.
  }
  const plan = planHydration({
    userId,
    meta,
    hasLocal: hasPlannerData(local),
    hasWorkingCopy,
    remote: remote === 'offline' || remote === null ? remote : { revision: remote.revision },
  });
  const notices: Notice[] = [];
  const backupError = 'Bu cihazdaki eski plan yedeklenemedi. Depolama alanını kontrol edip tekrar dene; verilerine dokunulmadı.';

  switch (plan.kind) {
    case 'use-remote':
    case 'conflict': {
      if (remote === 'offline' || remote === null || !remote.data) break;
      if (plan.kind === 'conflict') {
        const key = keepAside(CONFLICT_KEY, { savedAt: new Date().toISOString(), data: toCloudDocument(local), raw: snapshotPlannerStorage() });
        if (!key) return { ok: false, error: backupError };
        notices.push({
          id: 'sync-conflict',
          tone: 'warn',
          title: 'Başka bir cihazdaki değişiklikler yüklendi',
          body: `Bu cihazdaki kaydedilmemiş değişiklikler, başka bir cihazdan kaydedilen daha yeni planla çakıştı. Yeni plan açıldı; bu cihazdakiler “${key}” anahtarında yedekte duruyor.`,
        });
      } else if (meta?.owner === userId && meta.dirty && hasUnclaimedLocal) {
        const key = keepAside(CONFLICT_KEY, { savedAt: new Date().toISOString(), data: toCloudDocument(local), raw: snapshotPlannerStorage() });
        if (!key) return { ok: false, error: backupError };
        notices.push({
          id: 'sync-missing-local-store',
          tone: 'warn',
          title: 'Eksik yerel plan ayrı saklandı',
          body: `Bu cihazdaki kamp kaydı eksikti; diğer yerel veriler “${key}” anahtarına yedeklendi. Hesabındaki plan açıldı.`,
        });
      } else if (meta?.owner !== userId) {
        if (meta && !setAsideOthersChanges(meta, local)) return { ok: false, error: backupError };
        if (!meta && hasUnclaimedLocal && !keepUnclaimed(local)) return { ok: false, error: backupError };
      }
      if (!writePlannerData(remote.data) || !writeSyncMeta({ owner: userId, revision: remote.revision, dirty: false })) {
        return { ok: false, error: 'Hesabındaki plan bu cihazda kaydedilemedi. Tekrar dene.' };
      }
      break;
    }
    case 'keep-local':
      if (remote && remote !== 'offline' && !writeSyncMeta({ owner: userId, revision: remote.revision, dirty: true })) {
        return { ok: false, error: 'Kaydedilmemiş planın hesap bilgisi bu cihazda saklanamadı. Tekrar dene.' };
      }
      break;
    case 'upload-local':
      if (!writeSyncMeta({ owner: userId, revision: 0, dirty: true })) {
        return { ok: false, error: 'Kaydedilmemiş planın hesap bilgisi bu cihazda saklanamadı. Tekrar dene.' };
      }
      break;
    case 'start-empty': {
      if (meta?.owner === userId && hasUnclaimedLocal) {
        const key = keepAside(CONFLICT_KEY, { savedAt: new Date().toISOString(), data: toCloudDocument(local), raw: snapshotPlannerStorage() });
        if (!key) return { ok: false, error: backupError };
        notices.push({
          id: 'sync-missing-remote',
          tone: 'warn',
          title: 'Hesabındaki eski plan ayrı saklandı',
          body: `Bulutta bu plan bulunamadı. Bu cihazdaki kopya “${key}” anahtarında yedeklendi.`,
        });
      } else if (meta && !setAsideOthersChanges(meta, local)) return { ok: false, error: backupError };
      else if (!meta && hasUnclaimedLocal && !keepUnclaimed(local)) return { ok: false, error: backupError };
      if (!writePlannerData(emptyData()) || !writeSyncMeta({ owner: userId, revision: 0, dirty: false })) {
        return { ok: false, error: 'Boş plan bu cihazda kaydedilemedi. Tekrar dene.' };
      }
      break;
    }
    case 'offline-local':
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

  const unclaimed = unclaimedNotice();
  if (unclaimed) notices.push(unclaimed);
  addStartupNotices(notices);
  return { ok: true };
}

/**
 * Signing out: this browser's copy leaves, so the next account never sees it.
 * Changes the cloud does not have yet are kept aside for this account's next
 * sign-in here.
 */
export function leaveAccountLocally(data: PlannerData, forceUnsynced = false): boolean {
  const meta = readSyncMeta();
  if (meta && (meta.dirty || forceUnsynced) && !keepLatestUnsynced(meta, data)) return false;
  if (!meta && hasUnclaimedContent(data, null, []) && !keepUnclaimed(data)) return false;
  if (!writeSyncMeta(null)) return false;
  clearPlannerData();
  return true;
}

/** Also isolates an account's working copy when the session expires without a manual sign-out. */
export function isolateSignedOutPlanner(): boolean {
  const meta = readSyncMeta();
  const loaded = loadPlanner();
  const hasUnclaimedLocal = hasUnclaimedContent(loaded.data, loaded.seedPreferences, loaded.notices);
  let hasWorkingCopy = false;
  try {
    hasWorkingCopy = localStorage.getItem(CAMP_KEYS.camps) !== null;
  } catch {
    return false;
  }
  if (meta?.dirty && hasWorkingCopy && !keepLatestUnsynced(meta, loaded.data)) return false;
  if (meta?.dirty && !hasWorkingCopy && hasUnclaimedLocal && !keepUnclaimed(loaded.data, meta.owner)) return false;
  if (!meta && hasUnclaimedLocal && !keepUnclaimed(loaded.data)) return false;
  if (!writeSyncMeta(null)) return false;
  clearPlannerData();
  return true;
}
