import type { Connect, Plugin } from 'vite';
import { loadEnv } from 'vite';
import type { YouTubeHandlers } from './node.ts';
import { runWebHandler, youtubeHandlerFor } from './node.ts';
import { createMcpHandler, createResourceMetadataHandler } from './mcpEndpoint.ts';
import { createPlaylistHandler } from './playlistEndpoint.ts';
import { createVideosHandler } from './videosEndpoint.ts';

/**
 * Serves `GET /api/youtube/playlist`, `GET /api/youtube/videos` and `POST /mcp` from `vite` and `vite preview`.
 *
 * `YOUTUBE_API_KEY` is read on the server from the environment or `.env.local`.
 * It has no `VITE_` prefix, so Vite never copies it into `import.meta.env`, and
 * this plugin does not run during `vite build` at all.
 */
export function youtubePlaylistApi(): Plugin {
  let handlers: YouTubeHandlers | null = null;
  // Import links from the MCP server point at the dev server, whose port is known once it listens.
  let origin: string | undefined;
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const handler = handlers && youtubeHandlerFor(req.url, handlers);
    if (!handler) return next();
    runWebHandler(handler, req, res).catch(next);
  };

  return {
    name: 'yetistiricem:youtube-playlist-api',
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir === false ? false : (config.envDir ?? config.root), ['YOUTUBE_', 'VITE_SUPABASE_']);
      const supabase = { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_PUBLISHABLE_KEY };
      handlers = {
        playlistHandler: createPlaylistHandler({ apiKey: env.YOUTUBE_API_KEY }),
        videosHandler: createVideosHandler({ apiKey: env.YOUTUBE_API_KEY }),
        mcpHandler: createMcpHandler({ apiKey: env.YOUTUBE_API_KEY, supabase, appOrigin: () => origin }),
        resourceMetadataHandler: createResourceMetadataHandler({ supabase, appOrigin: () => origin }),
      };
    },
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        origin = server.resolvedUrls?.local[0];
      });
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.httpServer.once('listening', () => {
        origin = server.resolvedUrls?.local[0];
      });
      server.middlewares.use(middleware);
    },
  };
}
