import { useEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Flag, Moon } from 'lucide-react';
import { addDays, dayOfWeek } from '../../lib/engine';
import { SHORT_WEEKDAYS, formatWeekRange } from '../../lib/format';
import type { DaySummary } from '../../lib/planView';
import { describeDay } from '../../lib/planView';
import { msg } from '../../lib/messages';


interface Props {
  days: DaySummary[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}

const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// 16 even dashes, so the dashed ring closes without a seam.
const DASH = CIRCUMFERENCE / 32;

/**
 * Progress is done/total tasks. A day without tasks (rest, mock exam, shifted
 * or outside the plan) keeps an empty ring and an icon, never a filled one.
 */
function Ring({ day }: { day: DaySummary }) {
  const planned = day.total > 0;
  const complete = planned && day.done === day.total;
  const ratio = planned ? day.done / day.total : 0;

  let center: ReactNode;
  if (complete) center = <Check className="size-4 text-forest" strokeWidth={3} />;
  else if (planned)
    center = (
      <span className={`tnum leading-none font-semibold text-ink ${day.total >= 10 ? 'text-[9px]' : 'text-[10.5px]'}`}>
        {day.done}{msg("/")}{day.total}
      </span>
    );
  else if (day.kind === 'rest') center = <Moon className="size-3.5 text-ink-3" />;
  else if (day.kind === 'mock') center = <Flag className="size-3.5 text-accent" />;
  else center = <span className="text-[13px] leading-none text-ink-3">{msg("–")}</span>;

  return (
    <span className="relative grid size-9 place-items-center sm:size-10" aria-hidden="true">
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill={complete ? 'var(--color-forest-tint)' : planned ? 'var(--color-card)' : 'var(--color-paper)'}
          stroke="var(--color-line)"
          strokeWidth="3"
          strokeDasharray={!planned && day.kind === 'study' ? `${DASH} ${DASH}` : undefined}
        />
        {ratio > 0 && (
          <circle
            cx="20"
            cy="20"
            r={RADIUS}
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${ratio * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          />
        )}
      </svg>
      <span className="relative flex">{center}</span>
    </span>
  );
}

/**
 * The week around the selected day as a route of seven stops, one completion
 * ring per day, and a tab list: arrow keys move one day (across week edges),
 * Home/End jump to Monday/Sunday, Page Up/Down a week.
 */
export function WeekStrip({ days, selectedDate, today, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const keyboardMove = useRef(false);

  useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }, [selectedDate]);

  const move = (event: KeyboardEvent, date: string) => {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    const index = days.findIndex(d => d.date === date);
    let target: string | null = null;
    if (event.key in offsets) target = addDays(date, offsets[event.key]);
    if (event.key === 'Home') target = days[0].date;
    if (event.key === 'End') target = days[days.length - 1].date;
    if (event.key === 'PageUp') target = addDays(date, -7);
    if (event.key === 'PageDown') target = addDays(date, 7);
    if (target === null || index < 0) return;
    event.preventDefault();
    keyboardMove.current = true;
    onSelect(target);
  };

  const monday = days[0].date;
  const thisWeek = days.some(d => d.date === today);

  return (
    <div className="card px-3 pt-3.5 pb-3 sm:px-5">
      <div className="flex items-center justify-between gap-2 pl-1">
        <p className="min-w-0 truncate">
          <span className="eyebrow">{thisWeek ? msg("Bu haftanın rotası") : msg("Haftanın rotası")}</span>
          <span className="ml-2 text-[12.5px] text-ink-3">{formatWeekRange(monday)}</span>
        </p>
        <div className="-mr-1.5 flex shrink-0 items-center">
          <button type="button" className="icon-btn size-9" onClick={() => onSelect(addDays(selectedDate, -7))} aria-label={msg("Önceki hafta")}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn size-9" onClick={() => onSelect(addDays(selectedDate, 7))} aria-label={msg("Sonraki hafta")}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative mt-3">
        {/* The route line runs through the ring centres, from the first stop to the last. */}
        <span
          className="absolute top-[25px] right-[calc(100%/14)] left-[calc(100%/14)] h-0.5 rounded-full bg-line sm:top-[27px]"
          aria-hidden="true"
        />
        <div ref={listRef} role="tablist" aria-label={msg("Haftanın günleri")} className="relative grid grid-cols-7 gap-0.5 sm:gap-1">
          {days.map(day => {
            const selected = day.date === selectedDate;
            const isToday = day.date === today;
            const overdue = day.date < today && day.done < day.total;
            return (
              <button
                key={day.date}
                type="button"
                role="tab"
                id={`day-tab-${day.date}`}
                aria-selected={selected}
                aria-controls="day-panel"
                aria-label={describeDay(day, today)}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(day.date)}
                onKeyDown={event => move(event, day.date)}
                className={`group flex min-w-0 flex-col items-center rounded-[12px] px-0.5 pt-2 pb-2 transition-colors ${
                  selected ? 'bg-sunk' : 'hover:bg-sunk/50'
                }`}
              >
                <span
                  className={`relative rounded-full transition-shadow ${
                    isToday
                      ? 'shadow-[0_0_0_4px_var(--color-accent-soft)]'
                      : selected
                        ? 'shadow-[0_0_0_4px_var(--color-forest-soft)]'
                        : 'group-hover:shadow-[0_0_0_4px_var(--color-sunk)]'
                  }`}
                >
                  <Ring day={day} />
                  {overdue && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-danger ring-2 ring-card" aria-hidden="true" />}
                </span>
                <span
                  className={`mt-2 text-[11.5px] leading-none font-semibold ${
                    isToday ? 'text-accent-strong' : selected ? 'text-ink' : 'text-ink-3 group-hover:text-ink-2'
                  }`}
                >
                  {isToday ? msg("Bugün") : SHORT_WEEKDAYS[dayOfWeek(day.date)]}
                </span>
                <span className={`tnum mt-1 text-[11px] leading-none ${selected ? 'font-semibold text-ink' : 'text-ink-3'}`}>
                  {Number(day.date.slice(8))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
