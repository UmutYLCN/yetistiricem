import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, Ref } from 'react';
import { Check, NotebookPen, Play, Trophy } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import type { PathPoint, PathStop, StopState } from '../../lib/dayPath';
import { bendPath, isWalked, pathGeometry } from '../../lib/dayPath';
import { formatMinutes } from '../../lib/format';

/** How a stop is labelled: its branch colour, "Branch" (or "Camp · Branch") and whether it has a video to play. */
export interface StopLook {
  color: string;
  tag: string;
  playable: boolean;
}

interface Props {
  stops: PathStop[];
  look: (item: DailyPlanItem) => StopLook;
  /** The bubble over the next stop only shows on today's path. */
  isToday: boolean;
  minutes: number;
  doneMinutes: number;
  onOpen: (item: DailyPlanItem) => void;
}

const STATE_TEXT: Record<StopState, string> = {
  done: ', tamamlandı',
  next: ', sıradaki',
  open: '',
  missed: ', yetişmedi',
};

const vars = (values: Record<string, string | number>) => values as CSSProperties;

/** The path's width, measured before paint and kept up to date. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Left or right anchoring of a stop, so its label can take the room up to the path's edge. */
function placeOf(point: PathPoint, node: number, width: number): CSSProperties {
  const radius = node / 2;
  const top = point.y - radius;
  return point.side === 'right'
    ? { top, left: point.x - radius, maxWidth: width - (point.x - radius) }
    : { top, right: width - (point.x + radius), maxWidth: point.x + radius };
}

function StopButton({
  stop,
  index,
  point,
  node,
  width,
  look,
  isToday,
  staggered,
  onOpen,
  buttonRef,
}: {
  stop: PathStop;
  index: number;
  point: PathPoint;
  node: number;
  width: number;
  look: StopLook;
  isToday: boolean;
  staggered: boolean;
  onOpen: (item: DailyPlanItem) => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const { item, state } = stop;
  const Icon = state === 'done' ? Check : look.playable ? Play : NotebookPen;
  return (
    <li className="absolute" style={placeOf(point, node, width)}>
      <button
        ref={buttonRef}
        type="button"
        className="path-row path-stop"
        data-side={point.side}
        style={vars({ '--node': `${node}px`, '--branch': look.color, '--i': staggered ? index : 0 })}
        onClick={() => onOpen(item)}
        aria-haspopup="dialog"
      >
        <span className="path-island" data-state={state}>
          <span className="path-glow" aria-hidden="true" />
          {/* Keyed by state: a stop that changes state pops. */}
          <span key={state} className="path-node" aria-hidden="true">
            <Icon strokeWidth={state === 'done' ? 3.25 : 2.25} fill={state === 'next' && look.playable ? 'currentColor' : 'none'} />
          </span>
          {state === 'next' && isToday && (
            <span className="path-bubble" aria-hidden="true">
              Sıradaki
            </span>
          )}
        </span>
        <span className="path-label">
          <span className="visually-hidden">
            {index + 1}. görev{STATE_TEXT[state]}:{' '}
          </span>
          <span className="flex max-w-full min-w-0 items-center gap-1.5 text-[12px] font-semibold">
            <span className="min-w-0 truncate" style={{ color: look.color }}>
              {look.tag}
            </span>
            <span className={`shrink-0 ${state === 'missed' ? 'text-danger' : 'text-ink-3'}`}>
              · {state === 'missed' ? 'yetişmedi' : formatMinutes(item.durationMinutes)}
            </span>
          </span>
          <span className={`path-label-title ${state === 'done' ? 'text-ink-2' : ''}`}>{item.title}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * The day's tasks as stops on a winding path: walked up to the stop where it
 * waits, then dotted on to the finish. Every stop opens its task.
 */
export function DayPath({ stops, look, isToday, minutes, doneMinutes, onOpen }: Props) {
  const { ref, width } = useWidth();
  const nextRef = useRef<HTMLButtonElement>(null);
  const scrolled = useRef(false);
  // The first render staggers the stops in; later changes animate at once.
  const [staggered, setStaggered] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setStaggered(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  // Opening on a long day: bring the stop where the path waits into view.
  useEffect(() => {
    if (scrolled.current || width === 0) return;
    scrolled.current = true;
    const stop = nextRef.current;
    if (!stop) return;
    const { top, bottom } = stop.getBoundingClientRect();
    if (top >= 0 && bottom <= window.innerHeight - 96) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    stop.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [width]);

  const geometry = width > 0 ? pathGeometry(stops.length, width) : null;
  const doneCount = stops.filter(s => s.state === 'done').length;
  const reached = stops.length > 0 && doneCount === stops.length;
  const finish = geometry?.points[stops.length];

  return (
    <div ref={ref} className="day-path" style={{ height: geometry?.height ?? 320 }}>
      {geometry && finish && (
        <>
          <svg className="absolute inset-0" width={geometry.width} height={geometry.height} aria-hidden="true">
            {geometry.points.slice(1).map((to, i) => (
              <path key={`trail-${i}`} className="path-trail" d={bendPath(geometry.points[i], to)} />
            ))}
            {geometry.points.slice(1).map((to, i) =>
              isWalked(stops, i) ? (
                <path
                  key={`walked-${stops[i].item.id}`}
                  className="path-walked"
                  pathLength={1}
                  d={bendPath(geometry.points[i], to)}
                  style={vars({ '--i': staggered ? i : 0 })}
                />
              ) : null
            )}
          </svg>

          <ol aria-label={`Günün yolu: ${stops.length} görev, ${doneCount} tamamlandı`}>
            {stops.map((stop, i) => (
              <StopButton
                key={stop.item.id}
                stop={stop}
                index={i}
                point={geometry.points[i]}
                node={geometry.node}
                width={geometry.width}
                look={look(stop.item)}
                isToday={isToday}
                staggered={staggered}
                onOpen={onOpen}
                buttonRef={stop.state === 'next' ? nextRef : undefined}
              />
            ))}
          </ol>

          <div className="absolute" style={placeOf(finish, geometry.node, geometry.width)}>
            <div
              className="path-row"
              data-side={finish.side}
              style={vars({ '--node': `${geometry.node}px`, '--i': staggered ? stops.length : 0 })}
            >
              <span className="path-island" data-state={reached ? 'finish' : 'locked'} aria-hidden="true">
                <span className="path-glow" />
                <span key={reached ? 'reached' : 'locked'} className="path-node">
                  <Trophy strokeWidth={2.25} />
                </span>
              </span>
              <span className="path-label">
                <span className="tnum text-[12px] font-semibold text-ink-3">
                  {reached
                    ? `${stops.length} görev · ${formatMinutes(minutes)}`
                    : `${stops.length - doneCount} görev · ~${formatMinutes(minutes - doneMinutes)} kaldı`}
                </span>
                <span className={`path-label-title ${reached ? 'text-warn' : 'text-ink-2'}`}>{reached ? 'Gün tamam!' : 'Günün sonu'}</span>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
