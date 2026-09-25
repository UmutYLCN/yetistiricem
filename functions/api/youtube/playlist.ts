import type { WebHandler } from '../../../server/playlistEndpoint.ts';
import { createPlaylistHandler } from '../../../server/playlistEndpoint.ts';

interface PagesContext {
  request: Request;
  env: {
    YOUTUBE_API_KEY?: string;
  };
}

let configuredKey: string | undefined;
let handler: WebHandler | undefined;

/** Keep the shared playlist cache for the lifetime of this Pages isolate. */
export function onRequest({ request, env }: PagesContext): Promise<Response> {
  const key = env.YOUTUBE_API_KEY?.trim() ?? '';
  if (!handler || key !== configuredKey) {
    configuredKey = key;
    handler = createPlaylistHandler({ apiKey: key });
  }
  return handler(request);
}
