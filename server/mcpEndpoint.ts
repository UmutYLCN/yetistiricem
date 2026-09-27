// `POST /mcp`: the Yetişir MCP server (docs/mcp.md), a standard fetch
// handler like the YouTube endpoints, so it runs in the Vite dev server, the
// Node server and Cloudflare Pages. Clients sign the student in with Supabase
// Auth's OAuth server; `/.well-known/oauth-protected-resource/mcp` tells them
// where. YouTube is read with the same key and client as `/api/youtube/*`
// (the key never reaches an answer).
import type { PlaylistEntry, PlaylistResponse } from '../src/utils/youtubePlaylist.ts';
import type { WebHandler } from './playlistEndpoint.ts';
import { cachedLoader } from './playlistEndpoint.ts';
import type { FetchLike } from './youtubeApi.ts';
import { YouTubeApiError, fetchPlaylist, fetchVideos } from './youtubeApi.ts';
import type { FetchText, SupabaseConfig } from './mcp/account.ts';
import { createTokenChecker, resourceMetadata } from './mcp/account.ts';
import { createMcpServer } from './mcp/protocol.ts';
import { yetistiricemTools } from './mcp/tools.ts';

export const MCP_RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource/mcp';

export interface McpHandlerOptions {
  /** The YouTube Data API key; missing: the YouTube tools answer "not set up". */
  apiKey: string | undefined;
  /** Supabase URL and publishable key: sign-in, the student's plan and Keşfet. Missing: every request answers 503. */
  supabase?: { url?: string; key?: string };
  /** This server's public origin (or a getter, for a dev server whose port is known late); default: the origin the request came to. */
  appOrigin?: string | (() => string | undefined);
  fetch?: FetchLike;
  /** Requests to Supabase (auth, plan, Keşfet). */
  supabaseFetch?: FetchText;
  cacheTtlMs?: number;
  now?: () => number;
  log?: (message: string) => void;
  /** Today's date key; default: the day in Türkiye, where the students are. */
  today?: () => string;
}

/** Today in Türkiye as `YYYY-MM-DD` (the server's clock may run in any zone). */
export function turkeyToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function supabaseConfig(raw: McpHandlerOptions['supabase']): SupabaseConfig | null {
  const url = raw?.url?.trim().replace(/\/+$/, '') ?? '';
  const key = raw?.key?.trim() ?? '';
  return /^https:\/\/[^/]+$/.test(url) && key ? { url, key } : null;
}

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function originOf(options: Pick<McpHandlerOptions, 'appOrigin'>, request: Request): string {
  const configured = typeof options.appOrigin === 'function' ? options.appOrigin() : options.appOrigin;
  return configured?.replace(/\/+$/, '') || new URL(request.url).origin;
}

/** `GET /.well-known/oauth-protected-resource[/mcp]`: where MCP clients get a token (RFC 9728). */
export function createResourceMetadataHandler(options: Pick<McpHandlerOptions, 'supabase' | 'appOrigin'>): WebHandler {
  const config = supabaseConfig(options.supabase);
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET, OPTIONS' } });
    if (!config) return new Response(JSON.stringify({ error: 'not-configured' }), { status: 503, headers: JSON_HEADERS });
    const body = resourceMetadata(`${originOf(options, request)}/mcp`, config);
    return new Response(JSON.stringify(body), { status: 200, headers: { ...JSON_HEADERS, 'Access-Control-Allow-Origin': '*' } });
  };
}

export function createMcpHandler(options: McpHandlerOptions): WebHandler {
  const apiKey = options.apiKey?.trim() ?? '';
  const config = supabaseConfig(options.supabase);
  const log = options.log ?? (message => console.warn(message));
  const cache = { cacheTtlMs: options.cacheTtlMs, now: options.now };
  const requireKey = () => {
    if (!apiKey) throw new YouTubeApiError('not-configured');
  };
  const playlist = cachedLoader<PlaylistResponse>(id => fetchPlaylist(id, { apiKey, fetch: options.fetch }), cache);
  const videos = cachedLoader<PlaylistEntry[]>(key => fetchVideos(key.split(','), { apiKey, fetch: options.fetch }), cache);
  if (!config) {
    return async () => new Response(JSON.stringify({ error: 'Sign-in is not set up on this Yetişir server.' }), { status: 503, headers: JSON_HEADERS });
  }
  const checkToken = createTokenChecker(config, { fetch: options.supabaseFetch, now: options.now });

  const unauthorized = (request: Request, error?: string) =>
    new Response(JSON.stringify({ error: error ?? 'unauthorized' }), {
      status: 401,
      headers: {
        ...JSON_HEADERS,
        'WWW-Authenticate': `Bearer resource_metadata="${originOf(options, request)}${MCP_RESOURCE_METADATA_PATH}"${error ? `, error="${error}"` : ''}`,
      },
    });

  return createMcpServer({
    name: 'yetistiricem',
    title: 'Yetişir',
    version: '2.0.0',
    instructions: [
      'Yetişir is a Turkish study planner. A student\'s "camp" holds branches (subjects) of YouTube lesson videos or typed topics, and the app splits them into days that fit the daily study time. You act for the signed-in student.',
      'To coach them ("nasıl gidiyorum?"), read get_my_progress and get_my_plan and answer from those numbers.',
      'To build a roadmap with them: agree on the goal, deadline, daily hours and study days; read their playlists with read_youtube_playlist; write the camp JSON following get_camp_format; check it with send_camp dryRun (it reports the finish date); add it with send_camp once they agree.',
      'Never invent videos, ids, channel names or durations: YouTube videos come from read_youtube_playlist / read_youtube_videos, and send_camp replaces them with YouTube\'s data anyway. Use link-free topics only for material the student studies without a video.',
    ].join(' '),
    tools: yetistiricemTools({
      loadPlaylist: async id => {
        requireKey();
        return playlist(id);
      },
      loadVideos: async ids => {
        requireKey();
        return videos(ids.join(','));
      },
      supabase: config,
      fetch: options.supabaseFetch,
      appOrigin: options.appOrigin,
      today: options.today ?? (() => turkeyToday()),
    }),
    authenticate: async request => {
      const header = request.headers.get('authorization') ?? '';
      const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
      if (!token) return unauthorized(request);
      let userId: string | null;
      try {
        userId = await checkToken(token);
      } catch {
        log('[mcp] sign-in check failed');
        return new Response(JSON.stringify({ error: 'Sign-in could not be checked. Try again in a moment.' }), { status: 503, headers: JSON_HEADERS });
      }
      return userId ? { userId, token } : unauthorized(request, 'invalid_token');
    },
    log,
  });
}
