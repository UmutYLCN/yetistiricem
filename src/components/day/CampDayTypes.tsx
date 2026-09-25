import { CircleCheck, Flag, Forward, Moon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CampDaySummary, CampLabel } from '../../lib/allCamps';

/** A camp's day when it has no tasks on it: its own day type. */
function offDay(part: CampDaySummary): { icon: LucideIcon; label: string; short: string } {
  if (part.kind === 'rest') return { icon: Moon, label: 'Dinlenme günü', short: 'Dinlenme' };
  if (part.kind === 'mock') return { icon: Flag, label: 'Deneme günü', short: 'Deneme' };
  if (part.free) return { icon: CircleCheck, label: 'Bu günün branşları bitti', short: 'Branşlar bitti' };
  return { icon: Forward, label: 'Görevler ileri taşındı', short: 'Taşındı' };
}

/** "Tüm Kamplar" day list: one row per camp that does not study that day, with its day type. */
export function CampDayTypeRows({ parts, labels }: { parts: CampDaySummary[]; labels: Map<string, CampLabel> }) {
  if (parts.length === 0) return null;
  return (
    <ul aria-label="Görevi olmayan kamplar">
      {parts.map(part => {
        const { icon: Icon, label } = offDay(part);
        return (
          <li key={part.campId} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 sm:px-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunk text-ink-2">
              <Icon className={`size-4 ${part.kind === 'mock' ? 'text-accent' : ''}`} aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 text-[14px] text-ink-2">
              <span className="font-semibold break-words text-ink">{labels.get(part.campId)?.name ?? 'Kamp'}</span>
              <span className="block text-[13px]">{label}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** "Tüm Kamplar" week card: a chip per camp without tasks that day ("AYT · Dinlenme"). */
export function CampDayTypeChips({ parts, labels }: { parts: CampDaySummary[]; labels: Map<string, CampLabel> }) {
  return (
    <>
      {parts.map(part => {
        const { icon: Icon, short, label } = offDay(part);
        const name = labels.get(part.campId)?.name ?? 'Kamp';
        return (
          <span key={part.campId} className={`chip max-w-full ${part.kind === 'mock' ? 'chip-today' : ''}`} title={`${name}: ${label}`}>
            <Icon aria-hidden="true" />
            <span className="truncate">
              {name} · {short}
            </span>
          </span>
        );
      })}
    </>
  );
}
