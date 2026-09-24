// Reads one public playlist with the YouTube Data API v3.
//
// Only three fixed endpoints are called (playlists, playlistItems, videos) on a
// fixed host, with a playlist id that has already been validated. The API key
// travels in the `X-Goog-Api-Key` header, never in a URL, and no upstream error
// text is passed on: failures become a `PlaylistErrorCode`.
import type {
  PlaylistEntry,
  PlaylistErrorCode,
  PlaylistResponse,
  UnavailableReason,
} from '../src/utils/youtubePlaylist.ts';
import { parseIsoDuration } from '../src/utils/youtubePlaylist.ts';
import { youtubePlaylistUrl, youtubeThumbnailUrl, youtubeWatchUrl } from '../src/utils/youtubeParser.ts';

const API_BASE = 'https://www.googleapis.com/youtube/v3/';
const PAGE_SIZE = 50;
/** 100 pages of 50: YouTube's own limit of 5,000 videos per playlist. */
export const MAX_PLAYLIST_PAGES = 100;
const REQUEST_TIMEOUT_MS = 15_000;
const VIDEO_BATCH_CONCURRENCY = 4;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export type FetchLike = (input: URL, init: RequestInit) => Promise<Response>;

export interface YouTubeClientOptions {
  apiKey: string;
  fetch?: FetchLike;
  maxPages?: number;
  timeoutMs?: number;
}

export class YouTubeApiError extends Error {
  readonly code: PlaylistErrorCode;
  /** HTTP status YouTube answered with, when there was an answer. */
  readonly status: number | null;
  /** YouTube's machine-readable reason (never its message text). */
  readonly reason: string | null;

