// Runs a fetch-style handler on a Node `http` request (Vite dev/preview
// middleware and the production server share this).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PLAYLIST_API_PATH, VIDEOS_API_PATH } from '../src/utils/youtubePlaylist.ts';
import type { WebHandler } from './playlistEndpoint.ts';

/** Where the MCP server answers (docs/mcp.md). */
export const MCP_PATH = '/mcp';
const RESOURCE_METADATA_PATHS = ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'];

export interface YouTubeHandlers {
  playlistHandler: WebHandler;
  videosHandler: WebHandler;
  /** `POST /mcp` (docs/mcp.md). */
  mcpHandler?: WebHandler;
  /** `GET /.well-known/oauth-protected-resource[/mcp]`: where MCP clients sign in. */
  resourceMetadataHandler?: WebHandler;
}

/** The server endpoint (YouTube or MCP) a request path is for, if any. */
export function youtubeHandlerFor(url: string | undefined, handlers: YouTubeHandlers): WebHandler | null {
  const path = (url ?? '').split('?')[0];
  if (path === PLAYLIST_API_PATH) return handlers.playlistHandler;
  if (path === VIDEOS_API_PATH) return handlers.videosHandler;
  if (path === MCP_PATH && handlers.mcpHandler) return handlers.mcpHandler;
  if (RESOURCE_METADATA_PATHS.includes(path) && handlers.resourceMetadataHandler) return handlers.resourceMetadataHandler;
  return null;
}

const MAX_BODY_BYTES = 1_500_000;

/** A request body, cut off past the MCP limit (the handler then refuses it). */
async function readBody(req: IncomingMessage): Promise<ArrayBuffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES + 1) break;
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks);
  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
}

export async function runWebHandler(handler: WebHandler, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let response: Response;
  try {
    // Only the path and query are used; the Host header is not trusted. A body
    // (MCP's POST) comes along with the headers that describe it.
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
    const headers = new Headers();
    for (const name of ['content-type', 'accept', 'authorization', 'mcp-protocol-version', 'mcp-session-id']) {
      const value = req.headers[name];
      if (typeof value === 'string') headers.set(name, value);
    }
    response = await handler(
      new Request(new URL(req.url ?? '/', 'http://localhost'), { method: req.method, headers, ...(hasBody ? { body: await readBody(req) } : {}) })
    );
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
