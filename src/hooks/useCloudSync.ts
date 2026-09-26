import { useCallback, useEffect, useRef, useState } from 'react';
import { readSyncMeta, savePlannerState, writeSyncMeta } from '../lib/cloudSync';
import type { PlannerData } from '../lib/persistence';

export type SyncStatus = 'saved' | 'saving' | 'pending' | 'offline' | 'error';

const SAVE_DELAY_MS = 1500;
const RETRY_MS = 20_000;

/**
 * Saves the signed-in account's plan to the cloud a moment after each change
 * (and at once when the page is hidden). A save builds on the revision the
 * copy started from; when another device saved first, the page reloads, and
 * the sign-in step opens the newer plan and keeps this copy's changes aside.
 * `userId` null (demo without an account, or no sign-in set up): nothing is saved.
 */
export function useCloudSync(data: PlannerData, userId: string | null) {
  // The plan the cloud is known to have; `data` differing from it means unsaved changes.
  const [savedData, setSavedData] = useState<PlannerData | null>(() => (readSyncMeta()?.dirty ? null : data));
  const [phase, setPhase] = useState<'idle' | 'saving' | 'offline' | 'error'>('idle');
  const dataRef = useRef(data);
  const firstRef = useRef(true);
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef<Promise<boolean> | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    if (!userId) return true;
    if (savingRef.current) await savingRef.current;
    const meta = readSyncMeta();
    if (!meta || meta.owner !== userId || !meta.dirty) return true;
    const snapshot = dataRef.current;
    const run = (async () => {
      setPhase('saving');
      const result = await savePlannerState(snapshot, meta.revision);
      if (result.ok) {
        const clean = dataRef.current === snapshot;
        writeSyncMeta({ owner: userId, revision: result.revision, dirty: !clean });
        setSavedData(snapshot);
        setPhase('idle');
        return clean;
      }
      if (result.reason === 'conflict') {
        window.location.reload();
        return false;
      }
      setPhase(result.reason === 'offline' ? 'offline' : 'error');
      return false;
    })();
    savingRef.current = run;
    try {
      return await run;
    } finally {
      savingRef.current = null;
    }
  }, [userId]);

  const schedule = useCallback(
    (delay: number) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void save();
      }, delay);
    },
    [save]
  );

  // Every change marks the copy unsaved at once (a closed tab keeps that), then saves shortly after.
  useEffect(() => {
    dataRef.current = data;
    if (!userId) return;
    if (firstRef.current) {
      firstRef.current = false;
      if (readSyncMeta()?.dirty) schedule(0);
      return;
    }
    const meta = readSyncMeta();
    if (meta?.owner === userId && !meta.dirty) writeSyncMeta({ ...meta, dirty: true });
    schedule(SAVE_DELAY_MS);
  }, [data, userId, schedule]);

  // Retry while unsaved: when the connection returns, on a timer, and when the page is hidden.
  useEffect(() => {
    if (!userId) return;
    const retry = () => {
      if (readSyncMeta()?.dirty) void save();
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') retry();
    };
    const timer = window.setInterval(retry, RETRY_MS);
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onHide);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [userId, save]);

  /** Saves now; true when the cloud has everything. */
  const flush = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return save();
  }, [save]);

  const status: SyncStatus = phase !== 'idle' ? phase : data === savedData ? 'saved' : 'pending';
  return { status, flush };
}
