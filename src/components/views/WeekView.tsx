import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarX, ChevronLeft, ChevronRight, CircleCheck, Flag, Forward, Moon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import { addDays, dayOfWeek, formatDateKey } from '../../lib/engine';
import { LONG_WEEKDAYS, SHORT_WEEKDAYS, formatMinutes, formatWeekRange } from '../../lib/format';
import type { CampInfo, DaySummary } from '../../lib/planView';
import { TaskItem } from '../day/TaskItem';
import { WeekRoute } from '../day/WeekRoute';
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

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/** Scroll the canvas so `card` sits at its snap start, without moving the page. */
function scrollToCard(track: HTMLElement, card: HTMLElement, behavior: ScrollBehavior) {
  const inset = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
  const left = track.scrollLeft + card.getBoundingClientRect().left - track.getBoundingClientRect().left - inset;
  track.scrollTo({ left, behavior });
}

function cardOf(track: HTMLElement | null, date: string): HTMLElement | null {
  return track?.querySelector<HTMLElement>(`[data-date="${date}"]`) ?? null;
}

interface EmptyCopy {
  icon: LucideIcon;
  title: string;
  body: string;
}

function emptyCopy(day: DaySummary): EmptyCopy {
  if (day.kind === 'rest') return { icon: Moon, title: 'Dinlenme günü', body: 'Video planlanmadı. Dinlen, zihnini topla.' };
  if (day.kind === 'mock') return { icon: Flag, title: 'Deneme günü', body: 'Video yok. Bir deneme çöz, yanlışlarını analiz et.' };
  if (day.plan?.isFreeDay)
    return { icon: CircleCheck, title: 'Bu günün branşları bitti', body: 'Bu güne yerleşen branşların videoları tamamlandı.' };
  if (day.plan)
    return { icon: Forward, title: 'Görevler ileri taşındı', body: 'Tamamlanmayan görevler sonraki günlere kaydırıldı.' };
  return { icon: CalendarX, title: 'Planlanmış görev yok', body: 'Bu gün planın dışında kalıyor.' };
}

interface DayCardProps {
  day: DaySummary;
  today: string;
  selected: boolean;
  camps: Map<string, CampInfo>;
  oversizedIds: Set<string>;
  onOpenDay: (date: string) => void;
  onToggle: (item: DailyPlanItem, done: boolean) => void;
  onEditLink: (item: DailyPlanItem) => void;
}

