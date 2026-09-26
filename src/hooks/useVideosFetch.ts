import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaylistFailure } from '../lib/playlistImport';
import { requestVideos } from '../lib/playlistImport';
import type { PlaylistEntry } from '../utils/youtubePlaylist';

export type VideosFetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'failed'; ids: string[]; failure: Exclude<PlaylistFailure, 'aborted'> }
  /** `version` changes with every successful load, so the review can start fresh. */
  | { status: 'loaded'; entries: PlaylistEntry[]; version: number };

/**
 * Reads videos by id from the server. A new load cancels the previous one;
 * leaving (unmounting) cancels whatever is still running.
 */
export function useVideosFetch() {
  const [state, setState] = useState<VideosFetchState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);
  const versionRef = useRef(0);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const load = useCallback(async (ids: string[]) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: 'loading' });
    const result = await requestVideos(ids, { signal: controller.signal });
    if (controllerRef.current !== controller) return; // cancelled or replaced
    controllerRef.current = null;
    if (result.ok) {
      versionRef.current += 1;
      setState({ status: 'loaded', entries: result.entries, version: versionRef.current });
    } else if (result.failure !== 'aborted') {
      setState({ status: 'failed', ids, failure: result.failure });
    }
  }, []);

  /** Back to nothing loaded (after an import, or to stop a load). */
  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState({ status: 'idle' });
  }, []);

  return { state, load, reset };
}
