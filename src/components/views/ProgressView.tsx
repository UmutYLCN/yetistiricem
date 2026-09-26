import { CircleCheck, Forward, Gauge, TriangleAlert } from 'lucide-react';
import type { RoadmapStats, StudyCamp, UserPreferences } from '../../types';
import type { CampOverview } from '../../lib/allCamps';
import type { ScheduleIssue } from '../../lib/engine';
import { addDays, assessDeadline, diffDays, formatDateKey } from '../../lib/engine';
import {
  formatHours,
  formatLongDate,
  formatMinutes,
  formatPercent,
  formatShortDate,
  startOfWeek,
} from '../../lib/format';
import type { CampInfo, PlanIndex, WeekOverview } from '../../lib/planView';
import { campProgress } from '../../lib/planView';
import { PageHeader } from '../layout/PageHeader';
import { KindBadge, Meter, SubjectDot } from '../ui/Bits';

/** One camp (its own schedule issues), or "Tüm Kamplar" (each camp's own overview). */
export type ProgressScope =
  | { kind: 'camp'; camp: StudyCamp; prefs: UserPreferences; issues: ScheduleIssue[] }
  | { kind: 'all'; camps: CampOverview[] };

interface Props {
  stats: RoadmapStats;
  today: string;
  index: PlanIndex;
  camps: Map<string, CampInfo>;
  weeks: WeekOverview[];
  scope: ProgressScope;
  onShiftOverdue: () => void;
  onOpenWeek: (monday: string) => void;
  onEditTempo: (campId: string) => void;
}

function unscheduledCount(issues: ScheduleIssue[]): number {
  return issues.reduce(
    (acc, i) => acc + (i.kind === 'unassigned-branch' || i.kind === 'no-study-days' ? i.unscheduledCount : 0),
    0
  );
}

function hasPlanIssues(issues: ScheduleIssue[]): boolean {
  return issues.some(i => i.kind === 'oversized-item' || i.kind === 'no-study-days' || i.kind === 'unassigned-branch');
}

