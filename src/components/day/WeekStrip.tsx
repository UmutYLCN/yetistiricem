import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Flag, Moon } from 'lucide-react';
import { addDays, dayOfWeek } from '../../lib/engine';
import { SHORT_WEEKDAYS, formatWeekRange } from '../../lib/format';
import type { DaySummary } from '../../lib/planView';
import { describeDay } from '../../lib/planView';

interface Props {
  days: DaySummary[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}

/**
 * The week around the selected day as a tab list: arrow keys move one day
 * (across week edges), Home/End jump to Monday/Sunday.
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

  return (
    <div className="card px-3 pt-3 pb-3 sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-2 pl-1">
        <p className="text-[13px] font-semibold text-ink-2">{formatWeekRange(monday)}</p>
        <div className="flex items-center">
          <button
            type="button"
            className="icon-btn size-9"
            onClick={() => onSelect(addDays(selectedDate, -7))}
            aria-label="Önceki hafta"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-btn size-9"
            onClick={() => onSelect(addDays(selectedDate, 7))}
            aria-label="Sonraki hafta"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div ref={listRef} role="tablist" aria-label="Haftanın günleri" className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {days.map(day => {
          const selected = day.date === selectedDate;
          const isToday = day.date === today;
          const overdue = day.date < today && day.done < day.total;
          const allDone = day.total > 0 && day.done === day.total;
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
              className={`relative flex min-h-[78px] min-w-0 flex-col items-center justify-start gap-1 rounded-[11px] px-0.5 pt-2 pb-2 transition-colors ${
                selected ? 'bg-ink text-on-fill' : 'hover:bg-sunk'
              }`}
            >
              <span
                className={`text-[11px] font-semibold tracking-wide uppercase ${
                  selected ? 'text-on-fill/65' : isToday ? 'text-accent' : 'text-ink-3'
                }`}
              >
                {SHORT_WEEKDAYS[dayOfWeek(day.date)]}
              </span>
              <span className={`font-display tnum text-[21px] leading-none ${selected ? 'text-on-fill' : 'text-ink'}`}>
                {Number(day.date.slice(8))}
              </span>
              <span className="flex h-3.5 items-center" aria-hidden="true">
                {day.kind === 'rest' ? (
                  <Moon className={`size-3 ${selected ? 'text-on-fill/60' : 'text-ink-3'}`} />
                ) : day.kind === 'mock' ? (
                  <Flag className={`size-3 ${selected ? 'text-on-fill/70' : 'text-accent'}`} />
                ) : allDone ? (
                  <Check className={`size-3.5 ${selected ? 'text-on-fill' : 'text-forest'}`} strokeWidth={3} />
                ) : day.total > 0 ? (
                  <span className={`block h-1 w-6 overflow-hidden rounded-full ${selected ? 'bg-on-fill/15' : 'bg-line-strong'}`}>
                    <span
                      className={`block h-full rounded-full ${selected ? 'bg-on-fill' : 'bg-forest'}`}
                      style={{ width: `${(day.done / day.total) * 100}%` }}
                    />
                  </span>
                ) : null}
              </span>
              {isToday && !selected && <span className="absolute bottom-1 h-[3px] w-4 rounded-full bg-accent" aria-hidden="true" />}
              {overdue && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-accent" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
