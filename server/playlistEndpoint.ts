// `GET /api/youtube/playlist?id=<playlist id>` as a standard fetch handler
// (`Request` in, `Response` out), so the same code runs in the Vite dev and
// preview servers and in `server/index.ts`.
//
// The endpoint only accepts a validated playlist id, never a URL, so it cannot
// be used as a general proxy. Responses carry only the playlist data or an
// error code: never the key, upstream URLs or upstream error text.
import type { PlaylistErrorBody, PlaylistErrorCode, PlaylistResponse } from '../src/utils/youtubePlaylist.ts';
import { PLAYLIST_ERROR_STATUS } from '../src/utils/youtubePlaylist.ts';
import { isFetchablePlaylistId } from '../src/utils/youtubeParser.ts';
import type { FetchLike } from './youtubeApi.ts';
import { YouTubeApiError, fetchPlaylist } from './youtubeApi.ts';

export interface PlaylistHandlerOptions {
  /** The YouTube Data API key. Missing or blank: every request answers `not-configured`. */
  apiKey: string | undefined;
  fetch?: FetchLike;
  /** How long a fetched playlist is reused, to spare quota. Default 5 minutes. */
  cacheTtlMs?: number;
  cacheSize?: number;
  maxPages?: number;
  now?: () => number;
  /** Where failures are reported. Messages contain only the endpoint error code. */
  log?: (message: string) => void;
}

export type WebHandler = (request: Request) => Promise<Response>;

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...headers } });
}

function errorResponse(code: PlaylistErrorCode, headers: Record<string, string> = {}): Response {
  const body: PlaylistErrorBody = { error: { code } };
  return json(PLAYLIST_ERROR_STATUS[code], body, { 'Cache-Control': 'no-store', ...headers });
}

export function createPlaylistHandler(options: PlaylistHandlerOptions): WebHandler {
  const apiKey = options.apiKey?.trim() ?? '';
  const ttl = options.cacheTtlMs ?? 5 * 60_000;
  const cacheSize = options.cacheSize ?? 50;
  const now = options.now ?? Date.now;
  const log = options.log ?? (message => console.warn(message));
  const cache = new Map<string, { expires: number; data: PlaylistResponse }>();
  // Double clicks and repeated pastes share one upstream read.
  const inFlight = new Map<string, Promise<PlaylistResponse>>();

  const load = (id: string): Promise<PlaylistResponse> => {
    const cached = cache.get(id);
    if (cached && cached.expires > now()) return Promise.resolve(cached.data);
    cache.delete(id);
    const pending = inFlight.get(id);
    if (pending) return pending;
    const request = fetchPlaylist(id, { apiKey, fetch: options.fetch, maxPages: options.maxPages })
      .then(data => {
        if (ttl > 0) {
          cache.set(id, { expires: now() + ttl, data });
          while (cache.size > cacheSize) cache.delete(cache.keys().next().value as string);
        }
        return data;
      })
      .finally(() => inFlight.delete(id));
    inFlight.set(id, request);
    return request;
  };

  return async request => {
    if (request.method !== 'GET') return errorResponse('method', { Allow: 'GET' });
    const params = new URL(request.url).searchParams;
    const id = params.get('id') ?? '';
    if (params.getAll('id').length !== 1 || !isFetchablePlaylistId(id)) return errorResponse('invalid-id');
    if (!apiKey) return errorResponse('not-configured');

    try {
      const data = await load(id);
      // Browsers do not cache: the server-side cache above is the only reuse, and it is short.
      return json(200, data, { 'Cache-Control': 'no-store' });
    } catch (error) {
      const code = error instanceof YouTubeApiError ? error.code : 'upstream';
      log(`[youtube-playlist] request failed (${code})`);
      return errorResponse(code);
    }
  };
}
