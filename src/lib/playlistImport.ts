// Browser side of the YouTube import: calls the server endpoints (a playlist, or
// videos by id), turns their answers into review rows (what can be imported,
// what is skipped and why) and the selected rows into draft videos. Messages
// are Turkish, for the UI.
import type { DraftVideo, PlaylistLinkProblem } from '../utils/youtubeParser.ts';
import { MAX_VIDEO_MINUTES } from '../utils/youtubeParser.ts';
import type { PlaylistEntry, PlaylistErrorCode, PlaylistResponse, UnavailableReason } from '../utils/youtubePlaylist.ts';
import {
  MAX_VIDEOS_PER_REQUEST,
  PLAYLIST_API_PATH,
  VIDEOS_API_PATH,
  isPlaylistErrorCode,
  parsePlaylistResponse,
  parseVideosResponse,
} from '../utils/youtubePlaylist.ts';

/** Endpoint error codes plus what can go wrong before an answer arrives. */
export type PlaylistFailure = PlaylistErrorCode | 'network' | 'timeout' | 'no-service' | 'unexpected' | 'aborted';

type FetchResult<T> = { ok: true; data: T } | { ok: false; failure: PlaylistFailure };
export type PlaylistFetchResult = FetchResult<PlaylistResponse>;
export type VideosFetchResult = { ok: true; entries: PlaylistEntry[] } | { ok: false; failure: PlaylistFailure };

export interface RequestPlaylistOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  endpoint?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Asks the server for a playlist. Never throws. */
export function requestPlaylist(playlistId: string, options: RequestPlaylistOptions = {}): Promise<PlaylistFetchResult> {
  return requestJson(`${options.endpoint ?? PLAYLIST_API_PATH}?id=${encodeURIComponent(playlistId)}`, parsePlaylistResponse, options);
}

/** Asks the server for videos by id, `MAX_VIDEOS_PER_REQUEST` at a time, keeping their order. Never throws. */
export async function requestVideos(videoIds: readonly string[], options: RequestPlaylistOptions = {}): Promise<VideosFetchResult> {
  const entries: PlaylistEntry[] = [];
  for (let i = 0; i < videoIds.length; i += MAX_VIDEOS_PER_REQUEST) {
    const ids = videoIds.slice(i, i + MAX_VIDEOS_PER_REQUEST).map(encodeURIComponent).join(',');
    const result = await requestJson(`${options.endpoint ?? VIDEOS_API_PATH}?ids=${ids}`, parseVideosResponse, options);
    if (!result.ok) return result;
    entries.push(...result.data.entries);
  }
  return { ok: true, entries };
}

async function requestJson<T>(url: string, parse: (raw: unknown) => T | null, options: RequestPlaylistOptions): Promise<FetchResult<T>> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 60_000);
  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener('abort', forwardAbort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const doFetch = options.fetch ?? ((input: string, init: RequestInit) => fetch(input, init));

  try {
    const response = await doFetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
    // Static hosts answer unknown paths with the app's HTML (or a 404 page).
    if (!isJson) return { ok: false, failure: response.ok || response.status === 404 || response.status >= 500 ? 'no-service' : 'unexpected' };
    let body: unknown = null;
    try {
      body = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      return { ok: false, failure: 'unexpected' };
    }
    if (response.ok) {
      const data = parse(body);
      return data ? { ok: true, data } : { ok: false, failure: 'unexpected' };
    }
    const code = isRecord(body) && isRecord(body.error) ? body.error.code : undefined;
    return { ok: false, failure: isPlaylistErrorCode(code) ? code : 'unexpected' };
  } catch {
    if (timedOut) return { ok: false, failure: 'timeout' };
    if (options.signal?.aborted) return { ok: false, failure: 'aborted' };
    return { ok: false, failure: 'network' };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', forwardAbort);
  }
}

export interface FailureText {
  title: string;
  body: string;
  /** Trying again may help. */
  retry: boolean;
}

const PRIVATE_HELP =
  'Gizli listeler ve senin hesabına özel listeler okunamaz. Listeyi YouTube’da “Liste dışı” ya da “Herkese açık” yapıp tekrar dene.';

