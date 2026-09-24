import type { SubjectPlaylist, Video } from '../types';
import type { DraftVideo } from '../utils/youtubeParser';
import { isWatchableVideoUrl, parseYoutubeVideoId, youtubeThumbnailUrl } from '../utils/youtubeParser';
import { defaultColorKey } from './subjects';

/**
 * How trustworthy a camp's video data is.
 * - `manual`: every video was pasted by the user with a real YouTube link.
 * - `demo-template`: built-in sample topics without links (labelled as demo).
 * - `legacy-sample`: an old built-in preset. Its links pointed at a fake
 *   `watch?v=sample` address, its durations were random and the channel name
 *   was only illustrative.
 * - `legacy-generated`: an old "import by link" camp. The playlist was never
 *   read; 20 videos of 45 minutes were invented, all pointing at the list.
 */
export type CampKind = 'manual' | 'demo-template' | 'legacy-sample' | 'legacy-generated';

const LEGACY_PRESET_IDS = new Set([
  'preset-mert-mat',
  'preset-eyup-geo',
  'preset-vip-fizik',
  'preset-gorkem-kimya',
  'preset-dr-biyoloji',
  'preset-kadir-turkce',
]);

const SAMPLE_URL_RE = /watch\?v=sample\b/;

export function classifyCamp(camp: SubjectPlaylist): CampKind {
  if (camp.source === 'demo-template') return 'demo-template';
  if (camp.source === 'manual') return 'manual';
  const videos = Array.isArray(camp.videos) ? camp.videos : [];
  if (LEGACY_PRESET_IDS.has(camp.id) || videos.some(v => SAMPLE_URL_RE.test(v.videoUrl ?? ''))) {
    return 'legacy-sample';
  }
  if (
    camp.id.startsWith('custom-') &&
    videos.length > 0 &&
    videos.every(v => /^Özel Video \d+$/.test(v.title) && v.videoUrl === camp.playlistUrl)
  ) {
    return 'legacy-generated';
  }
  return 'manual';
}

export function isLegacyKind(kind: CampKind): boolean {
  return kind === 'legacy-sample' || kind === 'legacy-generated';
}

export const KIND_LABEL: Record<CampKind, string> = {
  manual: 'Kendi listen',
  'demo-template': 'Demo şablon',
  'legacy-sample': 'Eski örnek veri',
  'legacy-generated': 'Eski otomatik liste',
};

/** Link state of one task, for the "İzle" affordance. */
export type LinkState = 'video' | 'playlist-only' | 'sample' | 'none';

export function linkStateOf(videoUrl: string | undefined, kind: CampKind): LinkState {
  if (isWatchableVideoUrl(videoUrl)) return 'video';
  if (kind === 'legacy-sample' || SAMPLE_URL_RE.test(videoUrl ?? '')) return 'sample';
  if (kind === 'legacy-generated' && videoUrl) return 'playlist-only';
  return 'none';
}

/** Channel attribution safe to show: never for legacy samples or demos. */
export function displayChannel(camp: SubjectPlaylist, kind: CampKind): string | null {
  if (kind !== 'manual') return null;
  const name = camp.channelName?.trim();
  return name ? name : null;
}

function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function totalMinutesOf(videos: Video[]): number {
  return videos.reduce((acc, v) => acc + (Number.isFinite(v.durationMinutes) ? v.durationMinutes : 0), 0);
}

export function videoFromDraft(draft: DraftVideo, campId: string, position: number): Video {
  return {
    id: newId(`${campId}-v`),
    title: draft.title.trim() || `Video ${position}`,
    durationMinutes: draft.durationMinutes,
    videoUrl: draft.url,
    thumbnailUrl: youtubeThumbnailUrl(draft.youtubeId),
    completed: false,
  };
}

export interface NewCampInput {
  title: string;
  subject: string;
  colorTag?: string;
  channelName: string;
  playlistUrl: string;
  videos: DraftVideo[];
}

export function createManualCamp(input: NewCampInput): SubjectPlaylist {
  const id = newId('camp');
  const videos = input.videos.map((draft, i) => videoFromDraft(draft, id, i + 1));
  return {
    id,
    title: input.title.trim(),
    subject: input.subject.trim() || 'Diğer',
    channelName: input.channelName.trim(),
    playlistUrl: input.playlistUrl,
    videos,
    colorTag: input.colorTag || defaultColorKey(input.subject),
    totalDurationMinutes: totalMinutesOf(videos),
    source: 'manual',
  };
}

export function withVideos(camp: SubjectPlaylist, videos: Video[]): SubjectPlaylist {
  return { ...camp, videos, totalDurationMinutes: totalMinutesOf(videos) };
}

/** YouTube ids already in a camp, to flag duplicates while adding. */
export function youtubeIdsOf(camp: SubjectPlaylist | null | undefined): string[] {
  if (!camp) return [];
  return camp.videos.flatMap(v => {
    const id = parseYoutubeVideoId(v.videoUrl ?? '');
    return id ? [id] : [];
  });
}
