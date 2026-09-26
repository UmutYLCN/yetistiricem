// Runs a fetch-style handler on a Node `http` request (Vite dev/preview
// middleware and the production server share this).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PLAYLIST_API_PATH, VIDEOS_API_PATH } from '../src/utils/youtubePlaylist.ts';
import type { WebHandler } from './playlistEndpoint.ts';

export interface YouTubeHandlers {
  playlistHandler: WebHandler;
  videosHandler: WebHandler;
}

/** The YouTube endpoint a request path is for, if any. */
export function youtubeHandlerFor(url: string | undefined, handlers: YouTubeHandlers): WebHandler | null {
  const path = (url ?? '').split('?')[0];
  if (path === PLAYLIST_API_PATH) return handlers.playlistHandler;
  if (path === VIDEOS_API_PATH) return handlers.videosHandler;
  return null;
}

export async function runWebHandler(handler: WebHandler, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let response: Response;
  try {
    // Only the path and query are used; the Host header is not trusted.
    response = await handler(new Request(new URL(req.url ?? '/', 'http://localhost'), { method: req.method }));
  } catch {
    // `new Request` rejects methods such as CONNECT or TRACE.
    response = new Response(JSON.stringify({ error: { code: 'method' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET' },
    });
  }
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
}
