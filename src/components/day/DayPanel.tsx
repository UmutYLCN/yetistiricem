import type { ReactNode } from 'react';
import { ArrowRight, CircleCheck, Coffee, Flag, Forward, TriangleAlert } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import type { CampDaySummary, CampLabel } from '../../lib/allCamps';
import { dayGoals, everyCampOff } from '../../lib/allCamps';
import { addDays } from '../../lib/engine';
import { formatDayTitle, formatLongDate, formatMinutes } from '../../lib/format';
import type { CampInfo, DaySummary } from '../../lib/planView';
import { groupByBranch } from '../../lib/planView';
import { linkStateOf } from '../../lib/camps';
import { Meter } from '../ui/Bits';
import type { EmptyTone } from '../ui/EmptyState';
import { EmptyState } from '../ui/EmptyState';
import { CampDayTypeRows } from './CampDayTypes';
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

function EmptyDay({
  icon,
  tone,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  tone?: EmptyTone;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState className="overflow-hidden px-6 pt-14 pb-14" icon={icon} tone={tone} title={title} actions={action}>
      {body}
    </EmptyState>
  );
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
  const { date, plan, kind, total, done, minutes, doneMinutes } = summary;
  const items = groupByBranch(plan?.items ?? []);
  const open = total - done;
  const isPast = date < today;
  const isToday = date === today;
  const hasSample = items.some(i => linkStateOf(i.videoUrl, camps.get(i.playlistId)?.kind ?? 'manual') === 'sample');
  const allCamps = campLabels !== undefined;
  const parts = summary.camps ?? [];
  const offCamps = parts.filter(p => p.total === 0);
  // No camp studies, some have a mock exam and some rest: neither camp's copy fits the whole day.
  const mixedOff = allCamps && kind === 'mock' && parts.some(p => p.kind === 'rest');
  // Some camp is on a (free or shifted) study day: no full empty state, each camp's day type instead.
  const campsNotOff = allCamps && items.length === 0 && parts.length > 0 && !everyCampOff(parts);
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
  } else if (campsNotOff) {
    body = (
      <div>
        <p className="px-4 pt-4 pb-1 text-[14px] font-semibold text-ink sm:px-5">Bu gün kamplarında görev yok</p>
        <CampDayTypeRows parts={parts} labels={campLabels} />
      </div>
    );
  } else if (mixedOff) {
    body = (
      <EmptyDay
        icon={<Flag className="size-5" aria-hidden="true" />}
        tone="accent"
        title="Deneme ve dinlenme günü"
        body="Bu gün hiçbir kampında video yok. Deneme günü olan kampın için bir deneme çöz; diğerlerinde dinlen."
      />
    );
  } else if (kind === 'rest') {
    body = (
      <EmptyDay
        icon={<Coffee className="size-5" aria-hidden="true" />}
        title="Dinlenme günü"
        body={
          allCamps
            ? 'Bu gün hiçbir kampında video yok. Dinlen, zihnini topla; planların yarın kaldığı yerden devam eder.'
            : 'Bu gün için video planlanmadı. Dinlen, zihnini topla; plan yarın kaldığı yerden devam eder.'
        }
      />
    );
  } else if (kind === 'mock') {
    body = (
      <EmptyDay
        icon={<Flag className="size-5" aria-hidden="true" />}
        tone="accent"
        title="Deneme günü"
        body="Bugün video yok. Bir deneme çöz, yanlışlarını analiz et ve not al."
      />
    );
  } else if (plan?.isFreeDay) {
    body = (
      <EmptyDay
        icon={<CircleCheck className="size-5" aria-hidden="true" />}
        tone="forest"
        title="Bu günün branşları bitti"
        body="Bu güne yerleştirdiğin branşların videoları tamamlandı. Diğer branşlar kendi günlerinde devam ediyor."
      />
    );
  } else if (plan) {
    body = (
      <EmptyDay
        icon={<Forward className="size-5" aria-hidden="true" />}
        title="Görevler ileri taşındı"
        body="Bu günün tamamlanmamış görevleri sonraki günlere kaydırıldı."
      />
    );
  } else if (allCamps && firstDate !== null && date > firstDate && lastDate !== null && date < lastDate) {
    body = (
      <EmptyDay
        icon={<CircleCheck className="size-5" aria-hidden="true" />}
        title="Bu gün planların dışında"
        body="Bu tarihte hiçbir kampının planı yok: biri bitmiş, diğeri henüz başlamamış."
      />
    );
  } else if (firstDate === null) {
    body = (
      <EmptyDay
        icon={<Coffee className="size-5" aria-hidden="true" />}
        title="Bu gün boş"
        body="Bu kampta henüz video yok. Bir branş eklediğinde görevler buraya gelir."
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={onAddBranches}>
            Branş ekle
          </button>
        }
      />
    );
  } else if (date < (firstDate ?? startDate)) {
    body = (
      <EmptyDay
        icon={<ArrowRight className="size-5" aria-hidden="true" />}
        title="Plan henüz başlamadı"
        body={
          allCamps
            ? `İlk kampın ${formatLongDate(firstDate ?? startDate)} tarihinde başlıyor.`
            : `Planın ${formatLongDate(firstDate ?? startDate)} tarihinde başlıyor.`
        }
      />
    );
  } else {
    body = (
      <EmptyDay
        icon={<CircleCheck className="size-5" aria-hidden="true" />}
        tone="forest"
        title={allCamps ? 'Planların bu tarihten önce bitiyor' : 'Planın bu tarihten önce bitiyor'}
        body={lastDate ? `Son görevlerin ${formatLongDate(lastDate)} tarihinde. Yeni branş ekleyerek planı uzatabilirsin.` : ''}
      />
    );
  }
  // A mock exam day where other camps rest still says what each camp does that day.
  const offRows = mixedOff ? <CampDayTypeRows parts={parts} labels={campLabels} /> : null;

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
      {offRows && <div className="border-t border-line">{offRows}</div>}

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
