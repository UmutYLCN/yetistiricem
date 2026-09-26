import { useEffect, useRef, useState } from 'react';
import type { StudyCamp } from '../types';
import type { PlaylistFailure } from '../lib/playlistImport';
import { requestPlaylist } from '../lib/playlistImport';
import type { PlaylistSync } from '../lib/playlistSync';
import { isCheckDue, syncTargets } from '../lib/playlistSync';
import type { PlannerActions } from './usePlanner';

const START_DELAY_MS = 1500;

/** Failures after which the other playlists would fail the same way today. */
const STOPS_THE_DAY: ReadonlySet<PlaylistFailure> = new Set(['quota', 'not-configured', 'bad-key', 'no-service', 'network']);

/**
 * The daily playlist check: on the first open of a day (never in the demo)
 * each branch's playlist is read once through the server endpoint, one after
 * the other, and what it found is stored. A playlist that cannot be read
 * today is simply tried again tomorrow.
 */
export function usePlaylistSync(
  camps: readonly StudyCamp[],
  sync: PlaylistSync,
  today: string,
  enabled: boolean,
  actions: Pick<PlannerActions, 'recordPlaylistCheck' | 'finishPlaylistCheck'>
) {
  const [checking, setChecking] = useState(false);
  const campsRef = useRef(camps);
  const actionsRef = useRef(actions);
  useEffect(() => {
    campsRef.current = camps;
    actionsRef.current = actions;
  });

  const targetCount = syncTargets(camps).length;
  const due = enabled && targetCount > 0 && isCheckDue(sync, today);

  useEffect(() => {
    if (!due) return;
    const controller = new AbortController();
    const run = async () => {
      setChecking(true);
      let failure: Exclude<PlaylistFailure, 'aborted'> | null = null;
      for (const { campId, branch, playlistId } of syncTargets(campsRef.current)) {
        const result = await requestPlaylist(playlistId, { signal: controller.signal, timeoutMs: 30_000 });
        if (controller.signal.aborted) return;
        if (result.ok) {
          actionsRef.current.recordPlaylistCheck(campId, branch.id, result.data.entries);
        } else if (result.failure !== 'aborted') {
          failure = result.failure;
          if (STOPS_THE_DAY.has(result.failure)) break;
        }
      }
      if (controller.signal.aborted) return;
      actionsRef.current.finishPlaylistCheck(failure);
      setChecking(false);
    };
    // A moment after the page settles; leaving before then sends nothing.
    const timer = window.setTimeout(() => void run(), START_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      setChecking(false);
    };
  }, [due]);

  return { checking };
}
