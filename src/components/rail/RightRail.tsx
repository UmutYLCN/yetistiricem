import { Forward, TriangleAlert } from 'lucide-react';
import type { RoadmapStats, UserPreferences } from '../../types';
import { addDays, assessDeadline, dayOfWeek, diffDays } from '../../lib/engine';
import {
  SHORT_WEEKDAYS,
  compactDayLabel,
  formatHours,
  formatLongDate,
  formatMinutes,
  formatPercent,
  formatSpeed,
  formatWeekRange,
} from '../../lib/format';
import type { CampInfo, DaySummary, ScheduledItem } from '../../lib/planView';
import { Meter, SubjectDot } from '../ui/Bits';

export function ProgressCard({
  stats,
  prefs,
  today,
  targetEndDate,
}: {
  stats: RoadmapStats;
  prefs: UserPreferences;
  today: string;
  targetEndDate: string | null;
}) {
  const finished = stats.totalVideos > 0 && stats.completedVideos === stats.totalVideos;
  const daysLeft = diffDays(today, stats.estimatedFinishDate);
  const deadline = finished ? null : assessDeadline({ finishDate: stats.estimatedFinishDate, targetEndDate });
  return (
    <section className="card p-5" aria-labelledby="rail-progress">
      <h2 id="rail-progress" className="eyebrow">
        Genel ilerleme
      </h2>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="font-display tnum text-[40px] leading-none text-ink">{formatPercent(stats.progressPercent)}</p>
        <p className="tnum pb-1 text-[13px] text-ink-2">
          <span className="font-semibold text-ink">{stats.completedVideos}</span> / {stats.totalVideos} video
        </p>
      </div>
      <div className="mt-3">
        <Meter value={stats.completedVideos} max={stats.totalVideos} label="Tamamlanan videolar" />
      </div>
      <dl className="mt-4 space-y-2.5 text-[13.5px]">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Kalan çalışma</dt>
          <dd className="tnum font-semibold text-ink">{finished ? '—' : formatHours(stats.totalMinutes)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Tahmini bitiş</dt>
          <dd className="tnum text-right font-semibold text-ink">
            {finished ? (
              'Tamamlandı'
            ) : (
              <>
                {formatLongDate(stats.estimatedFinishDate)}
                {daysLeft > 0 && <span className="block text-[12px] font-normal text-ink-3">{daysLeft} gün sonra</span>}
                {daysLeft < 0 && (
                  <span className="block text-[12px] font-normal text-accent-strong">geride kalan görevler var</span>
                )}
              </>
            )}
          </dd>
        </div>
        {deadline && (deadline.kind === 'late' || deadline.kind === 'on-track') && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Hedef</dt>
            <dd className="tnum text-right font-semibold text-ink">
              {formatLongDate(deadline.targetEndDate)}
              <span className={`block text-[12px] font-normal ${deadline.kind === 'late' ? 'text-accent-strong' : 'text-forest'}`}>
                {deadline.kind === 'late' ? `${deadline.lateDays} gün geride` : deadline.spareDays > 0 ? `${deadline.spareDays} gün önce biter` : 'tam zamanında'}
              </span>
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Günlük hedef</dt>
          <dd className="tnum font-semibold text-ink">
            {formatMinutes(prefs.dailyStudyHours * 60)} · {formatSpeed(prefs.playbackSpeed)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function WeekCard({
  days,
  selectedDate,
  today,
  onSelect,
}: {
  days: DaySummary[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const total = days.reduce((a, d) => a + d.total, 0);
  const done = days.reduce((a, d) => a + d.done, 0);
  const minutes = days.reduce((a, d) => a + d.minutes, 0);
  const max = Math.max(1, ...days.map(d => d.minutes));
  const isThisWeek = days.some(d => d.date === today);

  return (
    <section className="card p-5" aria-labelledby="rail-week">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="rail-week" className="eyebrow">
          {isThisWeek ? 'Bu hafta' : formatWeekRange(days[0].date)}
        </h2>
        <p className="tnum text-[12.5px] text-ink-3">{formatMinutes(minutes)}</p>
      </div>
      <p className="mt-2 text-[14px] text-ink-2">
        <span className="tnum font-display text-[26px] text-ink">{done}</span>
        <span className="tnum"> / {total} görev</span>
      </p>
      <div className="mt-4 grid grid-cols-7 items-end gap-1.5" style={{ height: 88 }}>
        {days.map(day => {
          const height = day.minutes > 0 ? Math.max(10, (day.minutes / max) * 64) : 4;
          const doneRatio = day.minutes > 0 ? day.doneMinutes / day.minutes : 0;
          const selected = day.date === selectedDate;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelect(day.date)}
              aria-label={`${SHORT_WEEKDAYS[dayOfWeek(day.date)]}: ${day.done}/${day.total} görev${day.kind === 'rest' ? ', dinlenme' : day.kind === 'mock' ? ', deneme' : ''}`}
              aria-pressed={selected}
              className="group flex h-full flex-col items-center justify-end gap-1.5 rounded-md"
            >
              <span
                className={`relative w-full max-w-[22px] overflow-hidden rounded-[5px] ${day.minutes > 0 ? 'bg-sunk' : 'bg-line'}`}
                style={{ height }}
              >
                <span className="absolute inset-x-0 bottom-0 bg-forest" style={{ height: `${doneRatio * 100}%` }} />
              </span>
              <span
                className={`text-[10.5px] font-semibold ${
                  selected ? 'text-ink underline decoration-2 underline-offset-4' : day.date === today ? 'text-accent' : 'text-ink-3'
                }`}
              >
                {SHORT_WEEKDAYS[dayOfWeek(day.date)]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function NextUpCard({
  items,
  camps,
  today,
  onSelect,
}: {
  items: ScheduledItem[];
  camps: Map<string, CampInfo>;
  today: string;
  onSelect: (date: string) => void;
}) {
  return (
    <section className="card p-5" aria-labelledby="rail-next">
      <h2 id="rail-next" className="eyebrow">
        Sıradaki
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-[14px] text-ink-2">Önünde bekleyen görev yok.</p>
      ) : (
        <ol className="mt-2 -mx-2">
          {items.map(({ item, date }) => {
            const color = camps.get(item.playlistId)?.color.solid ?? '#5c6970';
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(date)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-sunk"
                >
                  <SubjectDot color={color} className="mt-[7px]" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[14px] leading-snug font-medium text-ink">{item.title}</span>
                    <span className="tnum mt-0.5 block text-[12px] text-ink-3">
                      <span className={date === today ? 'font-semibold text-accent-strong' : ''}>
                        {compactDayLabel(date, today)}
                      </span>{' '}
                      · {item.subject} · {formatMinutes(item.effectiveMinutes)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function OverdueCard({ count, today, onShift }: { count: number; today: string; onShift: () => void }) {
  if (count === 0) return null;
  return (
    <section className="callout callout-accent" aria-labelledby="rail-overdue">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 id="rail-overdue" className="font-semibold text-ink">
          {count} geciken görev
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Geçmiş günlerde kalanlar {formatLongDate(addDays(today, 1))} gününden itibaren yeniden dağıtılabilir.
        </p>
        <button type="button" className="btn btn-sm btn-secondary mt-2.5" onClick={onShift}>
          <Forward aria-hidden="true" />
          Yeniden planla
        </button>
      </div>
    </section>
  );
}
