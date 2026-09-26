import type { ReactNode } from 'react';
import { Check, Flag, Link2, Moon, Play, Plus, Timer } from 'lucide-react';
import { SHORT_WEEKDAYS, WEEK_ORDER } from '../../lib/format';
import { resolveColor } from '../../lib/subjects';

// Illustrations for the empty states: faint sketches of the screen a camp
// will fill, drawn from the design tokens. They show no data and are hidden
// from assistive technology; the text beside them says what to do.

const INK = resolveColor('ink', '').solid;
const PLUM = resolveColor('plum', '').solid;
const CLAY = resolveColor('clay', '').solid;
const WEEKDAYS = WEEK_ORDER.map(day => SHORT_WEEKDAYS[day]);

function Stage({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={`empty-art relative mx-auto w-full ${className}`} aria-hidden="true">
      {children}
    </div>
  );
}

/** A floating sheet of UI. */
function Sheet({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`absolute rounded-[14px] border border-line-strong bg-card shadow-[var(--shadow-pop)] ${className}`}>{children}</div>;
}

/** A line of text, sketched. */
function Bar({ width, className = '' }: { width: number; className?: string }) {
  return <span className={`block h-1.5 min-w-0 rounded-full bg-line-strong ${className}`} style={{ width: `${width}%` }} />;
}

function PlusBadge({ className }: { className: string }) {
  return (
    <span
      className={`absolute grid size-9 place-items-center rounded-[11px] bg-forest text-on-fill shadow-[0_0_28px_-4px_var(--color-forest)] ${className}`}
    >
      <Plus className="size-4" strokeWidth={2.75} />
    </span>
  );
}

/** First run: a playlist turning into today's plan. */
export function WelcomeArt() {
  return (
    <Stage className="h-[300px] max-w-[460px] sm:h-[320px]">
      {/* The source: a playlist, tilted behind. */}
      <Sheet className="top-[3%] left-0 w-[50%] -rotate-[4deg] p-3.5 opacity-85">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-[7px] bg-sunk text-ink-2">
            <Play className="size-3" />
          </span>
          <Bar width={50} className="bg-ink-3/60" />
        </div>
        <ul className="mt-3.5 space-y-3">
          {[64, 50, 58, 42].map((width, i) => (
            <li key={i} className="flex items-center gap-2">
              <Bar width={width} />
              <span className="ml-auto h-1.5 w-5 rounded-full bg-sunk" />
            </li>
          ))}
        </ul>
      </Sheet>

      {/* The planner turns it into days. */}
      <svg className="absolute top-[52%] left-[8%] w-[27%] text-forest" viewBox="0 0 96 60" fill="none">
        <path d="M6 4C6 34 28 50 84 50" stroke="currentColor" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
        <path d="M77 43l8 7-8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* The result: today's plan, in front. */}
      <Sheet className="top-[27%] right-0 w-[62%] p-4">
        <span className="absolute inset-x-8 -top-px h-px bg-linear-to-r from-transparent via-forest/70 to-transparent" />
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-semibold tracking-[0.08em] text-accent">BUGÜN</span>
          <span className="tnum text-[11px] font-semibold text-ink-3">1/3</span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day, i) => (
            <span key={day} className={`h-6 rounded-[6px] ${i === 3 ? 'bg-ink' : 'bg-sunk'}`} />
          ))}
        </div>
        <ul className="mt-4 space-y-3">
          {[
            { color: PLUM, width: 56 },
            { color: CLAY, width: 68 },
            { color: INK, width: 46 },
          ].map((task, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span
                className={`grid size-4 shrink-0 place-items-center rounded-[5px] ${i === 0 ? 'bg-forest text-on-fill' : 'border-[1.5px] border-control'}`}
              >
                {i === 0 && <Check className="size-3" strokeWidth={3.5} />}
              </span>
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: task.color }} />
              <Bar width={task.width} className={i === 0 ? 'opacity-50' : ''} />
              <span className="ml-auto h-1.5 w-6 shrink-0 rounded-full bg-sunk" />
            </li>
          ))}
        </ul>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sunk">
          <span className="block h-full w-1/3 rounded-full bg-forest" />
        </div>
      </Sheet>

      {/* What the planner weighs in. */}
      <span className="chip absolute top-[22%] right-[5%] border border-line-strong bg-card shadow-[var(--shadow-card)]">
        <Timer />3 sa / gün
      </span>
      <span className="chip chip-forest absolute bottom-[1%] left-[46%] shadow-[var(--shadow-card)]">
        <Flag />
        Tahmini bitiş
      </span>
    </Stage>
  );
}

// Which columns of the sketched week carry tasks (Sunday rests).
const WEEK_LOAD = [3, 2, 3, 2, 3, 2, 0];

