import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CircleCheck, Forward, TriangleAlert } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import type { CampDaySummary, CampLabel } from '../../lib/allCamps';
import { addDays } from '../../lib/engine';
import { formatDayTitle, formatLongDate, formatMinutes } from '../../lib/format';
import type { CampInfo, DaySummary } from '../../lib/planView';
import { groupByBranch } from '../../lib/planView';
import { linkStateOf } from '../../lib/camps';
import { CampDayTypeRows } from './CampDayTypes';
import { DayEmpty } from './DayEmpty';
import { TaskItem } from './TaskItem';
import { msg } from '../../lib/messages';


interface Props {
  summary: DaySummary;
  today: string;
  camps: Map<string, CampInfo>;
  oversizedIds: Set<string>;
  firstDate: string | null;
  lastDate: string | null;
  startDate: string;
  onToggle: (item: DailyPlanItem, done: boolean) => void;
  onShift: (date: string) => void;
  onEditLink: (item: DailyPlanItem) => void;
  /** Plays the task in focus mode (tasks with a video only). */
  onFocus?: (item: DailyPlanItem) => void;
  onAddBranches: () => void;
  /**
   * "Tüm Kamplar": the camps on screen. The day is then listed camp by camp
   * (each with its own daily goal), and camps without tasks show their day type.
   */
  campLabels?: Map<string, CampLabel>;
}

/** One camp's tasks of the day in the combined view, under the camp's name and daily goal. */
function CampSection({
  part,
  label,
  camps,
  oversizedIds,
  onToggle,
  onEditLink,
  onFocus,
}: {
  part: CampDaySummary;
  label: CampLabel | undefined;
  camps: Map<string, CampInfo>;
  oversizedIds: Set<string>;
  onToggle: (item: DailyPlanItem, done: boolean) => void;
  onEditLink: (item: DailyPlanItem) => void;
  /** Plays the task in focus mode (tasks with a video only). */
  onFocus?: (item: DailyPlanItem) => void;
}) {
  const name = label?.name ?? 'Kamp';
  const headingId = `day-camp-${part.campId}`;
  return (
    <section aria-labelledby={headingId} className="border-t border-line first:border-t-0">
      <div className="flex items-start justify-between gap-3 bg-paper/60 px-4 pt-2.5 pb-2 sm:px-5">
        <div className="min-w-0">
          <h3 id={headingId} className="text-[13.5px] font-semibold break-words text-ink">
            {name}
          </h3>
          <p className="tnum text-[12.5px] text-ink-3">
            {msg("\n            ~")}{formatMinutes(part.minutes)} {msg(" çalışma")}{label && <> {msg(" · günlük hedef ")}{formatMinutes(label.dailyMinutes)}</>}
          </p>
        </div>
        <p className="tnum shrink-0 pt-0.5 text-[12.5px] font-semibold text-ink-2" aria-label={`${part.total} görevden ${part.done} tamamlandı`}>
          {part.done}{msg("/")}{part.total}
        </p>
      </div>
      <ul aria-label={`${name} görevleri`}>
        {groupByBranch(part.items).map(item => (
          <TaskItem
            key={item.id}
            item={item}
            camp={camps.get(item.playlistId)}
            oversized={oversizedIds.has(item.id)}
            onToggle={onToggle}
            onEditLink={onEditLink}
            onFocus={onFocus}
            campName={name}
          />
        ))}
      </ul>
    </section>
  );
}

