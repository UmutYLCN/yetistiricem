import type { WebHandler } from '../server/playlistEndpoint.ts';
import { createMcpHandler } from '../server/mcpEndpoint.ts';

interface PagesContext {
  request: Request;
  env: {
    YOUTUBE_API_KEY?: string;
    // The public Supabase settings; the Pages project has them under their build names.
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  };
}

let configured = '';
let handler: WebHandler | undefined;

/** `POST /mcp` (docs/mcp.md). Links point at the address the request came to. */
export function onRequest({ request, env }: PagesContext): Promise<Response> {
  const settings = [env.YOUTUBE_API_KEY, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY].map(v => v?.trim() ?? '').join('\n');
  if (!handler || settings !== configured) {
    configured = settings;
    handler = createMcpHandler({
      apiKey: env.YOUTUBE_API_KEY,
      supabase: { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_PUBLISHABLE_KEY },
    });
  }
  return handler(request);
}
