import type { Commitment } from '../../lib/insights';
import { formatLongDate, formatPercent } from '../../lib/format';
import { msg, translateTemplate } from '../../lib/messages';


type Band = { label: string; stroke: string; chip: string };

function bandOf(score: number): Band {
  if (score >= 80) return { label: 'Sözünün arkasındasın', stroke: 'stroke-forest', chip: 'chip-forest' };
  if (score >= 50) return { label: 'İyi gidiyor', stroke: 'stroke-warn', chip: 'chip-warn' };
  return { label: 'Toparlanma zamanı', stroke: 'stroke-danger', chip: 'chip-danger' };
}

// A half circle from left to right; `pathLength` lets the value arc use percents.
const ARC = 'M 16 100 A 84 84 0 0 1 184 100';

/** Sorumluluk skoru: tasks done on their planned day against every task that fell due, as a dial. */
export function CommitmentGauge({ commitment }: { commitment: Commitment }) {
  const { score, onTime, measured, since } = commitment;
  const band = score === null ? null : bandOf(score);

  return (
    <section className="card flex min-w-0 flex-col p-5" aria-labelledby="progress-commitment">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="progress-commitment" className="text-[15px] font-semibold text-ink">
          {msg("\n          Sorumluluk skoru\n        ")}</h2>
        {band && <span className={`chip ${band.chip}`}>{msg(band.label)}</span>}
      </div>
      <p className="mt-1 text-[13px] text-ink-2">{msg("Görevlerin ne kadarını planladığın günde bitirdin?")}</p>

      <div
        className="relative mx-auto mt-4 w-full max-w-[240px]"
        {...(score === null
          ? {}
          : {
              role: 'meter',
              'aria-label': msg('Sorumluluk skoru'),
              'aria-valuemin': 0,
              'aria-valuemax': 100,
              'aria-valuenow': score,
              'aria-valuetext': translateTemplate('Skor {percent}; {measured} görevden {onTime} tanesi zamanında tamamlandı', {
                percent: formatPercent(score),
                onTime,
                measured,
              }),
            })}
      >
        <svg viewBox="0 0 200 112" className="block w-full" aria-hidden="true">
          <path d={ARC} className="stroke-sunk" fill="none" strokeWidth={14} strokeLinecap="round" />
          {band && score !== null && score > 0 && (
            <path
              d={ARC}
              className={`gauge-value ${band.stroke}`}
              fill="none"
              strokeWidth={14}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${score} 100`}
            />
          )}
        </svg>
        <p className="absolute inset-x-0 bottom-0 text-center">
          <span className="font-display tnum block text-[38px] leading-none text-ink">{score === null ? msg("—") : formatPercent(score)}</span>
        </p>
      </div>

      {score === null ? (
        <p className="mt-4 text-center text-[13px] text-ink-2">
          {msg("\n          Henüz ölçülecek görev yok. Planladığın günde bitirdiğin her görev skoru oluşturur.\n        ")}</p>
      ) : (
        <p className="tnum mt-4 text-center text-[13.5px] text-ink-2">
          <span className="font-semibold text-ink">
            {onTime} {msg(" / ")}{measured}
          </span>{msg(" ")}
          {msg("\n          görev planlandığı günde bitti\n        ")}</p>
      )}
      <p className="mt-auto pt-4 text-[12px] leading-relaxed text-ink-3">
        {msg("\n        Ertelenen ya da gününden sonra biten görevler skoru düşürür; bugünün açık görevleri henüz sayılmaz. Ölçüm")}{msg(" ")}
        {formatLongDate(since)} {msg(" tarihinden beri.\n      ")}</p>
    </section>
  );
}