function DayCard({ day, today, selected, camps, oversizedIds, onOpenDay, onToggle, onEditLink }: DayCardProps) {
  const isToday = day.date === today;
  const items = day.plan?.items ?? [];
  const weekday = LONG_WEEKDAYS[dayOfWeek(day.date)];
  const empty = items.length === 0 ? emptyCopy(day) : null;
  const EmptyIcon = empty?.icon;

  return (
    <section
      data-date={day.date}
      tabIndex={-1}
      aria-labelledby={`week-day-${day.date}`}
      className={`week-card card flex flex-col overflow-hidden rounded-[18px] ${
        isToday ? 'border-accent/45' : selected ? 'border-forest/35' : ''
      }`}
    >
      <header className="flex items-center gap-3 px-4 pt-4 pb-3.5">
        <div className="w-11 shrink-0 text-center">
          <p className={`text-[11px] font-semibold uppercase ${isToday ? 'text-accent' : 'text-ink-3'}`}>
            {SHORT_WEEKDAYS[dayOfWeek(day.date)]}
          </p>
          <p className="font-display tnum text-[24px] leading-none text-ink">{Number(day.date.slice(8))}</p>
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={`week-day-${day.date}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-ink">
            {weekday}
            <span className="sr-only">{formatDateKey(day.date)}</span>
            {isToday && <span className="chip chip-today">Bugün</span>}
            {items.length > 0 && day.kind === 'rest' && (
              <span className="chip">
                <Moon aria-hidden="true" />
                Dinlenme
              </span>
            )}
            {items.length > 0 && day.kind === 'mock' && (
              <span className="chip chip-today">
                <Flag aria-hidden="true" />
                Deneme
              </span>
            )}
          </h2>
          {day.total > 0 && (
            <div className="mt-1 flex items-center gap-3">
              <p className="tnum shrink-0 text-[12.5px] text-ink-3">
                {day.done}/{day.total} · {formatMinutes(day.minutes)}
              </p>
              <div className="w-full max-w-[140px]">
                <Meter value={day.doneMinutes} max={day.minutes} label={`${weekday} ilerlemesi`} />
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm shrink-0"
          onClick={() => onOpenDay(day.date)}
          aria-label={`${weekday} gününü aç`}
        >
          <span className="max-sm:hidden">Güne git</span>
          <ArrowRight aria-hidden="true" />
        </button>
      </header>
      {items.length > 0 ? (
        <ul className="border-t border-line" aria-label={`${weekday} görevleri`}>
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
      ) : (
        empty &&
        EmptyIcon && (
          <div className="flex flex-1 flex-col items-center border-t border-line bg-paper/50 px-6 pt-10 pb-12 text-center">
            <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-sunk text-ink-2">
              <EmptyIcon className="size-[18px]" aria-hidden="true" />
            </span>
            <p className="text-[15px] font-semibold text-ink">{empty.title}</p>
            <p className="mt-1 max-w-[15rem] text-[13px] text-ink-3">{empty.body}</p>
          </div>
        )
      )}
    </section>
  );
}

export function WeekView({ days, today, selectedDate, camps, oversizedIds, onSelectDate, onOpenDay, onToggle, onEditLink }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const shownWeek = useRef<string | null>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });
  const monday = days[0].date;
  const total = days.reduce((a, d) => a + d.total, 0);
  const done = days.reduce((a, d) => a + d.done, 0);
  const minutes = days.reduce((a, d) => a + d.minutes, 0);
  const studyDays = days.filter(d => d.total > 0).length;
  const containsToday = days.some(d => d.date === today);

  // Keep the selected day's card in view: at once when a week opens, smoothly
  // when another day of the same week is picked.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const card = cardOf(track, selectedDate);
    if (!track || !card) return;
    const sameWeek = shownWeek.current === monday;
    shownWeek.current = monday;
    scrollToCard(track, card, sameWeek ? scrollBehavior() : 'auto');
  }, [selectedDate, monday]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const atStart = track.scrollLeft <= 1;
      const atEnd = track.scrollLeft >= max - 1;
      setEdges(prev => (prev.atStart === atStart && prev.atEnd === atEnd ? prev : { atStart, atEnd }));
    };
    update();
    track.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => {
      track.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  const step = (direction: -1 | 1) => {
    const track = trackRef.current;
    const card = track?.firstElementChild;
    if (!track || !(card instanceof HTMLElement)) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: scrollBehavior() });
  };

  const goToDay = (date: string) => {
    const track = trackRef.current;
    const card = cardOf(track, date);
    if (date !== selectedDate) onSelectDate(date);
    else if (track && card) scrollToCard(track, card, scrollBehavior());
    card?.focus({ preventScroll: true });
  };

  return (
    <div className="mx-auto max-w-[920px]">
      <PageHeader
        eyebrow={containsToday ? 'Bu hafta' : 'Hafta'}
        title="Haftalık plan"
        subtitle={formatWeekRange(monday)}
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

      <div className="card mb-6 overflow-hidden">
        <div className="px-2 pt-4 pb-3 sm:px-5">
          <h2 id="week-route-title" className="eyebrow mb-3 px-2 sm:px-0">
            {containsToday ? 'Bu haftanın rotası' : 'Haftanın rotası'}
          </h2>
          <WeekRoute days={days} today={today} selectedDate={selectedDate} labelledBy="week-route-title" onGo={goToDay} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
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
      </div>

      <div className="mb-2 flex items-center justify-between gap-3">
        <p id="week-canvas-label" className="eyebrow">
          Günler
        </p>
        <div className="flex">
          <button
            type="button"
            className="icon-btn size-9 aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:bg-transparent"
            onClick={() => !edges.atStart && step(-1)}
            aria-disabled={edges.atStart}
            aria-label="Önceki güne kaydır"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-btn size-9 aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:bg-transparent"
            onClick={() => !edges.atEnd && step(1)}
            aria-disabled={edges.atEnd}
            aria-label="Sonraki güne kaydır"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div ref={trackRef} role="region" aria-labelledby="week-canvas-label" className="week-track">
        {days.map(day => (
          <DayCard
            key={day.date}
            day={day}
            today={today}
            selected={day.date === selectedDate}
            camps={camps}
            oversizedIds={oversizedIds}
            onOpenDay={onOpenDay}
            onToggle={onToggle}
            onEditLink={onEditLink}
          />
        ))}
      </div>
    </div>
  );
}
