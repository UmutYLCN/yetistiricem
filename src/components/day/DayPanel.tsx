import type { ReactNode } from 'react';
import { ArrowRight, CircleCheck, Coffee, Flag, Forward, TriangleAlert } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import { addDays } from '../../lib/engine';
import { formatDayTitle, formatLongDate, formatMinutes } from '../../lib/format';
import type { CampInfo, DaySummary } from '../../lib/planView';
import { linkStateOf } from '../../lib/camps';
import { Meter } from '../ui/Bits';
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
}

function EmptyDay({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-sunk text-ink-2">{icon}</span>
      <p className="font-display text-[19px] text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[14px] text-ink-2">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Tasks of the selected day. Completed tasks stay where they are. */
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
}: Props) {
  const { date, plan, kind, total, done, minutes, doneMinutes } = summary;
  const items = plan?.items ?? [];
  const open = total - done;
  const isPast = date < today;
  const isToday = date === today;
  const hasSample = items.some(i => linkStateOf(i.videoUrl, camps.get(i.playlistId)?.kind ?? 'manual') === 'sample');

  let body: ReactNode;
  if (items.length > 0) {
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
  } else if (kind === 'rest') {
    body = (
      <EmptyDay
        icon={<Coffee className="size-5" aria-hidden="true" />}
        title="Dinlenme günü"
        body="Bu gün için video planlanmadı. Dinlen, zihnini topla; plan yarın kaldığı yerden devam eder."
      />
    );
  } else if (kind === 'mock') {
    body = (
      <EmptyDay
        icon={<Flag className="size-5" aria-hidden="true" />}
        title="Deneme günü"
        body="Bugün video yok. Bir deneme çöz, yanlışlarını analiz et ve not al."
      />
    );
  } else if (plan?.isFreeDay) {
    body = (
      <EmptyDay
        icon={<CircleCheck className="size-5" aria-hidden="true" />}
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
        body={`Planın ${formatLongDate(firstDate ?? startDate)} tarihinde başlıyor.`}
      />
    );
  } else {
    body = (
      <EmptyDay
        icon={<CircleCheck className="size-5" aria-hidden="true" />}
        title="Planın bu tarihten önce bitiyor"
        body={lastDate ? `Son görevlerin ${formatLongDate(lastDate)} tarihinde. Yeni branş ekleyerek planı uzatabilirsin.` : ''}
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
            </p>
            <p className="tnum text-[13px] font-semibold text-ink-2">
              {done}/{total}
            </p>
          </div>
          <div className="mt-2.5">
            <Meter value={doneMinutes} max={minutes} label="Günün ilerlemesi (süreye göre)" />
          </div>
        </div>
      )}

      {(isPast && open > 0) || hasSample || (total > 0 && open === 0) ? (
        <div className="space-y-2 border-b border-line px-4 py-3 sm:px-5">
          {isPast && open > 0 && (
            <div className="callout callout-accent">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
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