export const FAILURE_TEXT: Record<Exclude<PlaylistFailure, 'aborted'>, FailureText> = {
  'invalid-id': {
    title: 'Bu liste kimliği okunamadı',
    body: 'Bağlantıyı YouTube’daki “Paylaş” düğmesinden yeniden kopyalayıp yapıştır.',
    retry: false,
  },
  'not-found': {
    title: 'Liste bulunamadı ya da gizli',
    body: `Liste silinmiş, gizli ya da bağlantı eksik olabilir. ${PRIVATE_HELP}`,
    retry: false,
  },
  private: {
    title: 'Bu listenin videolarına erişilemiyor',
    body: `YouTube listenin içeriğini paylaşmıyor. ${PRIVATE_HELP}`,
    retry: false,
  },
  quota: {
    title: 'YouTube sorgu kotası doldu',
    body: 'Bugünlük YouTube Data API kotası bitti. Kota her gün Türkiye saatiyle 10.00–11.00 civarında yenilenir. Bu arada konularını “Elle ekle” ile yazabilir, video bağlantılarını sonra plandan ekleyebilirsin.',
    retry: false,
  },
  'not-configured': {
    title: 'YouTube okuma bu sunucuda kurulmamış',
    body: 'Sunucuda YOUTUBE_API_KEY tanımlı değil (kurulum README’de). Bu arada konularını “Elle ekle” ile yazabilir, video bağlantılarını sonra plandan ekleyebilirsin.',
    retry: false,
  },
  'bad-key': {
    title: 'YouTube API anahtarı reddedildi',
    body: 'Sunucudaki anahtar geçersiz ya da kısıtlanmış, veya projede YouTube Data API v3 etkin değil. Uygulamayı kuran kişinin anahtarı kontrol etmesi gerekiyor.',
    retry: false,
  },
  upstream: {
    title: 'YouTube’dan yanıt alınamadı',
    body: 'YouTube şu an yanıt vermedi. Biraz sonra tekrar dene.',
    retry: true,
  },
  method: {
    title: 'Beklenmedik bir hata oluştu',
    body: 'Sunucu isteği kabul etmedi. Sayfayı yenileyip tekrar dene.',
    retry: true,
  },
  network: {
    title: 'Bağlantı kurulamadı',
    body: 'İnternet bağlantını kontrol edip tekrar dene.',
    retry: true,
  },
  timeout: {
    title: 'Yanıt çok uzun sürdü',
    body: 'YouTube zamanında yanıt vermedi. Bağlantını kontrol edip tekrar dene.',
    retry: true,
  },
  'no-service': {
    title: 'YouTube servisine ulaşılamadı',
    body: 'Uygulama YouTube okuma servisi olmadan (yalnızca statik dosyalarla) yayınlanmış ya da sunucu çalışmıyor olabilir. Bu arada konularını “Elle ekle” ile yazabilir, video bağlantılarını sonra plandan ekleyebilirsin.',
    retry: true,
  },
  unexpected: {
    title: 'Sunucudan anlaşılmayan bir yanıt geldi',
    body: 'Tekrar dene; sürerse konularını “Elle ekle” ile yazabilirsin.',
    retry: true,
  },
};

/** The same failures, worded for reading videos by their links. */
export const VIDEO_FAILURE_TEXT: Record<Exclude<PlaylistFailure, 'aborted'>, FailureText> = {
  ...FAILURE_TEXT,
  'invalid-id': {
    title: 'Bu video bağlantıları okunamadı',
    body: 'Bağlantıları YouTube’daki “Paylaş” düğmesinden yeniden kopyalayıp yapıştır.',
    retry: false,
  },
};

export const LINK_PROBLEM_TEXT: Record<PlaylistLinkProblem, string> = {
  empty: 'Oynatma listesinin bağlantısını yapıştır.',
  'not-youtube': 'Bu bir YouTube bağlantısı değil. Örnek: https://www.youtube.com/playlist?list=PL…',
  'video-only':
    'Bu tek bir videonun bağlantısı; içinde liste yok. Videoyu “Videolar” seçeneğiyle ekleyebilir ya da listenin kendi bağlantısını (…playlist?list=…) yapıştırabilirsin.',
  personal:
    '“Daha sonra izle” ve “Beğenilen videolar” yalnızca sana görünür; bu listeler okunamaz. Videoları yeni bir listeye kaydedip o listeyi “Liste dışı” ya da “Herkese açık” yap.',
  mix: 'Bu bir YouTube Mix’i (senin için otomatik oluşturulan karışık liste); Mix’ler okunamaz. Bir kanalın ya da senin oluşturduğun bir listenin bağlantısını kullan.',
  invalid: 'Bağlantıdaki liste kimliği (list=…) geçersiz görünüyor. Bağlantıyı yeniden kopyala.',
};

/**
 * - `ready`: importable, selected by default.
 * - `region`: importable, but YouTube marks it blocked in Turkey; not selected by default.
 * - `in-list`: this video is already in the camp or the draft list.
 * - `repeat`: the playlist contains this video earlier (`firstIndex`).
 * - `too-long`: longer than a single video may be (MAX_VIDEO_MINUTES).
 * - `unavailable`: private, deleted, live, upcoming or without a duration.
 */
