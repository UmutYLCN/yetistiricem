import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaylistFailure } from '../lib/playlistImport';
import { requestPlaylist } from '../lib/playlistImport';
import type { PlaylistLinkProblem } from '../utils/youtubeParser';
import { inspectPlaylistLink } from '../utils/youtubeParser';
import type { PlaylistResponse } from '../utils/youtubePlaylist';

export type PlaylistFetchState =
  | { status: 'idle' }
  | { status: 'invalid'; problem: PlaylistLinkProblem }
  | { status: 'loading'; id: string }
  | { status: 'failed'; id: string; failure: Exclude<PlaylistFailure, 'aborted'> }
  /** `version` changes with every successful load, so the review can start fresh. */
  | { status: 'loaded'; id: string; data: PlaylistResponse; version: number };

/**
 * The playlist link field and its request. A new load cancels the previous
 * one; leaving (unmounting) cancels whatever is still running.
 */
export function usePlaylistFetch() {
  const [link, setLinkValue] = useState('');
  const [state, setState] = useState<PlaylistFetchState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);
  const versionRef = useRef(0);
  // What a cancelled load goes back to: the last list that was shown, if any.
  const lastLoadedRef = useRef<PlaylistFetchState>({ status: 'idle' });

  useEffect(() => () => controllerRef.current?.abort(), []);

  const load = useCallback(async (input: string) => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    const check = inspectPlaylistLink(input);
    if (!check.ok) {
      setState({ status: 'invalid', problem: check.problem });
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: 'loading', id: check.id });
    const result = await requestPlaylist(check.id, { signal: controller.signal });
    if (controllerRef.current !== controller) return; // cancelled or replaced
    controllerRef.current = null;
    if (result.ok) {
      versionRef.current += 1;
      const loaded: PlaylistFetchState = { status: 'loaded', id: check.id, data: result.data, version: versionRef.current };
      lastLoadedRef.current = loaded;
      setState(loaded);
    } else if (result.failure !== 'aborted') {
      setState({ status: 'failed', id: check.id, failure: result.failure });
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState(lastLoadedRef.current);
  }, []);

  const setLink = useCallback((value: string) => {
    setLinkValue(value);
    // A link problem belongs to the text that caused it.
    setState(current => (current.status === 'invalid' ? { status: 'idle' } : current));
  }, []);

  /** Back to an empty field, e.g. after the list was imported. */
  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    lastLoadedRef.current = { status: 'idle' };
    setLinkValue('');
    setState({ status: 'idle' });
  }, []);

  return { link, setLink, state, load, cancel, reset };
}

export type PlaylistFetch = ReturnType<typeof usePlaylistFetch>;
