// A stand-in for the YouTube Data API v3, shaped like its real answers
// (playlists.list, playlistItems.list with page tokens, videos.list).
import type { FetchLike } from '../server/youtubeApi.ts';

export interface FakeVideo {
  id: string;
  title: string;
  channelTitle: string;
  duration: string;
  liveBroadcastContent?: 'none' | 'live' | 'upcoming';
  privacyStatus?: 'public' | 'unlisted' | 'private';
  uploadStatus?: string;
  regionRestriction?: { blocked?: string[]; allowed?: string[] };
  thumbnails?: Record<string, { url: string; width?: number; height?: number }>;
}

/** A playlist slot: a video id and the playlist item's own privacy flag. */
export interface FakeItem {
  videoId: string;
  privacy?: 'public' | 'private' | 'privacyStatusUnspecified';
}

export interface FakePlaylist {
  id: string;
  title: string;
  channelTitle: string;
  items: FakeItem[];
}

export interface RecordedCall {
  url: URL;
  headers: Headers;
}

export const TEST_KEY = 'AIzaTEST-secret-key-0123456789abcdefghi';

/** 11-character video id for index n: "vid00000001"… */
export const vid = (n: number) => `vid${String(n).padStart(8, '0')}`;

export function fakeVideo(n: number, overrides: Partial<FakeVideo> = {}): FakeVideo {
  return {
    id: vid(n),
    title: `Ders ${n}`,
    channelTitle: 'Örnek Kanal',
    duration: `PT${10 + (n % 40)}M${n % 60}S`,
    liveBroadcastContent: 'none',
    privacyStatus: 'public',
    uploadStatus: 'processed',
    thumbnails: {
      default: { url: `https://i.ytimg.com/vi/${vid(n)}/default.jpg` },
      medium: { url: `https://i.ytimg.com/vi/${vid(n)}/mqdefault.jpg` },
      high: { url: `https://i.ytimg.com/vi/${vid(n)}/hqdefault.jpg` },
    },
    ...overrides,
  };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=UTF-8' } });
}

/** A Google API error body, e.g. googleError(403, 'quotaExceeded'). */
export function googleError(code: number, reason: string, detailReason?: string, message = 'error'): Response {
  return jsonResponse(code, {
    error: {
      code,
      message,
      errors: [{ message, domain: 'youtube.api', reason }],
      ...(detailReason
        ? { details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: detailReason, domain: 'googleapis.com' }] }
        : {}),
    },
  });
}

export interface FakeYouTubeOptions {
  playlists: FakePlaylist[];
  videos: FakeVideo[];
  /** Answer a call yourself (return undefined to fall through). */
  intercept?: (url: URL, call: number) => Response | Promise<Response> | undefined;
}

export function fakeYouTube({ playlists, videos, intercept }: FakeYouTubeOptions) {
  const calls: RecordedCall[] = [];
  const byId = new Map(videos.map(v => [v.id, v]));

  const fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, headers: new Headers(init.headers) });
    const intercepted = intercept?.(url, calls.length);
    if (intercepted) return intercepted;
    if (url.origin !== 'https://www.googleapis.com') return new Response('unexpected host', { status: 599 });
    const resource = url.pathname.replace('/youtube/v3/', '');

    if (resource === 'playlists') {
      const playlist = playlists.find(p => p.id === url.searchParams.get('id'));
      return jsonResponse(200, {
        kind: 'youtube#playlistListResponse',
        pageInfo: { totalResults: playlist ? 1 : 0, resultsPerPage: 5 },
        items: playlist
          ? [{ kind: 'youtube#playlist', id: playlist.id, snippet: { title: playlist.title, channelTitle: playlist.channelTitle } }]
          : [],
      });
    }

    if (resource === 'playlistItems') {
      const playlist = playlists.find(p => p.id === url.searchParams.get('playlistId'));
      if (!playlist) return googleError(404, 'playlistNotFound');
      const size = Number(url.searchParams.get('maxResults') ?? 5);
      const token = url.searchParams.get('pageToken');
      const start = token ? Number(token.replace('page-', '')) : 0;
      const slice = playlist.items.slice(start, start + size);
      const next = start + size < playlist.items.length ? `page-${start + size}` : undefined;
      return jsonResponse(200, {
        kind: 'youtube#playlistItemListResponse',
        ...(next ? { nextPageToken: next } : {}),
        pageInfo: { totalResults: playlist.items.length, resultsPerPage: size },
        items: slice.map((item, i) => {
          const video = byId.get(item.videoId);
          const hidden = item.privacy === 'private' || !video;
          return {
            kind: 'youtube#playlistItem',
            snippet: {
              position: start + i,
              title: hidden ? (item.privacy === 'private' ? 'Private video' : 'Deleted video') : video.title,
              channelTitle: playlist.channelTitle,
              resourceId: { kind: 'youtube#video', videoId: item.videoId },
            },
            contentDetails: { videoId: item.videoId },
            status: { privacyStatus: item.privacy ?? 'public' },
          };
        }),
      });
    }

    if (resource === 'videos') {
      const ids = (url.searchParams.get('id') ?? '').split(',');
      if (ids.length > 50) return googleError(400, 'invalidParameter');
      return jsonResponse(200, {
        kind: 'youtube#videoListResponse',
        items: ids.flatMap(id => {
          const video = byId.get(id);
          if (!video || video.privacyStatus === 'private') return [];
          return [
            {
              kind: 'youtube#video',
              id,
              snippet: {
                title: video.title,
                channelTitle: video.channelTitle,
                liveBroadcastContent: video.liveBroadcastContent ?? 'none',
                thumbnails: video.thumbnails ?? {},
              },
              contentDetails: {
                duration: video.duration,
                ...(video.regionRestriction ? { regionRestriction: video.regionRestriction } : {}),
              },
              status: { privacyStatus: video.privacyStatus ?? 'public', uploadStatus: video.uploadStatus ?? 'processed' },
            },
          ];
        }),
      });
    }

    return new Response('not found', { status: 404 });
  };

  return { fetch, calls };
}

/** A made-up id with the shape of a real one ("PL" + 32 characters). */
export const PLAYLIST_ID = `PL${'TestPlaylist_Yetistiricem'.padEnd(32, '0')}`;
