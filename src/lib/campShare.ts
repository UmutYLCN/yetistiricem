import type { CampOrigin, CampSchedule, StudyCamp } from '../types';
import type { DraftVideo } from '../utils/youtubeParser.ts';
import {
  MAX_VIDEO_MINUTES,
  inspectPlaylistLink,
  isFetchablePlaylistId,
  isYoutubeVideoId,
  parseYoutubeVideoId,
  youtubePlaylistUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from '../utils/youtubeParser.ts';
import { classifyCamp, createBranch } from './camps.ts';
import { inspectPreferences } from './engine.ts';
import { MAX_CAMP_NAME, createStudyCamp, normalizeCampSchedule } from './studyCamp.ts';
import { PALETTE } from './subjects.ts';

// Camp share links (`/app?import=<payload>`): a camp's name, tempo, branches
// and videos, without ids, progress, notes or shifts. The payload is
// `z.` + base64url(deflate-raw(JSON)); `j.` + base64url(JSON) is also read,
// so other tools (a community catalog, an MCP server) can build links
// without compressing. Links are untrusted input: every field is checked,
// only YouTube ids are kept (links are rebuilt from them), sizes are capped,
// and a link with any broken part is refused rather than imported in part.
// Format: docs/camp-share-link.md.

export const SHARE_APP = 'yetistiricem';
export const SHARE_TYPE = 'camp';
export const SHARE_VERSION = 1;

/** Longest payload read (characters); browsers keep far longer URLs, chat apps may not. */
export const MAX_PAYLOAD_LENGTH = 400_000;
/** Largest JSON read after decompression, so a tiny link cannot expand without bound. */
export const MAX_JSON_BYTES = 2_000_000;
export const MAX_SHARED_BRANCHES = 40;
export const MAX_SHARED_VIDEOS = 5000;

export interface SharedVideo {
  title: string;
  minutes: number;
  youtubeId?: string;
  channel?: string;
}

export interface SharedBranch {
  subject: string;
  /** The source list's name. */
  title: string;
  channel: string;
  playlistId?: string;
  /** A palette key (`src/lib/subjects.ts`). */
  color?: string;
  videos: SharedVideo[];
}

export interface SharedSchedule {
  dailyStudyHours: number;
  playbackSpeed: number;
  practiceMultiplier: number;
  maxSubjectsPerDay: number;
  activeDays: number[];
  restDays: number[];
  mockExamDays: number[];
  mode: 'auto' | 'manual';
  /** Manual mode: branch indexes per weekday (0 = Sunday). */
  weekPlan?: number[][];
}

export interface SharedCamp {
  name: string;
  schedule: SharedSchedule;
  branches: SharedBranch[];
}

// ---------------------------------------------------------------------------
// Camp -> link

/** What a camp shares. Sample and legacy branches are left out (`leftOut`): their data is not the student's own. */
export function toSharedCamp(camp: StudyCamp): { shared: SharedCamp; leftOut: number } {
  const own = camp.branches.filter(b => classifyCamp(b) === 'manual' && b.videos.length > 0);
  const index = new Map(own.map((b, i) => [b.id, i]));
  const { schedule } = camp;
  const shared: SharedCamp = {
    name: camp.name,
    schedule: {
      dailyStudyHours: schedule.dailyStudyHours,
      playbackSpeed: schedule.playbackSpeed,
      practiceMultiplier: schedule.practiceMultiplier,
      maxSubjectsPerDay: schedule.maxSubjectsPerDay,
      activeDays: schedule.activeDays,
      restDays: schedule.restDays,
      mockExamDays: schedule.mockExamDays,
      mode: schedule.mode,
      ...(schedule.mode === 'manual'
        ? { weekPlan: schedule.weekPlan.map(day => day.flatMap(id => (index.has(id) ? [index.get(id)!] : []))) }
        : {}),
    },
    branches: own.map(branch => {
      const playlist = branch.playlistUrl ? inspectPlaylistLink(branch.playlistUrl) : null;
      return {
        subject: branch.subject,
        title: branch.title,
        channel: branch.channelName,
        ...(playlist?.ok ? { playlistId: playlist.id } : {}),
        color: branch.colorTag,
        videos: branch.videos.map(video => {
          const youtubeId = parseYoutubeVideoId(video.videoUrl ?? '');
          return {
            title: video.title,
            minutes: Math.round(video.durationMinutes * 100) / 100,
            ...(youtubeId ? { youtubeId } : {}),
            ...(video.channelName ? { channel: video.channelName } : {}),
          };
        }),
      };
    }),
  };
  return { shared, leftOut: camp.branches.length - own.length };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function readAll(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

const bytesStream = (bytes: Uint8Array) => new Blob([new Uint8Array(bytes)]).stream();

/** The share payload of a camp (`z.` + base64url of the deflated JSON). */
export async function encodeCampShare(shared: SharedCamp): Promise<string> {
  const json = JSON.stringify(shareDocument(shared));
  const deflated = await readAll(bytesStream(new TextEncoder().encode(json)).pipeThrough(new CompressionStream('deflate-raw')), Infinity);
  return `z.${toBase64Url(deflated ?? new Uint8Array())}`;
}

// ---------------------------------------------------------------------------
// Link -> camp

export type ShareDecode = { ok: true; camp: SharedCamp } | { ok: false; error: string };

const UNREADABLE = 'Bu bağlantıdaki kamp okunamadı. Bağlantı eksik kopyalanmış ya da bozulmuş olabilir; paylaşan kişiden yenisini iste.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string | null => (typeof value === 'string' ? value.trim().slice(0, max) : null);
const PALETTE_KEYS = new Set(PALETTE.map(c => c.key));

function readVideo(raw: unknown): SharedVideo | null {
  if (!isRecord(raw)) return null;
  const title = text(raw.title ?? '', 200);
  const minutes = raw.minutes;
  if (title === null || typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_VIDEO_MINUTES) return null;
  if (raw.youtubeId !== undefined && (typeof raw.youtubeId !== 'string' || !isYoutubeVideoId(raw.youtubeId))) return null;
  const channel = text(raw.channel ?? '', 120);
  return {
    title,
    minutes,
    ...(typeof raw.youtubeId === 'string' ? { youtubeId: raw.youtubeId } : {}),
    ...(channel ? { channel } : {}),
  };
}

function readBranch(raw: unknown): SharedBranch | null {
  if (!isRecord(raw) || !Array.isArray(raw.videos) || raw.videos.length === 0) return null;
  const subject = text(raw.subject, 60);
  const title = text(raw.title ?? '', 200);
  const channel = text(raw.channel ?? '', 120);
  if (!subject || title === null || channel === null) return null;
  if (raw.playlistId !== undefined && (typeof raw.playlistId !== 'string' || !isFetchablePlaylistId(raw.playlistId))) return null;
  const videos: SharedVideo[] = [];
  for (const item of raw.videos) {
    const video = readVideo(item);
    if (!video) return null;
    videos.push(video);
  }
  return {
    subject,
    title,
    channel,
    ...(typeof raw.playlistId === 'string' ? { playlistId: raw.playlistId } : {}),
    ...(typeof raw.color === 'string' && PALETTE_KEYS.has(raw.color) ? { color: raw.color } : {}),
    videos,
  };
}

function readSchedule(raw: unknown, branchCount: number): SharedSchedule {
  const input = isRecord(raw) ? raw : {};
  // Unusable planner values fall back to the defaults, as stored settings do.
  const { preferences } = inspectPreferences({ ...input, startDate: '2000-01-01' });
  const mode = input.mode === 'manual' ? 'manual' : 'auto';
  const weekPlan =
    mode === 'manual' && Array.isArray(input.weekPlan)
      ? Array.from({ length: 7 }, (_, dow) => {
          const day = (input.weekPlan as unknown[])[dow];
          if (!Array.isArray(day)) return [];
          return [...new Set(day.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < branchCount))];
        })
      : undefined;
  return {
    dailyStudyHours: preferences.dailyStudyHours,
    playbackSpeed: preferences.playbackSpeed,
    practiceMultiplier: preferences.practiceMultiplier,
    maxSubjectsPerDay: preferences.maxSubjectsPerDay,
    activeDays: preferences.activeDays,
    restDays: preferences.restDays,
    mockExamDays: preferences.mockExamDays,
    mode,
    ...(weekPlan ? { weekPlan } : {}),
  };
}

/** Validates a decoded share. Null when any part is broken. */
export function readSharedCamp(raw: unknown): SharedCamp | null {
  if (!isRecord(raw) || !Array.isArray(raw.branches)) return null;
  if (raw.branches.length === 0 || raw.branches.length > MAX_SHARED_BRANCHES) return null;
  const branches: SharedBranch[] = [];
  for (const item of raw.branches) {
    const branch = readBranch(item);
    if (!branch) return null;
    branches.push(branch);
  }
  if (branches.reduce((acc, b) => acc + b.videos.length, 0) > MAX_SHARED_VIDEOS) return null;
  return { name: text(raw.name, MAX_CAMP_NAME) || 'Paylaşılan kamp', schedule: readSchedule(raw.schedule, branches.length), branches };
}

/** Reads a share payload (`z.…` or `j.…`). Never throws. */
export async function decodeCampShare(payload: string): Promise<ShareDecode> {
  const value = payload.trim();
  if (value.length > MAX_PAYLOAD_LENGTH) return { ok: false, error: 'Bu bağlantı çok büyük; güvenlik için açılmadı.' };
  const [kind, data] = [value.slice(0, 2), value.slice(2)];
  const bytes = fromBase64Url(data);
  if (!bytes || (kind !== 'z.' && kind !== 'j.')) return { ok: false, error: UNREADABLE };
  let json: Uint8Array | null = bytes;
  if (kind === 'z.') {
    try {
      json = await readAll(bytesStream(bytes).pipeThrough(new DecompressionStream('deflate-raw')), MAX_JSON_BYTES);
    } catch {
      return { ok: false, error: UNREADABLE };
    }
    if (!json) return { ok: false, error: 'Bu bağlantının içeriği çok büyük; güvenlik için açılmadı.' };
  } else if (bytes.byteLength > MAX_JSON_BYTES) {
    return { ok: false, error: 'Bu bağlantının içeriği çok büyük; güvenlik için açılmadı.' };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json));
  } catch {
    return { ok: false, error: UNREADABLE };
  }
  return readShareDocument(raw);
}

