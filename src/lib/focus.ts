import type { DailyPlanItem } from '../types';
import { parseYoutubeVideoId } from '../utils/youtubeParser.ts';
import type { CampKind } from './camps.ts';
import { linkStateOf } from './camps.ts';
import { isDateKey } from './engine.ts';
import type { ScheduledItem } from './planView.ts';

// Focus mode: a task's video played inside the app, without YouTube's feed
// around it. Each time the player closes, what happened is kept as one
// session (`yt_focus_sessions`): real time spent playing, pauses and speed.

export interface FocusSession {
  /** The task's `Video.id` (the key of `yt_completed`), not the YouTube id. */
  videoId: string;
  /** Local day of the session. */
  date: string;
  /** Wall-clock seconds the video was playing. */
  watchedSeconds: number;
  /** Times playback was paused. */
  pauses: number;
  /** Playback rate when the session ended. */
  rate: number;
  /** The video played to its end. */
  ended: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null);

/** Stored sessions; entries that are not sessions are left out. */
export function normalizeFocusSessions(raw: unknown): FocusSession[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): FocusSession[] => {
    if (!isRecord(entry) || typeof entry.videoId !== 'string' || !entry.videoId || !isDateKey(entry.date)) return [];
    const watchedSeconds = count(entry.watchedSeconds);
    const pauses = count(entry.pauses);
    if (watchedSeconds === null || pauses === null) return [];
    const rate = typeof entry.rate === 'number' && entry.rate > 0 && entry.rate <= 4 ? entry.rate : 1;
    return [{ videoId: entry.videoId, date: entry.date, watchedSeconds, pauses, rate, ended: entry.ended === true }];
  });
}

/** Everything spent on one video in focus mode. */
export function focusTotals(sessions: readonly FocusSession[], videoId: string): { seconds: number; sessions: number } {
  let seconds = 0;
  let n = 0;
  for (const session of sessions) {
    if (session.videoId !== videoId) continue;
    seconds += session.watchedSeconds;
    n++;
  }
  return { seconds, sessions: n };
}

/** The YouTube video id a task can be played with in focus mode, or null (topics, playlist-only and sample links). */
export function focusableVideoId(item: Pick<DailyPlanItem, 'videoUrl'>, kind: CampKind): string | null {
  return linkStateOf(item.videoUrl, kind) === 'video' ? parseYoutubeVideoId(item.videoUrl) : null;
}

/**
 * "Sıradaki göreve geç": the next open task of the same day that can play in
 * focus mode, after the current one in the day's order (then the earlier
 * ones). Other days are left alone, so the plan is followed, not pulled ahead.
 */
export function nextFocusItem<I extends DailyPlanItem>(
  items: readonly ScheduledItem<I>[],
  current: { id: string; date: string },
  canFocus: (item: I) => boolean
): ScheduledItem<I> | null {
  const day = items.filter(s => s.date === current.date);
  const at = day.findIndex(s => s.item.id === current.id);
  const ordered = at < 0 ? day : [...day.slice(at + 1), ...day.slice(0, at)];
  return ordered.find(s => s.item.id !== current.id && !s.item.completed && canFocus(s.item)) ?? null;
}
