import type { DailyPlanItem } from '../types';
import type { DaySummary } from './planView.ts';
import { groupByBranch } from './planView.ts';

// The "Yol" screen: one day's tasks as stops on a winding path. Display only,
// like the day list: the stops keep the day list's order, and which one is
// "next" never changes the plan (any stop can be ticked, in any order).

/**
 * - `done`: ticked.
 * - `next`: today's first task still open, where the path waits.
 * - `open`: not done yet (later today, or on a day still to come).
 * - `missed`: left undone on a past day.
 */
export type StopState = 'done' | 'next' | 'open' | 'missed';

export interface PathStop {
  item: DailyPlanItem;
  state: StopState;
}

/** The day's tasks in the day list's order (camp by camp, then branch by branch). */
export function dayStops(summary: Pick<DaySummary, 'date' | 'plan' | 'camps'>, today: string): PathStop[] {
  const items: DailyPlanItem[] = summary.camps
    ? summary.camps.flatMap(part => groupByBranch(part.items))
    : groupByBranch(summary.plan?.items ?? []);
  let waiting = false;
  return items.map(item => {
    if (item.completed) return { item, state: 'done' };
    if (summary.date < today) return { item, state: 'missed' };
    if (summary.date === today && !waiting) {
      waiting = true;
      return { item, state: 'next' };
    }
    return { item, state: 'open' };
  });
}

/**
 * Whether the path from stop `index` on is walked: the stop is done and so is
 * the next one, or the next one is where the path waits. The last stop's path
 * leads to the finish, reached once every stop is done.
 */
export function isWalked(stops: readonly PathStop[], index: number): boolean {
  if (stops[index]?.state !== 'done') return false;
  const next = stops[index + 1];
  if (next) return next.state === 'done' || next.state === 'next';
  return stops.every(stop => stop.state === 'done');
}

// ---------------------------------------------------------------------------
// Layout

/** Across the path, from -1 (left) to 1 (right): centre, right, centre, left, so even a short day swings both ways. */
const WAVE = [0, 0.85, 0, -0.85];

export function laneOf(index: number): number {
  return WAVE[index % WAVE.length];
}

export type LabelSide = 'left' | 'right';

/**
 * A stop's label sits on its roomier side: left of a stop right of the
 * centre, right of one left of it, and for a centred stop away from the next.
 * The path leaves and enters every stop vertically, so it never runs through
 * a label.
 */
export function labelSideOf(index: number): LabelSide {
  const lane = laneOf(index) || laneOf(index + 1);
  return lane > 0 ? 'left' : 'right';
}

export interface PathPoint {
  x: number;
  y: number;
  side: LabelSide;
}

export interface PathGeometry {
  width: number;
  height: number;
  /** Stop diameter. */
  node: number;
  /** A point per stop, then the finish. */
  points: PathPoint[];
}

/** Below this width the stops and their spacing get smaller. */
const COMPACT_BELOW = 520;
/** Room above the first stop for the "next" bubble. */
const TOP = 64;
/** Room under the finish for its label and shadow. */
const BOTTOM = 48;

export function pathGeometry(stopCount: number, width: number): PathGeometry {
  const compact = width < COMPACT_BELOW;
  const node = compact ? 60 : 72;
  const gap = compact ? 116 : 132;
  const amplitude = Math.min(width * 0.2, 112);
  const points = Array.from({ length: stopCount + 1 }, (_, i) => ({
    x: width / 2 + laneOf(i) * amplitude,
    y: TOP + node / 2 + i * gap,
    side: labelSideOf(i),
  }));
  return { width, height: points[stopCount].y + node / 2 + BOTTOM, node, points };
}

const round = (value: number) => Math.round(value * 10) / 10;

/** An S-bend between two stops that leaves the first and enters the second vertically. */
export function bendPath(from: Pick<PathPoint, 'x' | 'y'>, to: Pick<PathPoint, 'x' | 'y'>): string {
  const mid = (to.y - from.y) / 2;
  return `M ${round(from.x)} ${round(from.y)} C ${round(from.x)} ${round(from.y + mid)} ${round(to.x)} ${round(to.y - mid)} ${round(to.x)} ${round(to.y)}`;
}