/** The share document (`{ app, type, version, camp }`), from a link or from the Keşfet catalog. */
export function shareDocument(shared: SharedCamp) {
  return { app: SHARE_APP, type: SHARE_TYPE, version: SHARE_VERSION, camp: shared };
}

/** Checks a parsed share document; any broken part refuses it. */
export function readShareDocument(raw: unknown): ShareDecode {
  if (!isRecord(raw) || raw.app !== SHARE_APP || raw.type !== SHARE_TYPE) {
    return { ok: false, error: 'Bu bağlantı bir Yetiştiricem kampı içermiyor.' };
  }
  if (typeof raw.version !== 'number' || raw.version > SHARE_VERSION) {
    return { ok: false, error: 'Bu kamp daha yeni bir sürümle paylaşılmış; bu sürüm açamıyor.' };
  }
  const camp = readSharedCamp(raw.camp);
  return camp ? { ok: true, camp } : { ok: false, error: `${UNREADABLE} Eksik veriyle içe aktarmak yerine işlem durduruldu.` };
}

/** Branch, video and study-time totals for the import preview. */
export function shareSummary(shared: SharedCamp): { branches: number; videos: number; minutes: number } {
  const videos = shared.branches.flatMap(b => b.videos);
  return { branches: shared.branches.length, videos: videos.length, minutes: videos.reduce((acc, v) => acc + v.minutes, 0) };
}

