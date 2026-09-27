import type { StudyCamp, SubjectPlaylist } from '../types/index.ts';
import type { DraftVideo } from '../utils/youtubeParser.ts';
import { inspectPlaylistLink, youtubeThumbnailUrl, youtubeWatchUrl } from '../utils/youtubeParser.ts';
import type { PlaylistEntry } from '../utils/youtubePlaylist.ts';
import { classifyCamp, youtubeIdsOf } from './camps.ts';
import { isDateKey } from './engine.ts';
import type { PlaylistFailure } from './playlistImport.ts';
import { FAILURE_TEXT, reviewPlaylist } from './playlistImport.ts';

// Keeping branches in step with their YouTube playlists. Once a day the app
// reads each branch's playlist through the server endpoint and remembers
// which videos it has seen there. Videos the playlist gained since are
// offered in the notification bell ("Planımın sonuna ekle" / "Göz ardı et");
// nothing is added without the student's click. Videos the student left out
// on import or removed later were already seen, so they never come back.

/** A new playlist video waiting for the student's decision (what YouTube reported). */
export interface PendingVideo {
  youtubeId: string;
  title: string;
  durationSeconds: number;
  channelName?: string;
  thumbnailUrl: string;
}

export interface BranchSync {
  /** Last successful check of the branch's playlist. */
  checkedOn: string;
  /** YouTube ids seen in the playlist so far (added, ignored or skipped). */
  seen: string[];
  pending: PendingVideo[];
}

export interface PlaylistSync {
  /** Day of the last check (at most one a day, to spare the API quota). */
  lastAttempt: string | null;
  /** Why the last check stopped early, if it did. */
  lastFailure: Exclude<PlaylistFailure, 'aborted'> | null;
  /** By branch id. */
  branches: Record<string, BranchSync>;
}

export const PLAYLIST_SYNC_VERSION = 1;

