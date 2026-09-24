// Contract of the playlist endpoint (`GET /api/youtube/playlist?id=…`), shared
// by the server (`server/`) and the browser. The server reads the playlist with
// the YouTube Data API and answers with this shape; the browser validates it
// again before showing anything.
import { PLAYLIST_ID_RE, youtubePlaylistUrl, youtubeThumbnailUrl, youtubeWatchUrl } from './youtubeParser.ts';

export const PLAYLIST_API_PATH = '/api/youtube/playlist';

export interface PlaylistInfo {
  id: string;
  title: string;
  /** The channel that owns the playlist. */
  channelTitle: string;
  url: string;
}

/**
 * Why a playlist entry has no importable video:
 * - `private`: the uploader made the video private.
 * - `deleted`: deleted, removed or otherwise not returned by YouTube.
 * - `live` / `upcoming`: a live stream or premiere without a final duration.
 * - `no-duration`: YouTube reports no duration (e.g. still processing).
 */
export type UnavailableReason = 'private' | 'deleted' | 'live' | 'upcoming' | 'no-duration';

export interface PlaylistVideoEntry {
  kind: 'video';
  videoId: string;
  title: string;
  /** The channel that uploaded the video (may differ from the playlist owner). */
  channelTitle: string;
  /** Canonical watch link. */
  url: string;
  thumbnailUrl: string;
  /** Exact length in whole seconds, from `contentDetails.duration`. */
  durationSeconds: number;
  /** YouTube lists Turkey as a blocked (or not allowed) region. */
  blockedInTurkey: boolean;
}

export interface PlaylistUnavailableEntry {
  kind: 'unavailable';
  /** Null when YouTube did not even return an id. */
  videoId: string | null;
  reason: UnavailableReason;
}

/** One playlist slot, in playlist order. */
export type PlaylistEntry = PlaylistVideoEntry | PlaylistUnavailableEntry;

export interface PlaylistResponse {
  playlist: PlaylistInfo;
  entries: PlaylistEntry[];
  /** More pages existed than the server reads (YouTube caps playlists at 5,000 videos). */
  truncated: boolean;
}

/** Error codes the endpoint answers with, as `{ error: { code } }`. */
export const PLAYLIST_ERROR_CODES = [
  'invalid-id', // 400: the id is missing or not a readable playlist id
  'not-found', // 404: no such playlist, or it is private
  'private', // 403: YouTube refuses to list the playlist's items
  'quota', // 429: the project's daily quota or rate limit is used up
  'not-configured', // 503: the server has no YOUTUBE_API_KEY
  'bad-key', // 502: the key is invalid, restricted, or the API is not enabled
  'upstream', // 502: YouTube failed or could not be reached
  'method', // 405: only GET is supported
] as const;

export type PlaylistErrorCode = (typeof PLAYLIST_ERROR_CODES)[number];

export interface PlaylistErrorBody {
  error: { code: PlaylistErrorCode };
}

export const PLAYLIST_ERROR_STATUS: Record<PlaylistErrorCode, number> = {
  'invalid-id': 400,
  'not-found': 404,
  private: 403,
  quota: 429,
  'not-configured': 503,
  'bad-key': 502,
  upstream: 502,
  method: 405,
};

export function isPlaylistErrorCode(value: unknown): value is PlaylistErrorCode {
  return typeof value === 'string' && (PLAYLIST_ERROR_CODES as readonly string[]).includes(value);
}

const ISO_DURATION_RE = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * Seconds in an ISO 8601 duration as YouTube writes them ("PT1H2M3S",
 * "P1DT2H", "PT0S"). Null for anything else, including year/month forms.
 */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = ISO_DURATION_RE.exec(value);
  if (!match || value === 'P' || value.endsWith('T')) return null;
  const [, weeks, days, hours, minutes, seconds] = match;
  const total =
    Number(weeks ?? 0) * 604800 +
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);
  return Number.isFinite(total) ? Math.round(total) : null;
}

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const REASONS: readonly UnavailableReason[] = ['private', 'deleted', 'live', 'upcoming', 'no-duration'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeThumbnail(value: unknown, videoId: string): string {
  return typeof value === 'string' && /^https:\/\/[a-z0-9.-]+\.(?:ytimg|ggpht|googleusercontent)\.com\//i.test(value)
    ? value
    : youtubeThumbnailUrl(videoId);
}

function parseEntry(raw: unknown): PlaylistEntry | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'unavailable') {
    const videoId = raw.videoId === null ? null : typeof raw.videoId === 'string' && VIDEO_ID_RE.test(raw.videoId) ? raw.videoId : undefined;
    if (videoId === undefined || !REASONS.includes(raw.reason as UnavailableReason)) return null;
    return { kind: 'unavailable', videoId, reason: raw.reason as UnavailableReason };
  }
  if (raw.kind !== 'video') return null;
  const { videoId, title, channelTitle, durationSeconds, blockedInTurkey } = raw;
  if (typeof videoId !== 'string' || !VIDEO_ID_RE.test(videoId)) return null;
  if (typeof title !== 'string' || typeof channelTitle !== 'string' || typeof blockedInTurkey !== 'boolean') return null;
  if (typeof durationSeconds !== 'number' || !Number.isInteger(durationSeconds) || durationSeconds <= 0) return null;
  return {
    kind: 'video',
    videoId,
    title,
    channelTitle,
    // Rebuilt from the id rather than trusted as sent.
    url: youtubeWatchUrl(videoId),
    thumbnailUrl: safeThumbnail(raw.thumbnailUrl, videoId),
    durationSeconds,
    blockedInTurkey,
  };
}

/** Validates an endpoint answer. Null when any part of it is malformed. */
export function parsePlaylistResponse(raw: unknown): PlaylistResponse | null {
  if (!isRecord(raw) || !isRecord(raw.playlist) || !Array.isArray(raw.entries) || typeof raw.truncated !== 'boolean') {
    return null;
  }
  const { id, title, channelTitle } = raw.playlist;
  if (typeof id !== 'string' || !PLAYLIST_ID_RE.test(id) || typeof title !== 'string' || typeof channelTitle !== 'string') {
    return null;
  }
  const entries: PlaylistEntry[] = [];
  for (const item of raw.entries) {
    const entry = parseEntry(item);
    if (!entry) return null;
    entries.push(entry);
  }
  return { playlist: { id, title, channelTitle, url: youtubePlaylistUrl(id) }, entries, truncated: raw.truncated };
}
