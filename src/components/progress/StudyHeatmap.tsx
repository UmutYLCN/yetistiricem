import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Info } from 'lucide-react';
import type { HeatCell, Heatmap } from '../../lib/insights';
import { addDays, formatDateKey } from '../../lib/engine';
import { LONG_WEEKDAYS, SHORT_WEEKDAYS, WEEK_ORDER, formatHours, formatLongDate, formatMinutes } from '../../lib/format';

interface Props {
  heatmap: Heatmap;
  today: string;
  /** Completed videos with no recorded day (ticked before dates were kept). */
  undated: number;
  since: string;
}

/** "24 Ekim Salı: 3 video (1 sa 25 dk)" */
function describeCell(cell: HeatCell): string {
  const day = formatDateKey(cell.date, { day: 'numeric', month: 'long', weekday: 'long' });
  if (cell.future) return `${day}: henüz gelmedi`;
  if (cell.count === 0) return `${day}: çalışma yok`;
  return `${day}: ${cell.count} video (${formatMinutes(cell.minutes)})`;
}

/** Month names over the columns where a new month begins. */
function monthLabels(weeks: HeatCell[][]): (string | null)[] {
  return weeks.map((week, w) => {
    const month = week[6].date.slice(0, 7);
    if (w > 0 && month === weeks[w - 1][6].date.slice(0, 7)) return null;
    return formatDateKey(week[6].date, { month: 'short' });
  });
}

interface Tip {
  text: string;
  x: number;
  y: number;
  align: 'start' | 'center' | 'end';
}

/**
 * GitHub-style activity grid of the last weeks: one square per day, greener
 * with more study minutes. Arrow keys move between days; hovering or focusing
 * a day shows what was done.
 */
export function StudyHeatmap({ heatmap, today, undated, since }: Props) {
  const { weeks } = heatmap;
  const boxRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(today);
  const [tip, setTip] = useState<Tip | null>(null);
  const cells = new Map(weeks.flat().map(cell => [cell.date, cell]));
  const months = monthLabels(weeks);

  const showTip = (cell: HeatCell, target: HTMLElement) => {
    const box = boxRef.current;
    if (!box) return;
    const outer = box.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const x = rect.left - outer.left + rect.width / 2;
    setTip({ text: describeCell(cell), x, y: rect.top - outer.top, align: x < 90 ? 'start' : x > outer.width - 90 ? 'end' : 'center' });
  };

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    let next: string | null = null;
    if (event.key in step) next = addDays(active, step[event.key]);
    else if (event.key === 'Home') next = heatmap.from;
    else if (event.key === 'End') next = today;
    if (next === null) return;
    event.preventDefault();
    if (next < heatmap.from || next > today) return;
    setActive(next);
    boxRef.current?.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus();
  };

  const tipStyle: CSSProperties | undefined = tip
    ? {
        left: tip.x,
        top: tip.y,
        translate: `${tip.align === 'start' ? '-12px' : tip.align === 'end' ? 'calc(-100% + 12px)' : '-50%'} calc(-100% - 8px)`,
      }
    : undefined;

  return (
    <section className="card @container min-w-0 p-5" aria-labelledby="progress-heatmap">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="progress-heatmap" className="text-[15px] font-semibold text-ink">
          Çalışma haritası
        </h2>
        <p className="text-[12.5px] text-ink-3">Son {weeks.length} hafta</p>
      </div>
      {heatmap.activeDays === 0 && <p className="mt-1 text-[13px] text-ink-2">Tamamladığın her görev, o günün karesini yeşile boyar.</p>}

      <div className="mt-4 grid items-end gap-x-8 gap-y-4 @lg:grid-cols-[minmax(0,1fr)_auto]">
      <div ref={boxRef} className="heatmap" style={{ ['--weeks' as string]: weeks.length }} onMouseLeave={() => setTip(null)}>
        <div className="heat-row" aria-hidden="true">
          <span />
          {months.map((label, w) => (
            <span key={weeks[w][0].date} className="heat-label overflow-visible">
              {label}
            </span>
          ))}
        </div>
        <div role="grid" aria-label={`Son ${weeks.length} haftanın çalışma haritası`} onKeyDown={move} onBlur={() => setTip(null)}>
          {WEEK_ORDER.map((dow, row) => (
            <div key={dow} role="row" className="heat-row">
              <span role="rowheader" className="heat-label">
                <span aria-hidden="true">{row % 2 === 0 && row < 6 ? SHORT_WEEKDAYS[dow] : ''}</span>
                <span className="visually-hidden">{LONG_WEEKDAYS[dow]}</span>
              </span>
              {weeks.map(week => {
                const cell = week[row];
                return (
                  <div
                    key={cell.date}
                    role="gridcell"
                    data-date={cell.date}
                    data-level={cell.level}
                    data-future={cell.future || undefined}
                    data-today={cell.date === today || undefined}
                    className="heat-cell"
                    tabIndex={cell.date === active ? 0 : -1}
                    aria-label={describeCell(cell)}
                    onMouseEnter={event => showTip(cell, event.currentTarget)}
                    onFocus={event => {
                      setActive(cell.date);
                      showTip(cell, event.currentTarget);
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {tip && (
          <div className="heat-tip tnum" style={tipStyle} aria-hidden="true">
            {tip.text}
          </div>
        )}
      </div>
      <dl className="tnum grid grid-cols-3 gap-3 @lg:grid-cols-1 @lg:gap-4">
        {[
          { label: 'Aktif gün', value: String(heatmap.activeDays) },
          { label: 'Video', value: String(heatmap.videos) },
          { label: 'Çalışma', value: formatHours(heatmap.minutes) },
        ].map(stat => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-[12px] text-ink-3">{stat.label}</dt>
            <dd className="font-display mt-0.5 text-[22px] leading-none text-ink">{stat.value}</dd>
          </div>
        ))}
      </dl>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5 text-[11.5px] text-ink-3" aria-hidden="true">
          Az
          {[0, 1, 2, 3, 4].map(level => (
            <span key={level} className="heat-cell size-3" data-level={level} />
          ))}
          Çok
        </div>
        {cells.get(today)?.count ? (
          <p className="text-[12.5px] font-semibold text-forest">Bugün {cells.get(today)?.count} video</p>
        ) : null}
      </div>

      {undated > 0 && (
        <p className="mt-3 flex items-start gap-1.5 border-t border-line pt-3 text-[12.5px] text-ink-3">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Tamamlanma günleri {formatLongDate(since)} tarihinden beri kaydediliyor; daha önce işaretlediğin {undated} video haritada
            yer almıyor.
          </span>
        </p>
      )}
    </section>
  );
}