export function emptyPlaylistSync(): PlaylistSync {
  return { lastAttempt: null, lastFailure: null, branches: {} };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function readPending(raw: unknown): PendingVideo | null {
  if (!isRecord(raw) || typeof raw.youtubeId !== 'string' || !VIDEO_ID_RE.test(raw.youtubeId)) return null;
  if (typeof raw.title !== 'string' || typeof raw.durationSeconds !== 'number' || !(raw.durationSeconds > 0)) return null;
  return {
    youtubeId: raw.youtubeId,
    title: raw.title.slice(0, 200),
    durationSeconds: Math.round(raw.durationSeconds),
    ...(typeof raw.channelName === 'string' && raw.channelName.trim() ? { channelName: raw.channelName.trim() } : {}),
    // Rebuilt from the id rather than trusted as stored.
    thumbnailUrl: youtubeThumbnailUrl(raw.youtubeId),
  };
}

/** A stored `yt_playlist_sync` value, or null when it is not one this version understands. */
export function normalizePlaylistSync(raw: unknown): PlaylistSync | null {
  if (!isRecord(raw) || !isRecord(raw.branches)) return null;
  if (typeof raw.version === 'number' && raw.version > PLAYLIST_SYNC_VERSION) return null;
  const branches: Record<string, BranchSync> = {};
  for (const [id, entry] of Object.entries(raw.branches)) {
    if (!isRecord(entry) || !isDateKey(entry.checkedOn) || !Array.isArray(entry.seen) || !Array.isArray(entry.pending)) continue;
    branches[id] = {
      checkedOn: entry.checkedOn,
      seen: entry.seen.filter((v): v is string => typeof v === 'string' && VIDEO_ID_RE.test(v)),
      pending: entry.pending.flatMap(p => {
        const video = readPending(p);
        return video ? [video] : [];
      }),
    };
  }
  const failure = raw.lastFailure;
  return {
    lastAttempt: isDateKey(raw.lastAttempt) ? raw.lastAttempt : null,
    lastFailure: typeof failure === 'string' && failure in FAILURE_TEXT ? (failure as PlaylistSync['lastFailure']) : null,
    branches,
  };
}

export function playlistSyncStore(sync: PlaylistSync) {
  return { version: PLAYLIST_SYNC_VERSION, ...sync };
}

export interface SyncTarget {
  campId: string;
  branch: SubjectPlaylist;
  playlistId: string;
}

/** Branches that can be checked: the student's own branches with a readable playlist link. */
export function syncTargets(camps: readonly StudyCamp[]): SyncTarget[] {
  return camps.flatMap(camp =>
    camp.branches.flatMap(branch => {
      if (classifyCamp(branch) !== 'manual' || !branch.playlistUrl) return [];
      const link = inspectPlaylistLink(branch.playlistUrl);
      return link.ok ? [{ campId: camp.id, branch, playlistId: link.id }] : [];
    })
  );
}

/** At most one check a day. */
export function isCheckDue(sync: PlaylistSync, today: string): boolean {
  return sync.lastAttempt !== today;
}

/**
 * What a fresh read of a branch's playlist means. Only importable videos
 * count (not private, deleted, live, too long, repeated, or blocked in
 * Turkey). With an earlier check, a video is new when that check had not
 * seen it. On the first check nothing records what the playlist held at
 * import, so only videos after the branch's last video in playlist order
 * count as new (playlists usually grow at the end); a branch that shares no
 * video with its playlist only starts the record.
 */
export function diffPlaylist(branch: SubjectPlaylist, entries: readonly PlaylistEntry[], previous: BranchSync | undefined, today: string): BranchSync {
  const inBranch = new Set(youtubeIdsOf(branch));
  const rows = reviewPlaylist([...entries], inBranch);
  const ready = rows.filter(row => row.status === 'ready' && row.entry.kind === 'video');
  let fresh = ready;
  if (previous) {
    const seen = new Set(previous.seen);
    fresh = ready.filter(row => row.entry.kind === 'video' && !seen.has(row.entry.videoId));
  } else {
    const lastKnown = Math.max(-1, ...rows.filter(row => row.status === 'in-list').map(row => row.index));
    fresh = lastKnown < 0 ? [] : ready.filter(row => row.index > lastKnown);
  }

  const pending = new Map<string, PendingVideo>();
  for (const video of previous?.pending ?? []) if (!inBranch.has(video.youtubeId)) pending.set(video.youtubeId, video);
  for (const row of fresh) {
    if (row.entry.kind !== 'video') continue;
    const { videoId, title, durationSeconds, channelTitle } = row.entry;
    pending.set(videoId, {
      youtubeId: videoId,
      title: title.trim().slice(0, 200),
      durationSeconds,
      ...(channelTitle.trim() ? { channelName: channelTitle.trim() } : {}),
      thumbnailUrl: youtubeThumbnailUrl(videoId),
    });
  }

  const seen = new Set(previous?.seen ?? []);
  for (const entry of entries) if (entry.kind === 'video') seen.add(entry.videoId);
  return { checkedOn: today, seen: [...seen], pending: [...pending.values()] };
}

/** A branch's waiting videos that it does not hold yet (one may have been added by hand meanwhile). */
export function pendingOf(sync: PlaylistSync, branch: SubjectPlaylist): PendingVideo[] {
  const inBranch = new Set(youtubeIdsOf(branch));
  return (sync.branches[branch.id]?.pending ?? []).filter(video => !inBranch.has(video.youtubeId));
}

export interface SyncNotification {
  campId: string;
  campName: string;
  branch: SubjectPlaylist;
  videos: PendingVideo[];
  minutes: number;
}

/** Everything the bell shows, in camp and branch order. */
export function syncNotifications(camps: readonly StudyCamp[], sync: PlaylistSync): SyncNotification[] {
  return syncTargets(camps).flatMap(({ campId, branch }) => {
    const videos = pendingOf(sync, branch);
    if (videos.length === 0) return [];
    const camp = camps.find(c => c.id === campId);
    return [{ campId, campName: camp?.name ?? '', branch, videos, minutes: videos.reduce((acc, v) => acc + v.durationSeconds, 0) / 60 }];
  });
}

export function draftFromPending(video: PendingVideo): DraftVideo {
  return {
    youtubeId: video.youtubeId,
    url: youtubeWatchUrl(video.youtubeId),
    title: video.title,
    durationMinutes: video.durationSeconds / 60,
    ...(video.channelName ? { channelName: video.channelName } : {}),
    thumbnailUrl: video.thumbnailUrl,
  };
}