/** Haftalık: a week of columns, one of them today's. */
export function WeekArt() {
  return (
    <Stage className="h-[200px] max-w-[400px]">
      <Sheet className="inset-x-[3%] top-[6%] p-3.5">
        <div className="flex items-center justify-between">
          <Bar width={28} />
          <span className="flex gap-1.5">
            <span className="size-2 rounded-full bg-line-strong" />
            <span className="size-2 rounded-full bg-line-strong" />
          </span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((day, i) => {
            const today = i === 2;
            return (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-[104px] w-full flex-col justify-end gap-1 rounded-[8px] border p-1 ${
                    today ? 'border-accent/50 bg-accent-soft/50' : 'border-line bg-field'
                  }`}
                >
                  {WEEK_LOAD[i] === 0 ? (
                    <Moon className="m-auto size-3.5 text-ink-3" />
                  ) : (
                    Array.from({ length: WEEK_LOAD[i] }, (_, j) => (
                      <span
                        key={j}
                        className={`block h-3.5 rounded-[3px] ${today ? '' : 'bg-line-strong'}`}
                        style={today ? { background: [PLUM, CLAY, INK][j] } : undefined}
                      />
                    ))
                  )}
                </div>
                <span className={`text-[10px] font-semibold ${today ? 'text-accent' : 'text-ink-3'}`}>{day}</span>
              </div>
            );
          })}
        </div>
      </Sheet>
    </Stage>
  );
}

// Bar heights of the sketched week chart, in percent.
const CHART = [34, 62, 48, 78, 40, 56, 16];

/** İlerleme: a progress ring beside a week chart. */
export function ProgressArt() {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  return (
    <Stage className="h-[200px] max-w-[400px]">
      <Sheet className="top-[10%] left-[3%] flex w-[42%] flex-col items-center p-4">
        <svg viewBox="0 0 80 80" className="size-[92px] -rotate-90">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--color-sunk)" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.18} ${circumference}`}
          />
        </svg>
        <Bar width={50} className="mt-3.5" />
        <Bar width={34} className="mt-2 bg-sunk" />
      </Sheet>
      <Sheet className="top-[24%] right-[3%] w-[52%] p-3.5">
        <div className="flex items-center justify-between">
          <Bar width={34} />
          <span className="h-1.5 w-6 rounded-full bg-sunk" />
        </div>
        <div className="mt-3 flex h-[76px] items-end gap-1.5">
          {CHART.map((height, i) => (
            <span key={i} className="relative flex-1 overflow-hidden rounded-[4px] bg-sunk" style={{ height: `${height}%` }}>
              {i < 2 && <span className="absolute inset-x-0 bottom-0 h-3/4 bg-forest/80" />}
            </span>
          ))}
        </div>
      </Sheet>
    </Stage>
  );
}

function CampSketch({ color, title }: { color: string; title: number }) {
  return (
    <div className="flex gap-2.5">
      <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <Bar width={title} className="h-2 bg-ink-3/70" />
        <Bar width={78} className="mt-2" />
        <Bar width={52} className="mt-1.5 bg-sunk" />
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunk">
          <span className="block h-full w-2/5 rounded-full" style={{ background: color }} />
        </div>
      </div>
    </div>
  );
}

/** Kamplar: camp cards on a stack, a new one on top. */
export function CampsArt() {
  return (
    <Stage className="h-[200px] max-w-[400px]">
      <Sheet className="top-[20%] left-[7%] w-[50%] -rotate-[7deg] p-3.5 opacity-55">
        <CampSketch color={CLAY} title={56} />
      </Sheet>
      <Sheet className="top-[14%] right-[7%] w-[50%] rotate-[6deg] p-3.5 opacity-75">
        <CampSketch color={PLUM} title={48} />
      </Sheet>
      <Sheet className="top-[27%] left-1/2 w-[56%] -translate-x-1/2 p-3.5">
        <CampSketch color={INK} title={62} />
      </Sheet>
      <PlusBadge className="top-[10%] right-[21%]" />
    </Stage>
  );
}

/** A camp without branches: a playlist link and the videos it brings. */
export function BranchesArt() {
  return (
    <Stage className="h-[200px] max-w-[400px]">
      <Sheet className="inset-x-[6%] top-[5%] flex items-center gap-2 py-2 pr-2 pl-3">
        <Link2 className="size-3.5 shrink-0 text-ink-3" />
        <Bar width={52} />
        <span className="ml-auto rounded-[7px] bg-ink px-2 py-1 text-[10px] font-semibold text-on-fill">Listeyi getir</span>
      </Sheet>
      <Sheet className="inset-x-[6%] top-[33%] overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="size-1.5 rounded-full" style={{ background: INK }} />
          <Bar width={26} className="bg-ink-3/70" />
          <span className="ml-auto h-1.5 w-12 rounded-full bg-sunk" />
        </div>
        {[58, 44, 66].map((width, i) => (
          <div key={i} className="flex items-center gap-2.5 border-t border-line px-3 py-2">
            <Play className="size-3 shrink-0 text-ink-3" />
            <Bar width={width} />
            <span className="ml-auto h-1.5 w-5 rounded-full bg-sunk" />
          </div>
        ))}
      </Sheet>
      <PlusBadge className="top-[23%] right-[3%]" />
    </Stage>
  );
}
