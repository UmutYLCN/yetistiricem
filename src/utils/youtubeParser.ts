// YouTube link and duration parsing.
//
// Nothing here talks to YouTube. Manually added videos are the links and
// durations the user typed; playlist contents come only from the server-side
// YouTube Data API endpoint (see `youtubePlaylist.ts` and `server/`).

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
export const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,64}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
const PATH_ID_PREFIXES = ['shorts', 'embed', 'live', 'v', 'e'];

/** Longest single video accepted, in minutes. */
export const MAX_VIDEO_MINUTES = 600;

function toUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url;
  } catch {
    return null;
  }
}

/** The 11-character video id of a YouTube video link, or null. */
export function parseYoutubeVideoId(input: string): string | null {
  const url = toUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;

  if (SHORT_HOSTS.has(host)) {
    candidate = url.pathname.split('/')[1] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] === 'watch') {
      candidate = url.searchParams.get('v');
    } else if (segments.length >= 2 && PATH_ID_PREFIXES.includes(segments[0])) {
      candidate = segments[1];
    }
  }
  return candidate && VIDEO_ID_RE.test(candidate) ? candidate : null;
}

function isYoutubeHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return YOUTUBE_HOSTS.has(host) || SHORT_HOSTS.has(host);
}

/** The `list=` id of a YouTube playlist link, or null. */
export function parseYoutubePlaylistId(input: string): string | null {
  const url = toUrl(input);
  if (!url || !isYoutubeHost(url)) return null;
  const list = url.searchParams.get('list');
  return list && PLAYLIST_ID_RE.test(list) ? list : null;
}

/** Lists only their owner can see; a public API key cannot read them. */
const PERSONAL_LIST_IDS = new Set(['WL', 'LL', 'LM']);
/** Ids pasted on their own, without a link: regular, album, uploads and favourites lists. */
const BARE_PLAYLIST_ID_RE = /^(?:PL|OL|UU|FL)[A-Za-z0-9_-]{8,62}$/;

/** Why a pasted text cannot be imported as a playlist. */
export type PlaylistLinkProblem = 'empty' | 'not-youtube' | 'video-only' | 'personal' | 'mix' | 'invalid';
export type PlaylistLinkCheck = { ok: true; id: string; url: string } | { ok: false; problem: PlaylistLinkProblem };

function checkPlaylistId(id: string): PlaylistLinkCheck {
  if (PERSONAL_LIST_IDS.has(id)) return { ok: false, problem: 'personal' };
  // Mixes ("RD…") are generated per viewer; the Data API does not return them.
  if (id.startsWith('RD')) return { ok: false, problem: 'mix' };
  if (!PLAYLIST_ID_RE.test(id)) return { ok: false, problem: 'invalid' };
  return { ok: true, id, url: youtubePlaylistUrl(id) };
}

/** True for an id the playlist endpoint may send to YouTube. */
export function isFetchablePlaylistId(id: string): boolean {
  return checkPlaylistId(id).ok;
}

/**
 * Reads a pasted playlist link (…/playlist?list=…, watch?v=…&list=…,
 * youtu.be/…?list=…) or a bare `PL…` id, and says why it cannot be used
 * when it cannot.
 */