/** A camp's schedule issues. `campName` titles them in the combined view. */
function PlanIssues({
  issues,
  prefs,
  camps,
  campName,
  headingId,
  onEditTempo,
}: {
  issues: ScheduleIssue[];
  prefs: UserPreferences;
  camps: Map<string, CampInfo>;
  campName?: string;
  headingId: string;
  onEditTempo: () => void;
}) {
  const oversized = issues.filter(i => i.kind === 'oversized-item');
  const noStudyDays = issues.find(i => i.kind === 'no-study-days');
  const unassigned = issues.flatMap(i => (i.kind === 'unassigned-branch' ? [i] : []));
  if (!hasPlanIssues(issues)) return null;
  return (
    <section className="callout callout-warn" aria-labelledby={headingId}>
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[14px] text-ink-2">
        <h2 id={headingId} className="font-semibold break-words text-ink">
          {campName ? `${campName}: planla ilgili dikkat edilecekler` : 'Planla ilgili dikkat edilecekler'}
        </h2>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {noStudyDays && noStudyDays.kind === 'no-study-days' && (
            <li>
              Haftada hiç çalışma günü yok; {noStudyDays.unscheduledCount} video planlanamadı.{' '}
              <button type="button" className="font-semibold text-forest underline" onClick={onEditTempo}>
                Çalışma günü seç
              </button>
            </li>
          )}
          {unassigned.map(issue => (
            <li key={issue.playlistId}>
              {camps.get(issue.playlistId)?.camp.subject ?? 'Bir branş'} hiçbir güne yerleşmemiş; {issue.unscheduledCount} videosu
              planda yok.{' '}
              <button type="button" className="font-semibold text-forest underline" onClick={onEditTempo}>
                Günlere yerleştir
              </button>
            </li>
          ))}
          {oversized.length > 0 && (
            <li>
              {oversized.length} video günlük çalışma sürenden ({formatMinutes(prefs.dailyStudyHours * 60)}) uzun; her biri
              tek başına bir güne yerleştirildi.
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

/** "Tüm Kamplar": each camp's own progress, finish, target and daily goal. */
function CampRows({ overviews, today, onEditTempo }: { overviews: CampOverview[]; today: string; onEditTempo: (campId: string) => void }) {
  return (
    <section className="card" aria-labelledby="progress-by-camp">
      <h2 id="progress-by-camp" className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink">
        Kamplara göre
      </h2>
      <ul>
        {overviews.map(({ camp, result, stats, deadline }) => {
          const finished = stats.totalVideos > 0 && stats.completedVideos === stats.totalVideos;
          const prefs = result.preferences;
          return (
            <li key={camp.id} className="border-t border-line px-5 py-4 first:border-t-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="min-w-0 flex-1 font-semibold break-words text-ink">{camp.name}</p>
                <p className="tnum text-[13px] font-semibold text-ink-2">
                  {stats.completedVideos}/{stats.totalVideos}
                </p>
              </div>
              <div className="mt-2.5">
                <Meter value={stats.completedVideos} max={stats.totalVideos} label={`${camp.name} ilerlemesi`} />
              </div>
              <p className="tnum mt-2 text-[12.5px] text-ink-3">
                {finished
                  ? 'Tüm videolar tamamlandı'
                  : `${formatHours(stats.totalMinutes)} kaldı · bitiş ${formatShortDate(stats.estimatedFinishDate)}`}
                {' · '}
                günlük hedef {formatMinutes(prefs.dailyStudyHours * 60)} ·{' '}
                {prefs.startDate > today ? `${formatShortDate(prefs.startDate)} tarihinde başlıyor` : `${formatShortDate(prefs.startDate)} başladı`}
              </p>
              {deadline && deadline.kind !== 'none' && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <p
                    className={`tnum text-[13px] font-semibold ${
                      deadline.kind === 'on-track' ? 'text-forest' : deadline.kind === 'late' ? 'text-accent-strong' : 'text-warn'
                    }`}
                  >
                    {deadline.kind === 'late'
                      ? `Hedefin ${deadline.lateDays} gün gerisinde (hedef ${formatShortDate(deadline.targetEndDate)})`
                      : deadline.kind === 'on-track'
                        ? `Hedefe yetişiyor (hedef ${formatShortDate(deadline.targetEndDate)})`
                        : `${deadline.unscheduledCount} video planda yok; hedef ${formatShortDate(deadline.targetEndDate)}`}
                  </p>
                  {deadline.kind !== 'on-track' && (
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => onEditTempo(camp.id)}>
                      <Gauge aria-hidden="true" />
                      Tempoyu düzenle
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ProgressView({ stats, today, index, camps, weeks, scope, onShiftOverdue, onOpenWeek, onEditTempo }: Props) {
  const finished = stats.totalVideos > 0 && stats.completedVideos === stats.totalVideos;
  const daysLeft = diffDays(today, stats.estimatedFinishDate);
  const thisMonday = startOfWeek(today);
  const single = scope.kind === 'camp' ? scope : null;
  const deadline =
    finished || !single
      ? null
      : assessDeadline({
          finishDate: stats.estimatedFinishDate,
          targetEndDate: single.camp.schedule.targetEndDate,
          unscheduledCount: unscheduledCount(single.issues),
        });
  // Combined view: which camp each branch belongs to.
  const campOfBranch = new Map(
    scope.kind === 'all' ? scope.camps.flatMap(({ camp }) => camp.branches.map(b => [b.id, camp.name] as const)) : []
  );

  let subtitle: string;
  if (single) {
    subtitle = `Plan ${formatLongDate(single.prefs.startDate)} tarihinde ${single.prefs.startDate > today ? 'başlıyor' : 'başladı'}`;
  } else {
    const all = scope.kind === 'all' ? scope.camps : [];
    const first = all.map(o => o.result.preferences.startDate).sort()[0];
    subtitle = `${all.length} kamp birlikte${first ? ` · ilk kamp ${formatLongDate(first)} tarihinde ${first > today ? 'başlıyor' : 'başladı'}` : ''}`;
  }

  const tiles = [
    {
      label: 'Tamamlanan',
      value: formatPercent(stats.progressPercent),
      note: `${stats.completedVideos} / ${stats.totalVideos} video`,
    },
    {
      label: 'Kalan çalışma',
      value: finished ? '—' : formatHours(stats.totalMinutes),
      note: `${stats.daysRemaining} çalışma günü`,
    },
    {
      label: 'Tahmini bitiş',
      value: finished ? 'Bitti' : formatDateKey(stats.estimatedFinishDate),
      note: finished ? 'Tüm videolar tamam' : daysLeft > 0 ? `${daysLeft} gün sonra` : daysLeft === 0 ? 'Bugün' : 'Geride kalan görevler var',
    },
    {
      label: 'Geciken',
      value: String(index.overdue.length),
      note: index.overdue.length > 0 ? 'geçmiş günlerden' : 'Geride kalan yok',
      accent: index.overdue.length > 0,
    },
  ];

  return (
    <div className="mx-auto max-w-[920px] space-y-5">
      <PageHeader title="İlerleme" subtitle={subtitle} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(tile => (
          <div key={tile.label} className="card min-w-0 p-4 sm:p-5">
            <p className="eyebrow">{tile.label}</p>
            <p className={`font-display tnum mt-2 text-[30px] leading-none ${tile.accent ? 'text-accent-strong' : 'text-ink'}`}>
              {tile.value}
            </p>
            <p className="mt-1.5 text-[12.5px] text-ink-3">{tile.note}</p>
          </div>
        ))}
      </div>

      {index.overdue.length > 0 && (
        <div className="callout callout-accent flex-wrap items-center">
          <TriangleAlert className="size-4 shrink-0 text-accent-strong" aria-hidden="true" />
          <p className="min-w-[14rem] flex-1 text-[14px] text-ink-2">
            <span className="font-semibold text-ink">{index.overdue.length} görev geride kaldı.</span> Yeniden planlarsan{' '}
            {formatLongDate(addDays(today, 1))} gününden itibaren dağıtılır.
          </p>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onShiftOverdue}>
            <Forward aria-hidden="true" />
            Yeniden planla
          </button>
        </div>
      )}

      {single && deadline && deadline.kind !== 'none' && deadline.kind !== 'incomplete' && (
        <div className={`callout ${deadline.kind === 'late' ? 'callout-accent' : 'callout-info'} flex-wrap items-center`}>
          {deadline.kind === 'late' ? (
            <TriangleAlert className="size-4 shrink-0 text-accent-strong" aria-hidden="true" />
          ) : (
            <CircleCheck className="size-4 shrink-0 text-forest" aria-hidden="true" />
          )}
          <p className="min-w-[14rem] flex-1 text-[14px] text-ink-2">
            {deadline.kind === 'late' ? (
              <>
                <span className="font-semibold text-ink">Hedefin {deadline.lateDays} gün gerisindesin.</span> Plan{' '}
                {formatLongDate(deadline.finishDate)} tarihinde bitiyor; hedefin {formatLongDate(deadline.targetEndDate)}.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">Hedefe yetişiyorsun.</span> Plan {formatLongDate(deadline.finishDate)} tarihinde
                bitiyor{deadline.spareDays > 0 ? `, hedeften ${deadline.spareDays} gün önce` : ''}.
              </>
            )}
          </p>
          {deadline.kind === 'late' && (
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => onEditTempo(single.camp.id)}>
              <Gauge aria-hidden="true" />
              Tempoyu düzenle
            </button>
          )}
        </div>
      )}

      {single ? (
        <PlanIssues
          issues={single.issues}
          prefs={single.prefs}
          camps={camps}
          headingId="plan-issues"
          onEditTempo={() => onEditTempo(single.camp.id)}
        />
      ) : (
        scope.kind === 'all' &&
        scope.camps.map(({ camp, result }) => (
          <PlanIssues
            key={camp.id}
            issues={result.issues}
            prefs={result.preferences}
            camps={camps}
            campName={camp.name}
            headingId={`plan-issues-${camp.id}`}
            onEditTempo={() => onEditTempo(camp.id)}
          />
        ))
      )}

      {scope.kind === 'all' && <CampRows overviews={scope.camps} today={today} onEditTempo={onEditTempo} />}

      <section className="card" aria-labelledby="progress-camps">
        <h2 id="progress-camps" className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink">
          Branşlara göre
        </h2>
        <ul>
          {[...camps.values()].map(info => {
            const progress = campProgress(info.camp.id, index);
            const campName = campOfBranch.get(info.camp.id);
            return (
              <li key={info.camp.id} className="border-t border-line px-5 py-4 first:border-t-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <SubjectDot color={info.color.solid} />
                  <p className="min-w-0 flex-1 truncate font-semibold text-ink">{info.camp.subject}</p>
                  <KindBadge kind={info.kind} />
                  <p className="tnum text-[13px] font-semibold text-ink-2">
                    {progress.done}/{progress.total}
                  </p>
                </div>
                <div className="mt-2.5">
                  <Meter value={progress.done} max={progress.total} label={`${info.camp.subject} ilerlemesi`} color={info.color.solid} />
                </div>
                <p className="tnum mt-2 text-[12.5px] text-ink-3">
                  {campName && <span className="font-semibold text-ink-2">{campName} · </span>}
                  {info.camp.title}
                  {progress.remainingMinutes > 0
                    ? ` · ${formatMinutes(progress.remainingMinutes)} kaldı · bitiş ${progress.finishDate ? formatShortDate(progress.finishDate) : '—'}`
                    : progress.total > 0
                      ? ' · tamamlandı'
                      : ' · video yok'}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {weeks.length > 0 && (
        <section className="card" aria-labelledby="progress-weeks">
          <h2 id="progress-weeks" className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink">
            Haftalara göre
          </h2>
          <ul>
            {weeks.map(week => {
              const current = week.monday === thisMonday;
              const past = week.monday < thisMonday;
              return (
                <li key={week.monday} className="border-t border-line first:border-t-0">
                  <button
                    type="button"
                    onClick={() => onOpenWeek(week.monday)}
                    className="grid w-full grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-left hover:bg-paper sm:grid-cols-[10rem_minmax(0,1fr)_auto]"
                  >
                    <span className="min-w-0 text-[13.5px] text-ink">
                      <span className="block truncate font-medium">
                        {formatShortDate(week.monday)} – {formatShortDate(addDays(week.monday, 6))}
                      </span>
                      {current && <span className="chip chip-today mt-1">Bu hafta</span>}
                    </span>
                    <Meter
                      value={week.done}
                      max={week.planned}
                      label={`${formatShortDate(week.monday)} haftası`}
                      color={past && week.done < week.planned ? 'var(--color-accent)' : undefined}
                    />
                    <span className="tnum text-right text-[13px] text-ink-2">
                      <span className="font-semibold text-ink">{week.done}</span>/{week.planned}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