/**
 * A new camp from a share: fresh ids, starting `today`, no progress. `origin`
 * marks it as someone else's work (it cannot be published again); a preview
 * that is never saved leaves it out.
 */
export function campFromShare(shared: SharedCamp, today: string, origin?: Extract<CampOrigin, 'kesfet' | 'link'>): StudyCamp {
  const branches = shared.branches.map(b =>
    createBranch({
      title: b.title,
      subject: b.subject,
      colorTag: b.color,
      channelName: b.channel,
      playlistUrl: b.playlistId ? youtubePlaylistUrl(b.playlistId) : '',
      videos: b.videos.map(
        (v): DraftVideo => ({
          youtubeId: v.youtubeId ?? '',
          url: v.youtubeId ? youtubeWatchUrl(v.youtubeId) : '',
          title: v.title,
          durationMinutes: v.minutes,
          ...(v.channel ? { channelName: v.channel } : {}),
          ...(v.youtubeId ? { thumbnailUrl: youtubeThumbnailUrl(v.youtubeId) } : {}),
        })
      ),
    })
  );
  const { weekPlan, ...tempo } = shared.schedule;
  const ids = branches.map(b => b.id);
  const raw: Partial<CampSchedule> = {
    ...tempo,
    startDate: today,
    targetEndDate: null,
    weekPlan: (weekPlan ?? []).map(day => day.map(i => ids[i]).filter(Boolean)),
  };
  const camp = createStudyCamp({ name: shared.name, branches, schedule: normalizeCampSchedule(raw, ids).schedule }, today);
  return origin ? { ...camp, origin } : camp;
}

/** Whether a camp came from someone else (Keşfet or a share link), so it cannot be published as one's own. */
export function isImportedCamp(camp: Pick<StudyCamp, 'origin'>): boolean {
  return camp.origin === 'kesfet' || camp.origin === 'link';
}
