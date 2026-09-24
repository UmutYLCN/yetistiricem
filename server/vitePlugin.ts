import type { Connect, Plugin } from 'vite';
import { loadEnv } from 'vite';
import type { WebHandler } from './playlistEndpoint.ts';
import { createPlaylistHandler } from './playlistEndpoint.ts';
import { isPlaylistApiRequest, runWebHandler } from './node.ts';

/**
 * Serves `GET /api/youtube/playlist` from `vite` and `vite preview`.
 *
 * `YOUTUBE_API_KEY` is read on the server from the environment or `.env.local`.
 * It has no `VITE_` prefix, so Vite never copies it into `import.meta.env`, and
 * this plugin does not run during `vite build` at all.
 */
export function youtubePlaylistApi(): Plugin {
  let handler: WebHandler | null = null;
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!handler || !isPlaylistApiRequest(req.url)) return next();
    runWebHandler(handler, req, res).catch(next);
  };

  return {
    name: 'yetistiricem:youtube-playlist-api',
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir === false ? false : (config.envDir ?? config.root), 'YOUTUBE_');
      handler = createPlaylistHandler({ apiKey: env.YOUTUBE_API_KEY });
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