/** Tasks of the selected day, grouped by branch. Completed tasks stay where they are. */
export function DayPanel({
  summary,
  today,
  camps,
  oversizedIds,
  firstDate,
  lastDate,
  startDate,
  onToggle,
  onShift,
  onEditLink,
  onFocus,
  onAddBranches,
  campLabels,
}: Props) {
  const { date, plan, total, done } = summary;
  const items = groupByBranch(plan?.items ?? []);
  const open = total - done;
  const isPast = date < today;
  const isToday = date === today;
  const hasSample = items.some(i => linkStateOf(i.videoUrl, camps.get(i.playlistId)?.kind ?? 'manual') === 'sample');
  const allCamps = campLabels !== undefined;
  const parts = summary.camps ?? [];
  const offCamps = parts.filter(p => p.total === 0);

  let body: ReactNode;
  if (allCamps && items.length > 0) {
    body = (
      <>
        <div>
          {parts
            .filter(p => p.total > 0)
            .map(part => (
              <CampSection
                key={part.campId}
                part={part}
                label={campLabels.get(part.campId)}
                camps={camps}
                oversizedIds={oversizedIds}
                onToggle={onToggle}
                onEditLink={onEditLink}
                onFocus={onFocus}
              />
            ))}
        </div>
        {offCamps.length > 0 && (
          <div className="border-t border-line">
            <CampDayTypeRows parts={offCamps} labels={campLabels} />
          </div>
        )}
      </>
    );
  } else if (items.length > 0) {
    body = (
      <ul aria-label={`${formatDayTitle(date)} görevleri`}>
        {items.map(item => (
          <TaskItem
            key={item.id}
            item={item}
            camp={camps.get(item.playlistId)}
            oversized={oversizedIds.has(item.id)}
            onToggle={onToggle}
            onEditLink={onEditLink}
            onFocus={onFocus}
          />
        ))}
      </ul>
    );
  } else {
    body = (
      <DayEmpty
        summary={summary}
        firstDate={firstDate}
        lastDate={lastDate}
        startDate={startDate}
        onAddBranches={onAddBranches}
        campLabels={campLabels}
      />
    );
  }

  return (
    <section
      id="day-panel"
      role="tabpanel"
      aria-labelledby={`day-tab-${date}`}
      tabIndex={-1}
      className="card overflow-hidden focus-visible:outline-offset-4"
    >
      {(isPast && open > 0) || hasSample || (total > 0 && open === 0) ? (
        <div className="space-y-2 border-b border-line px-4 py-3 sm:px-5">
          {isPast && open > 0 && (
            <div className="callout callout-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{msg("Bu günden ")}{open} {msg(" görev yetişmedi.")}</p>
                <p className="mt-0.5 text-[13px] text-ink-2">
                  {msg("\n                  Ritmini güncellersen kalanlar ")}{formatLongDate(addDays(today, 1))} {msg(" gününden itibaren yeniden dağıtılır. Bugünkü\n                  görevlerin yerinde kalır.\n                ")}</p>
                <button type="button" className="btn btn-sm btn-secondary mt-2.5" onClick={() => onShift(date)}>
                  <Forward aria-hidden="true" />
                  {msg("\n                  Ritmi güncelle\n                ")}</button>
              </div>
            </div>
          )}
          {hasSample && (
            <div className="callout callout-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
              <p className="text-[13.5px] text-ink-2">
                <span className="font-semibold text-ink">{msg("Bazı görevlerin bağlantısı çalışmıyor.")}</span> {msg(" Önceki sürümün örnek\n                listelerindeki videolar gerçek değildi. Gerçek videoyu biliyorsan “Bağlantı ekle” ile ekleyebilirsin.\n              ")}</p>
            </div>
          )}
          {total > 0 && open === 0 && <DoneNotice key={date} isToday={isToday} />}
        </div>
      ) : null}

      {body}

      {isToday && open > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-paper/60 px-4 py-3 sm:px-5">
          <p className="text-[13px] text-ink-2">{msg("Bugün yetişmeyecek mi?")}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onShift(date)}>
            <Forward aria-hidden="true" />
            {msg("\n            Kalanları yarına kaydır\n          ")}</button>
        </div>
      )}
    </section>
  );
}

/** "Tüm görevler tamam": shown when the day is finished, then fades away on its own. */
function DoneNotice({ isToday }: { isToday: boolean }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(false), 4500);
    return () => window.clearTimeout(timer);
  }, []);
  if (!shown) return null;
  return (
    <div className="callout callout-info notice-fade" role="status">
      <CircleCheck className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
      <p className="text-[13.5px] text-ink-2">
        <span className="font-semibold text-ink">{isToday ? msg("Bugünün") : msg("Bu günün")} {msg(" tüm görevleri tamam.")}</span>{msg(" ")}
        {isToday ? msg("Güzel iş, yarın görüşürüz.") : msg("")}
      </p>
    </div>
  );
}
