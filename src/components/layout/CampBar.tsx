import { Gauge } from 'lucide-react';
import type { StudyCamp } from '../../types';
import { tempoSummary } from '../../lib/planView';

/** The open camp and its tempo, above the plan screens. */
export function CampBar({ camp, onEditTempo }: { camp: StudyCamp; onEditTempo: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-line bg-card px-3.5 py-2.5 sm:mb-5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink">
          <span className="eyebrow mr-2 align-[1px]">Kamp</span>
          {camp.name}
        </p>
        <p className="truncate text-[12.5px] text-ink-3">{tempoSummary(camp.schedule)}</p>
      </div>
      <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={onEditTempo}>
        <Gauge aria-hidden="true" />
        Tempoyu düzenle
      </button>
    </div>
  );
}
