// Production server: the built app from `dist/` plus the YouTube endpoints.
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import type { YouTubeHandlers } from './node.ts';
import { runWebHandler, youtubeHandlerFor } from './node.ts';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export interface AppServerOptions extends YouTubeHandlers {
  /** The `vite build` output. */
  distDir: string;
}

function send(res: ServerResponse, status: number, headers: Record<string, string> = {}, body?: Buffer | string) {
  res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}

async function fileInfo(path: string) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function serveStatic(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { Allow: 'GET, HEAD' });
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    return send(res, 400);
  }
  if (pathname.includes('\0')) return send(res, 400);

  let file = resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + sep)) return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
  let info = await fileInfo(file);
  if (info?.isDirectory()) {
    file = join(file, 'index.html');
    info = await fileInfo(file);
  }
  if (!info?.isFile()) {
    // Asset-looking paths 404; anything else gets the app shell.
    if (extname(pathname)) return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
    file = join(root, 'index.html');
  }

  const body = await readFile(file);
  send(
    res,
    200,
    {
      'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': String(body.length),
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    },
    req.method === 'HEAD' ? undefined : body
  );
}

export function createAppServer({ distDir, ...handlers }: AppServerOptions): Server {
  const root = resolve(distDir);
  return createServer((req, res) => {
    const api = youtubeHandlerFor(req.url, handlers);
    const work = api ? runWebHandler(api, req, res) : serveStatic(root, req, res);
    work.catch(error => {
      console.error('[server] request failed:', error instanceof Error ? error.message : error);
      if (!res.headersSent) send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Internal error');
      else res.end();
    });
  });
}
