import { ArrowRight, ChevronLeft, ChevronRight, Flag, Moon } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import { addDays, dayOfWeek, formatDateKey } from '../../lib/engine';
import { LONG_WEEKDAYS, SHORT_WEEKDAYS, formatMinutes, formatWeekRange } from '../../lib/format';
import type { CampInfo, DaySummary } from '../../lib/planView';
import { TaskItem } from '../day/TaskItem';
import { PageHeader } from '../layout/PageHeader';
import { Meter } from '../ui/Bits';

interface Props {
  days: DaySummary[];
  today: string;
  selectedDate: string;
  camps: Map<string, CampInfo>;
  oversizedIds: Set<string>;
  onSelectDate: (date: string) => void;
  onOpenDay: (date: string) => void;
  onToggle: (item: DailyPlanItem, done: boolean) => void;
  onEditLink: (item: DailyPlanItem) => void;
}

export function WeekView({ days, today, selectedDate, camps, oversizedIds, onSelectDate, onOpenDay, onToggle, onEditLink }: Props) {
  const total = days.reduce((a, d) => a + d.total, 0);
  const done = days.reduce((a, d) => a + d.done, 0);
  const minutes = days.reduce((a, d) => a + d.minutes, 0);
  const studyDays = days.filter(d => d.total > 0).length;
  const containsToday = days.some(d => d.date === today);

  return (
    <div className="mx-auto max-w-[920px]">
      <PageHeader
        eyebrow={containsToday ? 'Bu hafta' : 'Hafta'}
        title="Haftalık plan"
        subtitle={formatWeekRange(days[0].date)}
        actions={
          <>
            {!containsToday && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelectDate(today)}>
                Bu hafta
              </button>
            )}
            <div className="flex">
              <button
                type="button"
                className="icon-btn"
                onClick={() => onSelectDate(addDays(selectedDate, -7))}
                aria-label="Önceki hafta"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onSelectDate(addDays(selectedDate, 7))}
                aria-label="Sonraki hafta"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </>
        }
      />

      <div className="card mb-5 grid grid-cols-3 divide-x divide-line">
        {[
          { label: 'Görev', value: `${done} / ${total}` },
          { label: 'Çalışma süresi', value: formatMinutes(minutes) },
          { label: 'Çalışma günü', value: String(studyDays) },
        ].map(stat => (
          <div key={stat.label} className="min-w-0 px-3 py-3 sm:px-5 sm:py-3.5">
            <p className="truncate text-[12px] text-ink-3">{stat.label}</p>
            <p className="tnum mt-0.5 text-[15px] font-semibold text-ink sm:text-[17px]">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {days.map(day => {
          const isToday = day.date === today;
          const items = day.plan?.items ?? [];
          return (
            <section
              key={day.date}
              className={`card overflow-hidden ${isToday ? 'ring-1 ring-accent/50' : ''}`}
              aria-labelledby={`week-day-${day.date}`}
            >
              <header className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="w-11 shrink-0 text-center">
                  <p className={`text-[11px] font-semibold uppercase ${isToday ? 'text-accent' : 'text-ink-3'}`}>
                    {SHORT_WEEKDAYS[dayOfWeek(day.date)]}
                  </p>
                  <p className="font-display tnum text-[22px] leading-none text-ink">{Number(day.date.slice(8))}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id={`week-day-${day.date}`} className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
                    {LONG_WEEKDAYS[dayOfWeek(day.date)]}
                    <span className="sr-only">{formatDateKey(day.date)}</span>
                    {isToday && <span className="chip chip-today">Bugün</span>}
                    {day.kind === 'rest' && (
                      <span className="chip">
                        <Moon aria-hidden="true" />
                        Dinlenme
                      </span>
                    )}
                    {day.kind === 'mock' && (
                      <span className="chip chip-today">
                        <Flag aria-hidden="true" />
                        Deneme
                      </span>
                    )}
                  </h2>
                  {day.total > 0 ? (
                    <div className="mt-1 flex items-center gap-3">
                      <p className="tnum shrink-0 text-[12.5px] text-ink-3">
                        {day.done}/{day.total} · {formatMinutes(day.minutes)}
                      </p>
                      <div className="w-full max-w-[160px]">
                        <Meter value={day.doneMinutes} max={day.minutes} label={`${LONG_WEEKDAYS[dayOfWeek(day.date)]} ilerlemesi`} />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-[12.5px] text-ink-3">
                      {day.kind === 'study'
                        ? day.plan?.isFreeDay
                          ? 'Bu günün branşları bitti'
                          : day.plan
                            ? 'Görevler ileri taşındı'
                            : 'Planlanmış görev yok'
                        : 'Video yok'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm shrink-0"
                  onClick={() => onOpenDay(day.date)}
                  aria-label={`${LONG_WEEKDAYS[dayOfWeek(day.date)]} gününü aç`}
                >
                  <span className="max-sm:hidden">Güne git</span>
                  <ArrowRight aria-hidden="true" />
                </button>
              </header>
              {items.length > 0 && (
                <ul className="border-t border-line" aria-label={`${LONG_WEEKDAYS[dayOfWeek(day.date)]} görevleri`}>
                  {items.map(item => (
                    <TaskItem
                      key={item.id}
                      item={item}
                      camp={camps.get(item.playlistId)}
                      oversized={oversizedIds.has(item.id)}
                      onToggle={onToggle}
                      onEditLink={onEditLink}
                      compact
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
