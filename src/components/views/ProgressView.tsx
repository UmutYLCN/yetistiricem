import { CircleCheck, Forward, Gauge, TriangleAlert } from 'lucide-react';
import type { RoadmapStats, StudyCamp, UserPreferences } from '../../types';
import type { CampOverview } from '../../lib/allCamps';
import type { ProgressInsights } from '../../lib/insights';
import type { ScheduleIssue } from '../../lib/engine';
import { addDays, assessDeadline, diffDays, formatDateKey } from '../../lib/engine';
import {
  formatHours,
  formatLongDate,
  formatMinutes,
  formatPercent,
  formatShortDate,
  dateLocale,
  startOfWeek,
} from '../../lib/format';
import type { CampInfo, PlanIndex, WeekOverview } from '../../lib/planView';
import { campProgress } from '../../lib/planView';
import { PageHeader } from '../layout/PageHeader';
import { CommitmentGauge } from '../progress/CommitmentGauge';
import { PostponeInsights } from '../progress/PostponeInsights';
import { StreakCard } from '../progress/StreakCard';
import { StudyHeatmap } from '../progress/StudyHeatmap';
import { KindBadge, Meter, SubjectDot } from '../ui/Bits';
import { msg, translateTemplate } from '../../lib/messages';


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
  /** Activity, streak, commitment and postponements of the camps shown. */
  insights: ProgressInsights;
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
          {campName
            ? translateTemplate('{name}: planla ilgili dikkat edilecekler', { name: campName })
            : msg("Planla ilgili dikkat edilecekler")}
        </h2>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {noStudyDays && noStudyDays.kind === 'no-study-days' && (
            <li>
              {msg("\n              Haftada hiç çalışma günü yok; ")}{noStudyDays.unscheduledCount} {msg(" video planlanamadı.")}{msg(" ")}
              <button type="button" className="font-semibold text-forest underline" onClick={onEditTempo}>
                {msg("\n                Çalışma günü seç\n              ")}</button>
            </li>
          )}
          {unassigned.map(issue => (
            <li key={issue.playlistId}>
              {camps.get(issue.playlistId)?.camp.subject ?? msg("Bir branş")} {msg(" hiçbir güne yerleşmemiş; ")}{issue.unscheduledCount} {msg(" videosu\n              planda yok.")}{msg(" ")}
              <button type="button" className="font-semibold text-forest underline" onClick={onEditTempo}>
                {msg("\n                Günlere yerleştir\n              ")}</button>
            </li>
          ))}
          {oversized.length > 0 && (
            <li>
              {oversized.length} {msg(" video günlük çalışma sürenden (")}{formatMinutes(prefs.dailyStudyHours * 60)}{msg(") uzun; her biri\n              tek başına bir güne yerleştirildi.\n            ")}</li>
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
        {msg("\n        Kamplara göre\n      ")}</h2>
      <ul>
        {overviews.map(({ camp, result, stats, deadline }) => {
          const finished = stats.totalVideos > 0 && stats.completedVideos === stats.totalVideos;
          const prefs = result.preferences;
          const start = prefs.startDate > today
            ? translateTemplate('{date} tarihinde başlıyor', { date: formatShortDate(prefs.startDate) })
            : translateTemplate('{date} başladı', { date: formatShortDate(prefs.startDate) });
          const summary = finished
            ? translateTemplate('Tüm videolar tamamlandı · günlük hedef {goal} · {start}', {
                goal: formatMinutes(prefs.dailyStudyHours * 60),
                start,
              })
            : translateTemplate('{remaining} kaldı · bitiş {finish} · günlük hedef {goal} · {start}', {
                remaining: formatHours(stats.totalMinutes),
                finish: formatShortDate(stats.estimatedFinishDate),
                goal: formatMinutes(prefs.dailyStudyHours * 60),
                start,
              });
          return (
            <li key={camp.id} className="border-t border-line px-5 py-4 first:border-t-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="min-w-0 flex-1 font-semibold break-words text-ink">{camp.name}</p>
                <p className="tnum text-[13px] font-semibold text-ink-2">
                  {stats.completedVideos}{msg("/")}{stats.totalVideos}
                </p>
              </div>
              <div className="mt-2.5">
                <Meter
                  value={stats.completedVideos}
                  max={stats.totalVideos}
                  label={translateTemplate('{subject} ilerlemesi', { subject: camp.name })}
                />
              </div>
              <p className="tnum mt-2 text-[12.5px] text-ink-3">
                {summary}
              </p>
              {deadline && deadline.kind !== 'none' && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <p
                    className={`tnum text-[13px] font-semibold ${
                      deadline.kind === 'on-track' ? 'text-forest' : deadline.kind === 'late' ? 'text-accent-strong' : 'text-warn'
                    }`}
                  >
                    {deadline.kind === 'late'
                      ? translateTemplate('Hedefin {days} gün gerisinde (hedef {date})', {
                          days: deadline.lateDays,
                          date: formatShortDate(deadline.targetEndDate),
                        })
                      : deadline.kind === 'on-track'
                        ? translateTemplate('Yetişir: hedef {date}', { date: formatShortDate(deadline.targetEndDate) })
                        : translateTemplate('{count} video planda yok; hedef {date}', {
                            count: deadline.unscheduledCount,
                            date: formatShortDate(deadline.targetEndDate),
                          })}
                  </p>
                  {deadline.kind !== 'on-track' && (
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => onEditTempo(camp.id)}>
                      <Gauge aria-hidden="true" />
                      {msg("\n                      Tempoyu düzenle\n                    ")}</button>
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

export function ProgressView({ stats, today, index, camps, weeks, scope, insights, onShiftOverdue, onOpenWeek, onEditTempo }: Props) {
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
    subtitle = translateTemplate(
      single.prefs.startDate > today ? 'Plan {date} tarihinde başlıyor' : 'Plan {date} tarihinde başladı',
      { date: formatLongDate(single.prefs.startDate) },
    );
  } else {
    const all = scope.kind === 'all' ? scope.camps : [];
    const first = all.map(o => o.result.preferences.startDate).sort()[0];
    subtitle = first
      ? translateTemplate(
          first > today
            ? '{count} kamp birlikte · ilk kamp {date} tarihinde başlıyor'
            : '{count} kamp birlikte · ilk kamp {date} tarihinde başladı',
          { count: all.length, date: formatLongDate(first) },
        )
      : translateTemplate('{count} kamp birlikte', { count: all.length });
  }

  const tiles = [
    {
      label: 'Tamamlanan',
      value: formatPercent(stats.progressPercent),
      note: translateTemplate('{done} / {total} video', { done: stats.completedVideos, total: stats.totalVideos }),
    },
    {
      label: 'Kalan çalışma',
      value: finished ? '—' : formatHours(stats.totalMinutes),
      note: translateTemplate('{count} çalışma günü', { count: stats.daysRemaining }),
    },
    {
      label: 'Tahmini bitiş',
      value: finished ? msg('Bitti') : formatDateKey(stats.estimatedFinishDate, undefined, dateLocale()),
      note: finished
        ? 'Tüm videolar tamam'
        : daysLeft > 0
          ? translateTemplate('{count} gün sonra', { count: daysLeft })
          : daysLeft === 0
            ? 'Bugün'
            : 'Geride kalan görevler var',
    },
    {
      label: 'Geciken',
      value: String(index.overdue.length),
      note: index.overdue.length > 0 ? 'geçmiş günlerden' : 'Geride kalan yok',
      overdue: index.overdue.length > 0,
    },
  ];

  return (
    <div className="mx-auto max-w-[920px] space-y-5">
      <PageHeader title={msg("İlerleme")} subtitle={subtitle} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(tile => (
          <div key={tile.label} className="card min-w-0 p-4 sm:p-5">
            <p className="eyebrow">{msg(tile.label)}</p>
            <p className={`font-display tnum mt-2 text-[30px] leading-none ${tile.overdue ? 'text-danger' : 'text-ink'}`}>
              {tile.value}
            </p>
            <p className="mt-1.5 text-[12.5px] text-ink-3">{msg(tile.note)}</p>
          </div>
        ))}
      </div>

      {index.overdue.length > 0 && (
        <div className="callout callout-danger flex-wrap items-center">
          <TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
          <p className="min-w-[14rem] flex-1 text-[14px] text-ink-2">
            <span className="font-semibold text-ink">
              {translateTemplate('{count} görev geride kaldı.', { count: index.overdue.length })}
            </span>{' '}
            {translateTemplate('Ritmini güncellersen {date} gününden itibaren dağıtılır.', {
              date: formatLongDate(addDays(today, 1)),
            })}
          </p>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onShiftOverdue}>
            <Forward aria-hidden="true" />
            {msg("\n            Ritmi güncelle\n          ")}</button>
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
                <span className="font-semibold text-ink">
                  {translateTemplate('Hedefin {days} gün gerisindesin.', { days: deadline.lateDays })}
                </span>{' '}
                {translateTemplate('Plan {finish} tarihinde bitiyor; hedefin {target}.', {
                  finish: formatLongDate(deadline.finishDate),
                  target: formatLongDate(deadline.targetEndDate),
                })}
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">{msg("Panik yok, yetişir.")}</span>{' '}
                {deadline.spareDays > 0
                  ? translateTemplate('Plan {finish} tarihinde bitiyor, hedeften {days} gün önce.', {
                      finish: formatLongDate(deadline.finishDate),
                      days: deadline.spareDays,
                    })
                  : translateTemplate('Plan {finish} tarihinde bitiyor.', {
                      finish: formatLongDate(deadline.finishDate),
                    })}
              </>
            )}
          </p>
          {deadline.kind === 'late' && (
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => onEditTempo(single.camp.id)}>
              <Gauge aria-hidden="true" />
              {msg("\n              Tempoyu düzenle\n            ")}</button>
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

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18.5rem)]">
        <StudyHeatmap heatmap={insights.heatmap} today={today} undated={insights.undated} since={insights.since} />
        <StreakCard streak={insights.streak} chain={insights.chain} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <CommitmentGauge commitment={insights.commitment} />
        <PostponeInsights analysis={insights.postpones} camps={camps} />
      </div>

      {scope.kind === 'all' && <CampRows overviews={scope.camps} today={today} onEditTempo={onEditTempo} />}

      <section className="card" aria-labelledby="progress-camps">
        <h2 id="progress-camps" className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink">
          {msg("\n          Branşlara göre\n        ")}</h2>
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
                    {progress.done}{msg("/")}{progress.total}
                  </p>
                </div>
                <div className="mt-2.5">
                  <Meter
                    value={progress.done}
                    max={progress.total}
                    label={translateTemplate('{subject} ilerlemesi', { subject: info.camp.subject })}
                    color={info.color.solid}
                  />
                </div>
                <p className="tnum mt-2 text-[12.5px] text-ink-3">
                  {campName && <span className="font-semibold text-ink-2">{campName} {msg(" · ")}</span>}
                  {info.camp.title}
                  {progress.remainingMinutes > 0
                    ? ` · ${translateTemplate('{remaining} kaldı · bitiş {finish}', {
                        remaining: formatMinutes(progress.remainingMinutes),
                        finish: progress.finishDate ? formatShortDate(progress.finishDate) : '—',
                      })}`
                    : progress.total > 0
                      ? msg(" · tamamlandı")
                      : msg(" · video yok")}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {weeks.length > 0 && (
        <section className="card" aria-labelledby="progress-weeks">
          <h2 id="progress-weeks" className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink">
            {msg("\n            Haftalara göre\n          ")}</h2>
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
                        {formatShortDate(week.monday)} {msg(" – ")}{formatShortDate(addDays(week.monday, 6))}
                      </span>
                      {current && <span className="chip chip-today mt-1">{msg("Bu hafta")}</span>}
                    </span>
                    <Meter
                      value={week.done}
                      max={week.planned}
                      label={`${formatShortDate(week.monday)} haftası`}
                      color={past && week.done < week.planned ? 'var(--color-danger)' : undefined}
                    />
                    <span className="tnum text-right text-[13px] text-ink-2">
                      <span className="font-semibold text-ink">{week.done}</span>{msg("/")}{week.planned}
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
