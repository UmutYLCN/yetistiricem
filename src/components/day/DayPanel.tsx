import type { ReactNode } from 'react';
import { CircleCheck, Forward, TriangleAlert } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import type { CampDaySummary, CampLabel } from '../../lib/allCamps';
import { dayGoals } from '../../lib/allCamps';
import { addDays } from '../../lib/engine';
import { formatDayTitle, formatLongDate, formatMinutes } from '../../lib/format';
import type { CampInfo, DaySummary } from '../../lib/planView';
import { groupByBranch } from '../../lib/planView';
import { linkStateOf } from '../../lib/camps';
import { Meter } from '../ui/Bits';
import { CampDayTypeRows } from './CampDayTypes';
import { DayEmpty } from './DayEmpty';
import { TaskItem } from './TaskItem';

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
}: {
  part: CampDaySummary;
  label: CampLabel | undefined;
  camps: Map<string, CampInfo>;
  oversizedIds: Set<string>;
  onToggle: (item: DailyPlanItem, done: boolean) => void;
  onEditLink: (item: DailyPlanItem) => void;
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
            ~{formatMinutes(part.minutes)} çalışma{label && <> · günlük hedef {formatMinutes(label.dailyMinutes)}</>}
          </p>
        </div>
        <p className="tnum shrink-0 pt-0.5 text-[12.5px] font-semibold text-ink-2" aria-label={`${part.total} görevden ${part.done} tamamlandı`}>
          {part.done}/{part.total}
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
  onAddBranches,
  campLabels,
}: Props) {
  const { date, plan, total, done, minutes, doneMinutes } = summary;
  const items = groupByBranch(plan?.items ?? []);
  const open = total - done;
  const isPast = date < today;
  const isToday = date === today;
  const hasSample = items.some(i => linkStateOf(i.videoUrl, camps.get(i.playlistId)?.kind ?? 'manual') === 'sample');
  const allCamps = campLabels !== undefined;
  const parts = summary.camps ?? [];
  const offCamps = parts.filter(p => p.total === 0);
  const goals = allCamps ? dayGoals(summary, campLabels) : null;

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
      {total > 0 && (
        <div className="border-b border-line px-4 pt-4 pb-3.5 sm:px-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[14px] text-ink-2">
              <span className="font-semibold text-ink">{total} görev</span> · ~{formatMinutes(minutes)} çalışma
              {allCamps && <span className="whitespace-nowrap"> · {formatMinutes(doneMinutes)} tamamlandı</span>}
            </p>
            <p className="tnum text-[13px] font-semibold text-ink-2">
              {done}/{total}
            </p>
          </div>
          <div className="mt-2.5">
            <Meter value={doneMinutes} max={minutes} label="Günün ilerlemesi (süreye göre)" />
          </div>
          {goals && goals.goals.length > 0 && (
            <p className="tnum mt-2 text-[12.5px] text-ink-3">
              Günlük hedef: {goals.goals.map(g => `${g.name} ${formatMinutes(g.dailyMinutes)}`).join(' + ')}
              {goals.goals.length > 1 && (
                <>
                  {' = '}
                  <span className="font-semibold whitespace-nowrap text-ink-2">toplam {formatMinutes(goals.totalMinutes)}</span>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {(isPast && open > 0) || hasSample || (total > 0 && open === 0) ? (
        <div className="space-y-2 border-b border-line px-4 py-3 sm:px-5">
          {isPast && open > 0 && (
            <div className="callout callout-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">Bu günden {open} görev yetişmedi.</p>
                <p className="mt-0.5 text-[13px] text-ink-2">
                  İleri taşırsan kalanlar {formatLongDate(addDays(today, 1))} gününden itibaren yeniden dağıtılır. Bugünkü
                  görevlerin yerinde kalır.
                </p>
                <button type="button" className="btn btn-sm btn-secondary mt-2.5" onClick={() => onShift(date)}>
                  <Forward aria-hidden="true" />
                  Kalanları ileri taşı
                </button>
              </div>
            </div>
          )}
          {hasSample && (
            <div className="callout callout-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
              <p className="text-[13.5px] text-ink-2">
                <span className="font-semibold text-ink">Bazı görevlerin bağlantısı çalışmıyor.</span> Önceki sürümün örnek
                listelerindeki videolar gerçek değildi. Gerçek videoyu biliyorsan “Bağlantı ekle” ile ekleyebilirsin.
              </p>
            </div>
          )}
          {total > 0 && open === 0 && (
            <div className="callout callout-info">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
              <p className="text-[13.5px] text-ink-2">
                <span className="font-semibold text-ink">{isToday ? 'Bugünün' : 'Bu günün'} tüm görevleri tamam.</span>{' '}
                {isToday ? 'Güzel iş, yarın görüşürüz.' : ''}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {body}

      {isToday && open > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-paper/60 px-4 py-3 sm:px-5">
          <p className="text-[13px] text-ink-2">Bugün yetişmeyecek mi?</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onShift(date)}>
            <Forward aria-hidden="true" />
            Kalanları yarına kaydır
          </button>
        </div>
      )}
    </section>
  );
}
