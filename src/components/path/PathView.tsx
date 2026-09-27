import { useMemo, useState } from 'react';
import { Forward, TriangleAlert } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import type { CampLabel } from '../../lib/allCamps';
import { campIdOf } from '../../lib/allCamps';
import { linkStateOf } from '../../lib/camps';
import { dayStops } from '../../lib/dayPath';
import { addDays } from '../../lib/engine';
import { formatDayTitle, formatLongDate } from '../../lib/format';
import type { CampInfo, DaySummary } from '../../lib/planView';
import { DayEmpty } from '../day/DayEmpty';
import { OverdueCard } from '../rail/RightRail';
import type { StopLook } from './DayPath';
import { DayPath } from './DayPath';
import { TaskSheet } from './TaskSheet';
import { msg } from '../../lib/messages';


interface Props {
  summary: DaySummary;
  today: string;
  camps: Map<string, CampInfo>;
  oversizedIds: Set<string>;
  /** Incomplete tasks on days before today, over every camp shown. */
  overdueCount: number;
  firstDate: string | null;
  lastDate: string | null;
  startDate: string;
  onToggle: (item: DailyPlanItem, done: boolean) => void;
  /** Carries the open tasks of this day (and the days before it) forward. */
  onShift: (date: string) => void;
  onShiftOverdue: () => void;
  onEditLink: (item: DailyPlanItem) => void;
  /** Plays the task in focus mode (tasks with a video only). */
  onFocus?: (item: DailyPlanItem) => void;
  onAddBranches: () => void;
  /** Several camps on screen: each stop then names its camp. */
  campLabels?: Map<string, CampLabel>;
}

/**
 * "Yol": the selected day's tasks as a path to walk, one stop per video.
 * A stop opens its task in a sheet, where "İzledim" ticks it off. The day's
 * title, day arrows and the list / path switch are Rotam's shared header.
 */
export function PathView({
  summary,
  today,
  camps,
  oversizedIds,
  overdueCount,
  firstDate,
  lastDate,
  startDate,
  onToggle,
  onShift,
  onShiftOverdue,
  onEditLink,
  onFocus,
  onAddBranches,
  campLabels,
}: Props) {
  const { date, total, done, minutes, doneMinutes } = summary;
  const stops = useMemo(() => dayStops(summary, today), [summary, today]);
  const [openId, setOpenId] = useState<string | null>(null);
  const openIndex = openId === null ? -1 : stops.findIndex(s => s.item.id === openId);
  const openStop = openIndex >= 0 ? stops[openIndex] : null;
  const isToday = date === today;
  const open = total - done;

  const campNameOf = (item: DailyPlanItem) => {
    const campId = campIdOf(item);
    return campId ? campLabels?.get(campId)?.name : undefined;
  };
  const look = (item: DailyPlanItem): StopLook => {
    const info = camps.get(item.playlistId);
    const campName = campNameOf(item);
    const link = linkStateOf(item.videoUrl, info?.kind ?? 'manual');
    return {
      color: info?.color.solid ?? 'var(--color-ink-3)',
      tag: campName ? `${campName} · ${item.subject}` : item.subject,
      playable: link === 'video' || link === 'playlist-only',
    };
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <OverdueCard className="mb-4" count={overdueCount} today={today} onShift={onShiftOverdue} />

      {total > 0 ? (
        <>
          {date < today && open > 0 && (
            <div className="callout callout-danger mb-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{msg("Bu günden ")}{open} {msg(" görev yetişmedi.")}</p>
                <p className="mt-0.5 text-[13px] text-ink-2">
                  {msg("\n                  Ritmini güncellersen kalanlar ")}{formatLongDate(addDays(today, 1))} {msg(" gününden itibaren yeniden dağıtılır.\n                ")}</p>
                <button type="button" className="btn btn-sm btn-secondary mt-2.5" onClick={() => onShift(date)}>
                  <Forward aria-hidden="true" />
                  {msg("\n                  Ritmi güncelle\n                ")}</button>
              </div>
            </div>
          )}

          <div className="mt-2">
            <DayPath
              key={date}
              stops={stops}
              look={look}
              isToday={isToday}
              minutes={minutes}
              doneMinutes={doneMinutes}
              onOpen={item => setOpenId(item.id)}
            />
          </div>

          {isToday && open > 0 && (
            <div className="mx-auto flex max-w-[600px] flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-line pt-4 text-center">
              <p className="text-[13px] text-ink-3">{msg("Bugün yetişmeyecek mi?")}</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onShift(date)}>
                <Forward aria-hidden="true" />
                {msg("\n                Kalanları yarına kaydır\n              ")}</button>
            </div>
          )}
        </>
      ) : (
        <section className="card overflow-hidden" aria-label={`${formatDayTitle(date)}: görev yok`}>
          <DayEmpty
            summary={summary}
            firstDate={firstDate}
            lastDate={lastDate}
            startDate={startDate}
            onAddBranches={onAddBranches}
            campLabels={campLabels}
          />
        </section>
      )}

      <TaskSheet
        stop={openStop}
        index={openIndex}
        total={stops.length}
        info={openStop ? camps.get(openStop.item.playlistId) : undefined}
        campName={openStop ? campNameOf(openStop.item) : undefined}
        oversized={openStop ? oversizedIds.has(openStop.item.id) : false}
        onToggle={onToggle}
        onEditLink={onEditLink}
        onFocus={
          onFocus &&
          (item => {
            setOpenId(null);
            onFocus(item);
          })
        }
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
