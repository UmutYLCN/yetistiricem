import type { ReactNode } from 'react';
import { ArrowRight, CircleCheck, Coffee, Flag, Forward } from 'lucide-react';
import type { CampLabel } from '../../lib/allCamps';
import { everyCampOff } from '../../lib/allCamps';
import { formatLongDate } from '../../lib/format';
import type { DaySummary } from '../../lib/planView';
import type { EmptyTone } from '../ui/EmptyState';
import { EmptyState } from '../ui/EmptyState';
import { CampDayTypeRows } from './CampDayTypes';

interface Props {
  summary: DaySummary;
  firstDate: string | null;
  lastDate: string | null;
  startDate: string;
  onAddBranches: () => void;
  /** "Tüm Kamplar": the camps on screen; camps without tasks then show their day type. */
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

/** A day without tasks, and why: rest, mock exam, before or after the plan, tasks moved on… */
export function DayEmpty({ summary, firstDate, lastDate, startDate, onAddBranches, campLabels }: Props) {
  const { date, plan, kind } = summary;
  const allCamps = campLabels !== undefined;
  const parts = summary.camps ?? [];
  // No camp studies, some have a mock exam and some rest: neither camp's copy fits the whole day.
  const mixedOff = allCamps && kind === 'mock' && parts.some(p => p.kind === 'rest');
  // Some camp is on a (free or shifted) study day: no full empty state, each camp's day type instead.
  const campsNotOff = allCamps && parts.length > 0 && !everyCampOff(parts);

  if (campsNotOff) {
    return (
      <div>
        <p className="px-4 pt-4 pb-1 text-[14px] font-semibold text-ink sm:px-5">Bu gün kamplarında görev yok</p>
        <CampDayTypeRows parts={parts} labels={campLabels} />
      </div>
    );
  }
  if (mixedOff) {
    return (
      <>
        <EmptyDay
          icon={<Flag className="size-5" aria-hidden="true" />}
          tone="accent"
          title="Deneme ve dinlenme günü"
          body="Bu gün hiçbir kampında video yok. Deneme günü olan kampın için bir deneme çöz; diğerlerinde dinlen."
        />
        {/* Still says what each camp does that day. */}
        <div className="border-t border-line">
          <CampDayTypeRows parts={parts} labels={campLabels} />
        </div>
      </>
    );
  }
  if (kind === 'rest') {
    return (
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
  }
  if (kind === 'mock') {
    return (
      <EmptyDay
        icon={<Flag className="size-5" aria-hidden="true" />}
        tone="accent"
        title="Deneme günü"
        body="Bugün video yok. Bir deneme çöz, yanlışlarını analiz et ve not al."
      />
    );
  }
  if (plan?.isFreeDay) {
    return (
      <EmptyDay
        icon={<CircleCheck className="size-5" aria-hidden="true" />}
        tone="forest"
        title="Bu günün branşları bitti"
        body="Bu güne yerleştirdiğin branşların videoları tamamlandı. Diğer branşlar kendi günlerinde devam ediyor."
      />
    );
  }
  if (plan) {
    return (
      <EmptyDay
        icon={<Forward className="size-5" aria-hidden="true" />}
        title="Görevler ileri taşındı"
        body="Bu günün tamamlanmamış görevleri sonraki günlere kaydırıldı."
      />
    );
  }
  if (allCamps && firstDate !== null && date > firstDate && lastDate !== null && date < lastDate) {
    return (
      <EmptyDay
        icon={<CircleCheck className="size-5" aria-hidden="true" />}
        title="Bu gün planların dışında"
        body="Bu tarihte hiçbir kampının planı yok: biri bitmiş, diğeri henüz başlamamış."
      />
    );
  }
  if (firstDate === null) {
    return (
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
  }
  if (date < (firstDate ?? startDate)) {
    return (
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
  }
  return (
    <EmptyDay
      icon={<CircleCheck className="size-5" aria-hidden="true" />}
      tone="forest"
      title={allCamps ? 'Planların bu tarihten önce bitiyor' : 'Planın bu tarihten önce bitiyor'}
      body={lastDate ? `Son görevlerin ${formatLongDate(lastDate)} tarihinde. Yeni branş ekleyerek planı uzatabilirsin.` : ''}
    />
  );
}
