// `GET /api/youtube/videos?ids=<id>,<id>,…` (1 to 50 video ids) as a standard
// fetch handler, beside the playlist endpoint and with the same rules: it only
// accepts validated video ids, never a URL, so it cannot be used as a general
// proxy, and it answers with the videos or an error code only (never the key,
// upstream URLs or upstream error text).
import type { VideosResponse } from '../src/utils/youtubePlaylist.ts';
import { MAX_VIDEOS_PER_REQUEST } from '../src/utils/youtubePlaylist.ts';
import { isYoutubeVideoId } from '../src/utils/youtubeParser.ts';
import type { PlaylistHandlerOptions, WebHandler } from './playlistEndpoint.ts';
import { cachedLoader, errorResponse, json } from './playlistEndpoint.ts';
import { YouTubeApiError, fetchVideos } from './youtubeApi.ts';

export type VideosHandlerOptions = Omit<PlaylistHandlerOptions, 'maxPages'>;

export function createVideosHandler(options: VideosHandlerOptions): WebHandler {
  const apiKey = options.apiKey?.trim() ?? '';
  const log = options.log ?? (message => console.warn(message));
  // Keyed by the ids in request order, which is also the order of the answer.
  const load = cachedLoader(key => fetchVideos(key.split(','), { apiKey, fetch: options.fetch }), options);

  return async request => {
    if (request.method !== 'GET') return errorResponse('method', { Allow: 'GET' });
    const params = new URL(request.url).searchParams.getAll('ids');
    const ids = params.length === 1 ? [...new Set(params[0].split(','))] : [];
    if (ids.length === 0 || ids.length > MAX_VIDEOS_PER_REQUEST || !ids.every(isYoutubeVideoId)) return errorResponse('invalid-id');
    if (!apiKey) return errorResponse('not-configured');

    try {
      const body: VideosResponse = { entries: await load(ids.join(',')) };
      return json(200, body, { 'Cache-Control': 'no-store' });
    } catch (error) {
      const code = error instanceof YouTubeApiError ? error.code : 'upstream';
      log(`[youtube-videos] request failed (${code})`);
      return errorResponse(code);
    }
  };
}
