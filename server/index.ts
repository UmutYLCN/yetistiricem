// `npm start`: serves `dist/`, `GET /api/youtube/playlist` and `GET /api/youtube/videos` on one port.
//   YOUTUBE_API_KEY  YouTube Data API v3 key (required for playlist and video import)
//   PORT             default 3000
//   HOST             default 127.0.0.1; use 0.0.0.0 in containers and on hosts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from './app.ts';
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

const server = createAppServer({ distDir, playlistHandler: createPlaylistHandler({ apiKey }), videosHandler: createVideosHandler({ apiKey }) });
server.listen(port, host, () => {
  console.log(`Yetiştiricem is running at http://${host.includes(':') ? `[${host}]` : host}:${port}`);
});
