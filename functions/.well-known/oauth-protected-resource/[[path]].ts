import { createResourceMetadataHandler } from '../../../server/mcpEndpoint.ts';

interface PagesContext {
  request: Request;
  env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string };
}

/** `/.well-known/oauth-protected-resource[/mcp]`: where MCP clients sign the student in (docs/mcp.md). */
export function onRequest({ request, env }: PagesContext): Promise<Response> {
  return createResourceMetadataHandler({ supabase: { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_PUBLISHABLE_KEY } })(request);
}
