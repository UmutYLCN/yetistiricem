// Runs a fetch-style handler on a Node `http` request (Vite dev/preview
// middleware and the production server share this).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PLAYLIST_API_PATH } from '../src/utils/youtubePlaylist.ts';
import type { WebHandler } from './playlistEndpoint.ts';

export function isPlaylistApiRequest(url: string | undefined): boolean {
  return (url ?? '').split('?')[0] === PLAYLIST_API_PATH;
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
