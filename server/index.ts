// `npm start`: serves `dist/`, `GET /api/youtube/playlist`, `GET /api/youtube/videos` and `POST /mcp` on one port.
//   YOUTUBE_API_KEY  YouTube Data API v3 key (required for playlist and video import)
//   APP_ORIGIN       public address for MCP import links, e.g. https://example.com (default: this server)
//   PORT             default 3000
//   HOST             default 127.0.0.1; use 0.0.0.0 in containers and on hosts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from './app.ts';
import { createMcpHandler, createResourceMetadataHandler } from './mcpEndpoint.ts';
import { createPlaylistHandler } from './playlistEndpoint.ts';
import { createVideosHandler } from './videosEndpoint.ts';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
if (!existsSync(join(distDir, 'index.html'))) {
  console.error('dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}
const host = process.env.HOST?.trim() || '127.0.0.1';
const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey?.trim()) {
  console.warn('YOUTUBE_API_KEY is not set: playlist and video import will answer "not-configured".');
}

const appOrigin = process.env.APP_ORIGIN?.trim() || `http://${host.includes(':') ? `[${host}]` : host}:${port}`;
const supabase = { url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY };
const server = createAppServer({
  distDir,
  playlistHandler: createPlaylistHandler({ apiKey }),
  videosHandler: createVideosHandler({ apiKey }),
  mcpHandler: createMcpHandler({ apiKey, supabase, appOrigin }),
  resourceMetadataHandler: createResourceMetadataHandler({ supabase, appOrigin }),
});
server.listen(port, host, () => {
  console.log(`Yetişir is running at http://${host.includes(':') ? `[${host}]` : host}:${port}`);
});