export function inspectPlaylistLink(input: string): PlaylistLinkCheck {
  const text = input.trim();
  if (!text) return { ok: false, problem: 'empty' };
  if (BARE_PLAYLIST_ID_RE.test(text) || PERSONAL_LIST_IDS.has(text)) return checkPlaylistId(text);
  const url = toUrl(text);
  if (!url || !isYoutubeHost(url)) return { ok: false, problem: 'not-youtube' };
  const list = url.searchParams.get('list');
  if (!list) return { ok: false, problem: parseYoutubeVideoId(text) ? 'video-only' : 'invalid' };
  return checkPlaylistId(list);
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubePlaylistUrl(listId: string): string {
  return `https://www.youtube.com/playlist?list=${listId}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/** True when a stored video link opens a real YouTube video. */
export function isWatchableVideoUrl(url: string | undefined): boolean {
  return typeof url === 'string' && parseYoutubeVideoId(url) !== null;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateVideoUrl(input: string): ParseResult<{ id: string; url: string }> {
  if (!input.trim()) return { ok: false, error: 'YouTube video bağlantısını yapıştır.' };
  const id = parseYoutubeVideoId(input);
  if (!id) {
    if (parseYoutubePlaylistId(input)) {
      return { ok: false, error: 'Bu bir oynatma listesi bağlantısı. Videolarını “Oynatma listesi” sekmesinden içe aktarabilirsin.' };
    }
    return { ok: false, error: 'Geçerli bir YouTube video bağlantısı değil. Örnek: https://www.youtube.com/watch?v=…' };
  }
  return { ok: true, value: { id, url: youtubeWatchUrl(id) } };
}

export function validatePlaylistUrl(input: string): ParseResult<{ id: string; url: string }> {
  const id = parseYoutubePlaylistId(input);
  if (!id) return { ok: false, error: 'Geçerli bir YouTube oynatma listesi bağlantısı değil (…/playlist?list=…).' };
  return { ok: true, value: { id, url: youtubePlaylistUrl(id) } };
}

const UNIT_MINUTES: Record<string, number> = {
  sa: 60,
  saat: 60,
  h: 60,
  dk: 1,
  dak: 1,
  dakika: 1,
  m: 1,
  min: 1,
  sn: 1 / 60,
  saniye: 1 / 60,
  s: 1 / 60,
  sec: 1 / 60,
};

function parseMinutesValue(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return null;

  // 12:34 (mm:ss) or 1:05:30 (h:mm:ss)
  const clock = /^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/.exec(text);
  if (clock) {
    const [a, b, c] = [Number(clock[1]), Number(clock[2]), clock[3] === undefined ? null : Number(clock[3])];
    return c === null ? a + b / 60 : a * 60 + b + c / 60;
  }

  // Plain number: minutes. Accepts a decimal comma.
  const plain = /^(\d+(?:[.,]\d+)?)$/.exec(text);
  if (plain) return Number(plain[1].replace(',', '.'));

  // Unit groups: "1 sa 20 dk", "1h20m", "45 dakika", "90 sn"
  const groupRe = /(\d+(?:[.,]\d+)?)\s*(saat|sa|h|dakika|dak|dk|min|m|saniye|sn|sec|s)\.?(?=\d|$)/y;
  let total = 0;
  let consumed = 0;
  let match: RegExpExecArray | null;
  let groups = 0;
  const compact = text.replace(/\s+/g, '');
  groupRe.lastIndex = 0;
  while ((match = groupRe.exec(compact)) !== null) {
    total += Number(match[1].replace(',', '.')) * UNIT_MINUTES[match[2]];
    consumed = groupRe.lastIndex;
    groups++;
  }
  if (groups > 0 && consumed === compact.length) return total;
  return null;
}

/** Parses "45", "45 dk", "12:34", "1:05:00", "1 sa 20 dk" into minutes. */
export function parseDurationInput(input: string): ParseResult<number> {
  if (!input.trim()) return { ok: false, error: 'Süreyi yaz. Örnek: 45, 12:34 veya 1 sa 5 dk.' };
  const minutes = parseMinutesValue(input);
  if (minutes === null || !Number.isFinite(minutes)) {
    return { ok: false, error: 'Süre okunamadı. Örnek: 45, 45 dk, 12:34 veya 1:05:00.' };
  }
  if (minutes <= 0) return { ok: false, error: 'Süre sıfırdan büyük olmalı.' };
  if (minutes > MAX_VIDEO_MINUTES) return { ok: false, error: 'Tek bir video en fazla 10 saat olabilir.' };
  return { ok: true, value: Math.round(minutes * 100) / 100 };
}

export interface DraftVideo {
  youtubeId: string;
  url: string;
  /** Empty when the user gave no title; the camp numbers it on save. */
  title: string;
  durationMinutes: number;
  /** Set for playlist imports: the video's channel as YouTube reports it. */
  channelName?: string;
  /** Set for playlist imports: the thumbnail YouTube returned. */
  thumbnailUrl?: string;
}

export type BulkLine =
  | { line: number; raw: string; ok: true; video: DraftVideo }
  | { line: number; raw: string; ok: false; error: string };

const SEPARATOR_RE = /\s*[|\t;]\s*/;
const URL_TOKEN_RE = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\/\S+/i;

function parseBulkLine(raw: string): { ok: true; video: DraftVideo } | { ok: false; error: string } {
  let urlText: string | null = null;
  let durationText: string | null = null;
  let titleParts: string[] = [];

  if (SEPARATOR_RE.test(raw)) {
    const fields = raw.split(SEPARATOR_RE).map(f => f.trim()).filter(Boolean);
    const urlIndex = fields.findIndex(f => URL_TOKEN_RE.test(f) && !/\s/.test(f));
    if (urlIndex >= 0) urlText = fields[urlIndex];
    const rest = fields.filter((_, i) => i !== urlIndex);
    let durationIndex = -1;
    for (let i = rest.length - 1; i >= 0; i--) {
      if (parseMinutesValue(rest[i]) !== null) {
        durationIndex = i;
        break;
      }
    }
    if (durationIndex >= 0) durationText = rest[durationIndex];
    titleParts = rest.filter((_, i) => i !== durationIndex);
  } else {
    const match = URL_TOKEN_RE.exec(raw);
    if (match) urlText = match[0];
    const rest = (match ? raw.replace(match[0], ' ') : raw).trim().split(/\s+/).filter(Boolean);
    // The longest trailing run of words that reads as a duration ("1 sa 20 dk").
    let cut = rest.length;
    for (let n = Math.min(4, rest.length); n >= 1; n--) {
      if (parseMinutesValue(rest.slice(rest.length - n).join(' ')) !== null) {
        cut = rest.length - n;
        durationText = rest.slice(cut).join(' ');
        break;
      }
    }
    titleParts = rest.slice(0, cut);
  }

  if (!urlText) return { ok: false, error: 'YouTube video bağlantısı bulunamadı.' };
  const url = validateVideoUrl(urlText);
  if (!url.ok) return url;
  if (!durationText) return { ok: false, error: 'Süre eksik. Satırın sonuna dakika yaz (ör. 45 veya 12:34).' };
  const duration = parseDurationInput(durationText);
  if (!duration.ok) return duration;

  return {
    ok: true,
    video: {
      youtubeId: url.value.id,
      url: url.value.url,
      title: titleParts.join(' ').trim().slice(0, 200),
      durationMinutes: duration.value,
    },
  };
}

/**
 * One video per line: `bağlantı | başlık | süre`. The title may be left out;
 * `|`, `;` or a tab separate fields, and plain spaces work when the duration
 * ends the line. Empty lines and lines starting with `#` are skipped.
 * `knownIds` marks videos that are already in the list.
 */
export function parseBulkVideos(text: string, knownIds: Iterable<string> = []): BulkLine[] {
  const seen = new Set(knownIds);
  const result: BulkLine[] = [];
  text.split(/\r?\n/).forEach((rawLine, index) => {
    const raw = rawLine.trim();
    if (!raw || raw.startsWith('#')) return;
    const parsed = parseBulkLine(raw);
    if (!parsed.ok) {
      result.push({ line: index + 1, raw, ok: false, error: parsed.error });
      return;
    }
    if (seen.has(parsed.video.youtubeId)) {
      result.push({ line: index + 1, raw, ok: false, error: 'Bu video listede zaten var.' });
      return;
    }
    seen.add(parsed.video.youtubeId);
    result.push({ line: index + 1, raw, ok: true, video: parsed.video });
  });
  return result;
}