export type RowStatus = 'ready' | 'region' | 'in-list' | 'repeat' | 'too-long' | 'unavailable';

export interface ReviewRow {
  /** 0-based playlist position. */
  index: number;
  entry: PlaylistEntry;
  status: RowStatus;
  /** For `repeat`: where the video first appears. */
  firstIndex?: number;
}

export function isSelectable(row: ReviewRow): boolean {
  return row.status === 'ready' || row.status === 'region';
}

/** Classifies every playlist entry against the videos already in the list. */
export function reviewPlaylist(entries: PlaylistEntry[], knownIds: Iterable<string>): ReviewRow[] {
  const known = new Set(knownIds);
  const firstSeen = new Map<string, number>();
  return entries.map((entry, index): ReviewRow => {
    if (entry.kind === 'unavailable') return { index, entry, status: 'unavailable' };
    const first = firstSeen.get(entry.videoId);
    if (first !== undefined) return { index, entry, status: 'repeat', firstIndex: first };
    firstSeen.set(entry.videoId, index);
    if (known.has(entry.videoId)) return { index, entry, status: 'in-list' };
    if (entry.durationSeconds > MAX_VIDEO_MINUTES * 60) return { index, entry, status: 'too-long' };
    return { index, entry, status: entry.blockedInTurkey ? 'region' : 'ready' };
  });
}

export function initialSelection(rows: ReviewRow[]): Set<number> {
  return new Set(rows.filter(row => row.status === 'ready').map(row => row.index));
}

/** Selected, still-importable rows as draft videos, in playlist order. */
export function selectedDrafts(rows: ReviewRow[], selected: ReadonlySet<number>): DraftVideo[] {
  return rows.flatMap(row => {
    if (!selected.has(row.index) || !isSelectable(row) || row.entry.kind !== 'video') return [];
    const { videoId, url, title, channelTitle, thumbnailUrl, durationSeconds } = row.entry;
    return [
      {
        youtubeId: videoId,
        url,
        title: title.trim().slice(0, 200),
        durationMinutes: durationSeconds / 60,
        ...(channelTitle.trim() ? { channelName: channelTitle.trim() } : {}),
        thumbnailUrl,
      },
    ];
  });
}

const REASON_LABEL: Record<UnavailableReason, string> = {
  private: 'Gizli video',
  deleted: 'Silinmiş ya da kaldırılmış',
  live: 'Canlı yayın, süresi belli değil',
  upcoming: 'Henüz yayınlanmadı',
  'no-duration': 'YouTube süre bildirmiyor',
};

/** Short label for a row that is skipped or needs attention; null for `ready`. */
export function rowLabel(row: ReviewRow): string | null {
  switch (row.status) {
    case 'ready':
      return null;
    case 'region':
      return 'Türkiye’de engelli olabilir';
    case 'in-list':
      return 'Zaten listede';
    case 'repeat':
      return `Listede tekrar (${(row.firstIndex ?? 0) + 1}. sırada da var)`;
    case 'too-long':
      return '10 saatten uzun';
    case 'unavailable':
      return row.entry.kind === 'unavailable' ? REASON_LABEL[row.entry.reason] : null;
  }
}

const SKIP_GROUPS: { label: string; test: (row: ReviewRow) => boolean }[] = [
  { label: 'zaten listede', test: row => row.status === 'in-list' },
  { label: 'listede tekrar', test: row => row.status === 'repeat' },
  { label: 'gizli', test: row => row.entry.kind === 'unavailable' && row.entry.reason === 'private' },
  { label: 'silinmiş', test: row => row.entry.kind === 'unavailable' && row.entry.reason === 'deleted' },
  {
    label: 'canlı yayın ya da prömiyer',
    test: row => row.entry.kind === 'unavailable' && (row.entry.reason === 'live' || row.entry.reason === 'upcoming'),
  },
  { label: 'süresiz', test: row => row.entry.kind === 'unavailable' && row.entry.reason === 'no-duration' },
  { label: 'çok uzun (10 saatten fazla)', test: row => row.status === 'too-long' },
];

/** "3 video eklenemez: 2 gizli, 1 zaten listede." or null when nothing is skipped. */
export function skippedSummary(rows: ReviewRow[]): string | null {
  const skipped = rows.filter(row => !isSelectable(row));
  if (skipped.length === 0) return null;
  const parts = SKIP_GROUPS.map(group => ({ label: group.label, count: skipped.filter(group.test).length }))
    .filter(part => part.count > 0)
    .map(part => `${part.count} ${part.label}`);
  return `${skipped.length} video eklenemez: ${parts.join(', ')}.`;
}
