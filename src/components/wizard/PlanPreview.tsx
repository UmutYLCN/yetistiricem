import { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, CircleCheck, Coffee, Flag, Pencil, TriangleAlert } from 'lucide-react';
import type { DailyPlan, StudyCamp } from '../../types';
import { assessDeadline, buildCampSchedule, dailyHoursForDeadline, dayOfWeek, diffDays, planEndDate } from '../../lib/engine';
import { LONG_WEEKDAYS, SHORT_WEEKDAYS, formatHours, formatLongDate, formatMinutes, formatShortDate, formatWeekRange, startOfWeek } from '../../lib/format';
import { resolveColor } from '../../lib/subjects';
import { Meter } from '../ui/Bits';

interface Props {
  camp: Pick<StudyCamp, 'branches' | 'schedule' | 'shiftEvents'>;
  today: string;
  /** Apply a suggested daily study time. */
  onUseHours?: (hours: number) => void;
  onEditRhythm?: () => void;
}

const WEEKS_STEP = 2;

/**
 * The generated plan before anything is saved: real dates and weekday names,
 * branch-coloured video cards, each day's total against its capacity, and a
 * clear signal for the optional target date.
 */
export function PlanPreview({ camp, today, onUseHours, onEditRhythm }: Props) {
  const [weeksShown, setWeeksShown] = useState(WEEKS_STEP);
  const { result, finish, deadline, suggestion } = useMemo(() => {
    const built = buildCampSchedule(camp, { today });
    const end = planEndDate(built.plans);
    const status = assessDeadline({ finishDate: end, targetEndDate: camp.schedule.targetEndDate, unscheduledCount: built.unscheduledItems.length });
    // Only a late plan needs the (heavier) search for a daily time that fits.
    return { result: built, finish: end, deadline: status, suggestion: status.kind === 'late' ? dailyHoursForDeadline(camp, { today }) : null };
  }, [camp, today]);
  const { plans, capacityMinutes, unscheduledItems, issues } = result;

  const studyDays = plans.filter(p => p.items.length > 0);
  const totalMinutes = studyDays.reduce((acc, p) => acc + p.totalMinutes, 0);
  const oversized = issues.filter(i => i.kind === 'oversized-item');
  const branchById = new Map(camp.branches.map(b => [b.id, b]));
  const colorOf = (id: string) => {
    const branch = branchById.get(id);
    return resolveColor(branch?.colorTag, branch?.subject ?? '');
  };

  const weeks = useMemo(() => {
    const map = new Map<string, DailyPlan[]>();
    for (const plan of plans) {
      const monday = startOfWeek(plan.date);
      map.set(monday, [...(map.get(monday) ?? []), plan]);
    }
    return [...map.entries()];
  }, [plans]);

  const branchFinish = new Map<string, string>();
  for (const plan of plans) for (const item of plan.items) branchFinish.set(item.playlistId, plan.date);

  if (plans.length === 0 && unscheduledItems.length === 0) {
    return <p className="rounded-[12px] border border-dashed border-line-strong px-4 py-8 text-center text-ink-2">Planlanacak video yok.</p>;
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: 'İlk ders günü', value: studyDays[0] ? formatShortDate(studyDays[0].date) : '—', note: studyDays[0] ? LONG_WEEKDAYS[dayOfWeek(studyDays[0].date)] : '' },
          { label: 'Tahmini bitiş', value: finish ? formatShortDate(finish) : '—', note: finish ? `${diffDays(today, finish) >= 0 ? `${diffDays(today, finish)} gün sonra` : formatLongDate(finish)}` : '' },
          { label: 'Ders günü', value: String(studyDays.length), note: `${weeks.length} hafta` },
          { label: 'Toplam çalışma', value: formatHours(totalMinutes), note: `günde en çok ${formatMinutes(capacityMinutes)}` },
        ].map(stat => (
          <div key={stat.label} className="min-w-0 rounded-[12px] border border-line bg-card px-3.5 py-3">
            <dt className="eyebrow">{stat.label}</dt>
            <dd className="font-display tnum mt-1 truncate text-[22px] leading-tight text-ink">{stat.value}</dd>
            <dd className="truncate text-[12px] text-ink-3">{stat.note}</dd>
          </div>
        ))}
      </dl>

      <DeadlineSignal deadline={deadline} suggestion={suggestion} onUseHours={onUseHours} onEditRhythm={onEditRhythm} />

      {oversized.length > 0 && (
        <div className="callout callout-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <p className="text-[13.5px] text-ink-2">
            <span className="font-semibold text-ink">{oversized.length} video günlük süreden uzun.</span> Her biri tek başına bir
            güne yerleşti; o günler {formatMinutes(capacityMinutes)} sınırını aşar.
          </p>
        </div>
      )}

      <section aria-labelledby="preview-branches">
        <h3 id="preview-branches" className="mb-2 text-[12.5px] font-semibold tracking-wide text-ink-3 uppercase">
          Branşlar
        </h3>
        <ul className="flex flex-wrap gap-2">
          {camp.branches.map(branch => {
            const color = resolveColor(branch.colorTag, branch.subject);
            const end = branchFinish.get(branch.id);
            return (
              <li key={branch.id} className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pr-3 pl-2 text-[12.5px]">
                <span className="size-2.5 rounded-full" style={{ background: color.solid }} aria-hidden="true" />
                <span className="font-semibold text-ink">{branch.subject}</span>
                <span className="tnum text-ink-3">
                  {branch.videos.length} video · {end ? `bitiş ${formatShortDate(end)}` : 'plana girmedi'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="preview-days" className="space-y-5">
        <h3 id="preview-days" className="sr-only">
          Günlük plan
        </h3>
        {weeks.slice(0, weeksShown).map(([monday, days], weekIndex) => (
          <div key={monday}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-[14px] font-semibold text-ink">
                {weekIndex + 1}. hafta <span className="font-normal text-ink-3">· {formatWeekRange(monday)}</span>
              </p>
              <p className="tnum text-[12.5px] text-ink-3">{formatMinutes(days.reduce((acc, d) => acc + d.totalMinutes, 0))}</p>
            </div>
            <ol className="grid gap-2.5 md:grid-cols-2">
              {days.map(day => (
                <PreviewDay key={day.date} day={day} capacity={capacityMinutes} colorOf={colorOf} />
              ))}
            </ol>
          </div>
        ))}
        {weeks.length > weeksShown && (
          <button type="button" className="btn btn-secondary w-full" onClick={() => setWeeksShown(n => n + WEEKS_STEP)}>
            <ChevronDown aria-hidden="true" />
            Sonraki {Math.min(WEEKS_STEP, weeks.length - weeksShown)} haftayı göster
            <span className="font-normal text-ink-3">({weeks.length - weeksShown} hafta daha)</span>
          </button>
        )}
      </section>
    </div>
  );
}

function PreviewDay({ day, capacity, colorOf }: { day: DailyPlan; capacity: number; colorOf: (id: string) => { solid: string } }) {
  const dow = dayOfWeek(day.date);
  if (day.items.length === 0) {
    const label = day.isMockExamDay ? 'Deneme günü' : day.isFreeDay ? 'Bu günün branşları bitti' : 'Dinlenme';
    const Icon = day.isMockExamDay ? Flag : Coffee;
    return (
      <li className="flex items-center gap-3 self-start rounded-[12px] border border-dashed border-line-strong px-3.5 py-2.5 text-[13px] text-ink-2">
        <Icon className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
        <span className="font-semibold text-ink">{LONG_WEEKDAYS[dow]}</span>
        <span className="tnum text-ink-3">{formatShortDate(day.date)}</span>
        <span className="ml-auto">{label}</span>
      </li>
    );
  }
  return (
    <li className="overflow-hidden rounded-[12px] border border-line bg-card">
      <div className="flex items-center gap-3 px-3.5 pt-3 pb-2">
        <div className="w-10 shrink-0 text-center">
          <p className="text-[10.5px] font-bold text-ink-3 uppercase">{SHORT_WEEKDAYS[dow]}</p>
          <p className="font-display tnum text-[20px] leading-none text-ink">{Number(day.date.slice(8))}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink">
            {LONG_WEEKDAYS[dow]} <span className="font-normal text-ink-3">· {formatShortDate(day.date)}</span>
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1">
              <Meter value={Math.min(day.totalMinutes, capacity)} max={capacity} label={`${LONG_WEEKDAYS[dow]} doluluğu`} />
            </div>
            <p className="tnum shrink-0 text-[12px] text-ink-2">
              <span className="font-semibold text-ink">{formatMinutes(day.totalMinutes)}</span> / {formatMinutes(capacity)}
            </p>
          </div>
        </div>
      </div>
      <ul className="space-y-1 px-2.5 pb-2.5">
        {day.items.map(item => {
          const color = colorOf(item.playlistId).solid;
          return (
            <li key={item.id} className="flex items-start gap-2.5 rounded-[8px] bg-paper/70 py-1.5 pr-2.5 pl-2">
              <span className="mt-0.5 w-1 shrink-0 self-stretch rounded-full" style={{ background: color }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-bold" style={{ color }}>
                  {item.subject}
                </span>
                <span className="line-clamp-2 text-[13px] leading-snug text-ink">{item.title}</span>
              </span>
              <span className="tnum shrink-0 pt-0.5 text-[12px] text-ink-3">{formatMinutes(item.effectiveMinutes)}</span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function DeadlineSignal({
  deadline,
  suggestion,
  onUseHours,
  onEditRhythm,
}: {
  deadline: ReturnType<typeof assessDeadline>;
  suggestion: number | null;
  onUseHours?: (hours: number) => void;
  onEditRhythm?: () => void;
}) {
  if (deadline.kind === 'none') {
    return (
      <p className="flex items-center gap-2 text-[13px] text-ink-3">
        <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
        Hedef bitiş tarihi seçmedin; plan tüm videoları bitirene kadar sürer.
      </p>
    );
  }
  if (deadline.kind === 'on-track') {
    return (
      <div className="callout callout-info" role="status">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
        <p className="text-[13.5px] text-ink-2">
          <span className="font-semibold text-ink">Hedefe yetişiyor.</span> Plan {formatLongDate(deadline.finishDate)} tarihinde bitiyor
          {deadline.spareDays > 0 ? `; hedef tarihten ${deadline.spareDays} gün önce.` : '; tam hedef gününde.'}
        </p>
      </div>
    );
  }
  if (deadline.kind === 'incomplete') {
    return (
      <div className="callout callout-accent" role="alert">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
        <p className="text-[13.5px] text-ink-2">
          <span className="font-semibold text-ink">{deadline.unscheduledCount} video hiçbir güne yerleşmedi.</span> Branşlarını günlere
          yerleştirmeden hedef tarihe yetişme hesaplanamaz.
        </p>
      </div>
    );
  }
  return (
    <div className="callout callout-accent flex-wrap" role="alert">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
      <div className="min-w-[14rem] flex-1 text-[13.5px] text-ink-2">
        <p>
          <span className="font-semibold text-ink">Hedefin {deadline.lateDays} gün gerisinde.</span> Plan{' '}
          {formatLongDate(deadline.finishDate)} tarihinde bitiyor; hedefin {formatLongDate(deadline.targetEndDate)}. Hiçbir video
          atlanmaz ve günler taşırılmaz.
        </p>
        <p className="mt-1">
          {suggestion !== null
            ? `Günlük çalışma süresini ${formatMinutes(suggestion * 60)} yaparsan hedefe yetişir.`
            : 'Günlük süreyi artırmak tek başına yetmiyor; daha çok ders günü ekle ya da hedef tarihi ertele.'}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {suggestion !== null && onUseHours && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onUseHours(suggestion)}>
              Günlük süreyi {formatMinutes(suggestion * 60)} yap
            </button>
          )}
          {onEditRhythm && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onEditRhythm}>
              <Pencil aria-hidden="true" />
              Ritmi düzenle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
