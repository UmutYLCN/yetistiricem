import type { ReactNode } from 'react';
import { Check, Flag, Moon } from 'lucide-react';
import { dayOfWeek } from '../../lib/engine';
import { SHORT_WEEKDAYS } from '../../lib/format';
import type { DaySummary } from '../../lib/planView';
import { describeDay } from '../../lib/planView';

interface Props {
  days: DaySummary[];
  today: string;
  selectedDate: string;
  labelledBy: string;
  onGo: (date: string) => void;
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
        {day.done}/{day.total}
      </span>
    );
  else if (day.kind === 'rest') center = <Moon className="size-3.5 text-ink-3" />;
  else if (day.kind === 'mock') center = <Flag className="size-3.5 text-accent" />;
  else center = <span className="text-[13px] leading-none text-ink-3">–</span>;

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
 * The week as a route of seven stops, one completion ring per day. Each stop
 * jumps to that day's card; today is labelled "Bugün".
 */
export function WeekRoute({ days, today, selectedDate, labelledBy, onGo }: Props) {
  return (
    <nav aria-labelledby={labelledBy} className="relative">
      {/* The route line runs through the ring centres, from the first stop to the last. */}
      <span
        className="absolute top-[21px] right-[calc(100%/14)] left-[calc(100%/14)] h-0.5 rounded-full bg-line sm:top-[23px]"
        aria-hidden="true"
      />
      <ol className="relative grid grid-cols-7">
        {days.map(day => {
          const isToday = day.date === today;
          const selected = day.date === selectedDate;
          const overdue = day.date < today && day.done < day.total;
          return (
            <li key={day.date} className="flex min-w-0 justify-center">
              <button
                type="button"
                onClick={() => onGo(day.date)}
                aria-label={describeDay(day, today)}
                aria-current={isToday ? 'date' : undefined}
                className="group flex min-w-0 flex-col items-center rounded-[12px] px-1 pt-1 pb-1.5"
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
                  {overdue && (
                    <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-danger ring-2 ring-card" aria-hidden="true" />
                  )}
                </span>
                <span
                  className={`mt-2 text-[11.5px] leading-none font-semibold ${
                    isToday ? 'text-accent-strong' : selected ? 'text-ink' : 'text-ink-3 group-hover:text-ink-2'
                  }`}
                >
                  {isToday ? 'Bugün' : SHORT_WEEKDAYS[dayOfWeek(day.date)]}
                </span>
                <span className="tnum mt-1 text-[11px] leading-none text-ink-3">{Number(day.date.slice(8))}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