  constructor(code: PlaylistErrorCode, status: number | null = null, reason: string | null = null) {
    super(`YouTube request failed: ${code}${status ? ` (HTTP ${status}${reason ? `, ${reason}` : ''})` : ''}`);
    this.name = 'YouTubeApiError';
    this.code = code;
    this.status = status;
    this.reason = reason;
  }
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Json {
  return isRecord(value) ? value : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const QUOTA_REASONS = new Set([
  'quotaExceeded',
  'dailyLimitExceeded',
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'RATE_LIMIT_EXCEEDED',
]);
const KEY_REASONS = new Set([
  'keyInvalid',
  'keyExpired',
  'accessNotConfigured',
  'ipRefererBlocked',
  'API_KEY_INVALID',
  'API_KEY_EXPIRED',
  'SERVICE_DISABLED',
  'API_KEY_SERVICE_BLOCKED',
  'API_KEY_HTTP_REFERRER_BLOCKED',
  'API_KEY_IP_ADDRESS_BLOCKED',
  'API_KEY_ANDROID_APP_BLOCKED',
  'API_KEY_IOS_APP_BLOCKED',
]);
const PRIVATE_REASONS = new Set(['playlistItemsNotAccessible', 'playlistForbidden', 'forbidden']);
const NOT_FOUND_REASONS = new Set(['playlistNotFound', 'notFound', 'channelNotFound']);

/** Maps a Google API error answer to an endpoint error code. */
export function classifyGoogleError(status: number, body: unknown): YouTubeApiError {
  const error = record(record(body).error);
  // Detail reasons (API_KEY_INVALID, SERVICE_DISABLED…) first: they are the most specific.
  const reasons = [
    ...list(error.details).map(d => text(record(d).reason)),
    ...list(error.errors).map(e => text(record(e).reason)),
  ].filter(Boolean);
  const has = (set: Set<string>) => reasons.some(r => set.has(r));
  const reason = reasons[0] ?? null;

  if (status === 429 || has(QUOTA_REASONS)) return new YouTubeApiError('quota', status, reason);
  // Checked before the generic 403s: a restricted key also answers 403 "forbidden".
  if (has(KEY_REASONS)) return new YouTubeApiError('bad-key', status, reason);
  if (status === 404 || has(NOT_FOUND_REASONS)) return new YouTubeApiError('not-found', status, reason);
  if (status === 403 && has(PRIVATE_REASONS)) return new YouTubeApiError('private', status, reason);
  if (status === 401) return new YouTubeApiError('bad-key', status, reason);
  return new YouTubeApiError('upstream', status, reason);
}

async function callApi(
  resource: 'playlists' | 'playlistItems' | 'videos',
  params: Record<string, string>,
  options: YouTubeClientOptions
): Promise<Json> {
  const url = new URL(resource, API_BASE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const fetchImpl: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { 'X-Goog-Api-Key': options.apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
  } catch {
    // The original error is dropped on purpose: it can quote the request.
    throw new YouTubeApiError('upstream', null, 'network');
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) throw classifyGoogleError(response.status, body);
  if (!isRecord(body)) throw new YouTubeApiError('upstream', response.status, 'invalid-json');
  return body;
}

function pickThumbnail(thumbnails: unknown, videoId: string | null): string {
  const set = record(thumbnails);
  for (const size of ['medium', 'high', 'standard', 'default']) {
    const url = text(record(set[size]).url);
    if (url.startsWith('https://')) return url;
  }
  return videoId ? youtubeThumbnailUrl(videoId) : '';
}

function blockedInTurkey(regionRestriction: unknown): boolean {
  const restriction = record(regionRestriction);
  const blocked = list(restriction.blocked);
  const allowed = Array.isArray(restriction.allowed) ? restriction.allowed : null;
  return blocked.includes('TR') || (allowed !== null && !allowed.includes('TR'));
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function videoIdOf(item: unknown): string | null {
  const id = text(record(record(item).contentDetails).videoId) || text(record(record(record(item).snippet).resourceId).videoId);
  return VIDEO_ID_RE.test(id) ? id : null;
}

function toEntry(item: unknown, videos: Map<string, Json>): PlaylistEntry {
  const videoId = videoIdOf(item);
  const video = videoId ? videos.get(videoId) : undefined;
  const unavailable = (reason: UnavailableReason): PlaylistEntry => ({ kind: 'unavailable', videoId, reason });

  if (!videoId || !video) {
    return unavailable(text(record(record(item).status).privacyStatus) === 'private' ? 'private' : 'deleted');
  }
  const videoSnippet = record(video.snippet);
  const details = record(video.contentDetails);
  const status = record(video.status);
  if (text(status.privacyStatus) === 'private') return unavailable('private');
  if (['deleted', 'failed', 'rejected'].includes(text(status.uploadStatus))) return unavailable('deleted');
  const live = text(videoSnippet.liveBroadcastContent);
  if (live === 'live') return unavailable('live');
  if (live === 'upcoming') return unavailable('upcoming');
  const seconds = parseIsoDuration(details.duration);
  if (seconds === null || seconds <= 0) return unavailable('no-duration');

  return {
    kind: 'video',
    videoId,
    title: text(videoSnippet.title),
    channelTitle: text(videoSnippet.channelTitle),
    url: youtubeWatchUrl(videoId),
    thumbnailUrl: pickThumbnail(videoSnippet.thumbnails, videoId),
    durationSeconds: seconds,
    blockedInTurkey: blockedInTurkey(details.regionRestriction),
  };
}

/**
 * Every entry of a public or unlisted playlist, in playlist order, with each
 * video's title, channel, thumbnail and exact duration. `playlistId` must
 * already pass `isFetchablePlaylistId`.
 */
export async function fetchPlaylist(playlistId: string, options: YouTubeClientOptions): Promise<PlaylistResponse> {
  const meta = await callApi('playlists', { part: 'snippet', id: playlistId }, options);
  const playlistItem = list(meta.items)[0];
  // A private playlist is simply absent for a public API key.
  if (!isRecord(playlistItem)) throw new YouTubeApiError('not-found', 200, 'emptyResult');
  const playlistSnippet = record(playlistItem.snippet);

  const items: unknown[] = [];
  const maxPages = options.maxPages ?? MAX_PLAYLIST_PAGES;
  const seenTokens = new Set<string>();
  let pageToken = '';
  let truncated = false;
  for (let page = 0; ; page++) {
    if (page === maxPages) {
      truncated = true;
      break;
    }
    const params: Record<string, string> = {
      part: 'snippet,contentDetails,status',
      playlistId,
      maxResults: String(PAGE_SIZE),
    };
    if (pageToken) params.pageToken = pageToken;
    const result = await callApi('playlistItems', params, options);
    items.push(...list(result.items));
    const next = text(result.nextPageToken);
    if (!next) break;
    if (seenTokens.has(next)) {
      // YouTube repeated a page token; stop instead of looping, and say so.
      truncated = true;
      break;
    }
    seenTokens.add(next);
    pageToken = next;
  }

  const ids = [...new Set(items.map(videoIdOf).filter((id): id is string => id !== null))];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += PAGE_SIZE) batches.push(ids.slice(i, i + PAGE_SIZE));
  const results = await mapLimit(batches, VIDEO_BATCH_CONCURRENCY, batch =>
    callApi('videos', { part: 'snippet,contentDetails,status', id: batch.join(',') }, options)
  );
  const videos = new Map<string, Json>();
  for (const result of results) {
    for (const video of list(result.items)) {
      const id = text(record(video).id);
      if (VIDEO_ID_RE.test(id)) videos.set(id, record(video));
    }
  }

  return {
    playlist: {
      id: playlistId,
      title: text(playlistSnippet.title),
      channelTitle: text(playlistSnippet.channelTitle),
      url: youtubePlaylistUrl(playlistId),
    },
    entries: items.map(item => toEntry(item, videos)),
    truncated,
  };
}
