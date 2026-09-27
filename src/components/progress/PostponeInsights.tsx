import { Forward } from 'lucide-react';
import type { PostponeAnalysis } from '../../lib/insights';
import { dateLocale, formatPercent, formatPercentShare } from '../../lib/format';
import type { CampInfo } from '../../lib/planView';
import { REASON_COPY, UNSPECIFIED_LABEL } from '../../lib/postpone';
import { SubjectDot } from '../ui/Bits';
import { REASON_ICONS } from '../camps/reasonIcons';
import { msg, translateTemplate } from '../../lib/messages';


/** "2,1" or "3" */
function formatRatio(ratio: number): string {
  return ratio.toLocaleString(dateLocale(), { maximumFractionDigits: 1 });
}

/** Why and where the student postpones: reason shares per shift, and the branch that is put off most. */
export function PostponeInsights({ analysis, camps }: { analysis: PostponeAnalysis; camps: Map<string, CampInfo> }) {
  const { events, reasons, topReason, branches, standout } = analysis;

  let branchLine: string | null = null;
  if (standout) {
    branchLine = Number.isFinite(standout.ratio)
      ? translateTemplate('{subject}, diğer branşlara göre {ratio} kat daha sık erteleniyor.', {
          subject: standout.subject,
          ratio: formatRatio(standout.ratio),
        })
      : translateTemplate('Ertelenen görevlerin hepsi {subject} branşından.', { subject: standout.subject });
  } else if (branches.length >= 2) {
    branchLine = msg('Ertelemeler branşlar arasında dengeli dağılıyor.');
  }

  return (
    <section className="card flex min-w-0 flex-col p-5" aria-labelledby="progress-postpones">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="progress-postpones" className="text-[15px] font-semibold text-ink">
          {msg("\n          Erteleme analizi\n        ")}</h2>
        {events > 0 && <span className="chip tnum">{translateTemplate('{count} erteleme', { count: events })}</span>}
      </div>

      {events === 0 ? (
        <div className="my-auto flex flex-col items-center py-6 text-center">
          <span className="grid size-11 place-items-center rounded-[13px] bg-sunk text-ink-3" aria-hidden="true">
            <Forward className="size-5" />
          </span>
          <p className="mt-3 font-semibold text-ink">{msg("Henüz erteleme yok.")}</p>
          <p className="mt-1 max-w-[18rem] text-[13px] text-ink-2">
            {msg("\n            Ritmini güncellerken nedenini seçersen, seni en çok neyin zorladığını burada görürsün.\n          ")}</p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[14.5px] leading-snug text-ink">
            {topReason ? (
              <>
                {translateTemplate('Ertelemelerinin {share} {reason} kaynaklı.', {
                  share: formatPercentShare(topReason.percent),
                  reason: msg(REASON_COPY[topReason.reason].phrase),
                })}
              </>
            ) : (
              msg('Ertelemelerinde neden belirtilmemiş. Bir sonraki taşımada nedenini seçersen dağılımı burada görürsün.')
            )}
          </p>

          <ul className="mt-4 space-y-3">
            {reasons.map(share => {
              const Icon = REASON_ICONS[share.reason];
              const top = share === topReason;
              const label = msg(share.reason === 'unspecified' ? UNSPECIFIED_LABEL : REASON_COPY[share.reason].label);
              return (
                <li key={share.reason}>
                  <div className="flex items-center gap-2 text-[13px]">
                    <Icon className={`size-4 shrink-0 ${top ? 'text-accent-strong' : 'text-ink-3'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-ink-2">{label}</span>
                    <span className="tnum shrink-0 font-semibold text-ink">{formatPercent(share.percent)}</span>
                    <span className="tnum w-6 shrink-0 text-right text-ink-3">{share.count}</span>
                  </div>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-sunk" aria-hidden="true">
                    <span
                      className={`block h-full rounded-full ${top ? 'bg-accent' : share.reason === 'unspecified' ? 'bg-line-strong' : 'bg-ink-3'}`}
                      style={{ width: `${share.percent}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>

          {branches.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="eyebrow">{msg("Branşlara göre")}</h3>
              {branchLine && <p className="mt-1.5 text-[13.5px] text-ink">{branchLine}</p>}
              <ul className="mt-2.5 space-y-1.5">
                {branches.slice(0, 4).map(branch => (
                  <li key={branch.subject} className="flex items-center gap-2 text-[13px]">
                    <SubjectDot color={camps.get(branch.playlistId)?.color.solid ?? 'var(--color-ink-3)'} />
                    <span className="min-w-0 flex-1 truncate text-ink-2">{branch.subject}</span>
                    <span className="tnum shrink-0 text-ink-3">
                      <span className="font-semibold text-ink">{branch.count}</span> {msg(" kez\n                    ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
