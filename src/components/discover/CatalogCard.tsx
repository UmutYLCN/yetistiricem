import type { CatalogEntry } from '../../lib/catalog';
import { publishedLabel } from '../../lib/catalog';
import { formatHours } from '../../lib/format';
import { resolveColor } from '../../lib/subjects';
import { AuthorBadge } from './AuthorBadge';

const SHOWN_SUBJECTS = 4;

export function CatalogCard({
  entry,
  today,
  own,
  onOpen,
}: {
  entry: CatalogEntry;
  today: string;
  own: boolean;
  onOpen: (id: string) => void;
}) {
  const more = entry.subjects.length - SHOWN_SUBJECTS;
  return (
    <li>
      <button type="button" className="catalog-card" onClick={() => onOpen(entry.id)}>
        <span className="flex items-start gap-2">
          <span className="font-display min-w-0 flex-1 text-[17px] leading-snug break-words text-ink">{entry.name}</span>
          {own && <span className="chip chip-forest shrink-0">Senin</span>}
        </span>
        <span className="mt-2 flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
          <AuthorBadge name={entry.authorName} size="sm" />
          <span className="shrink-0 text-ink-3">· {publishedLabel(entry.createdAt, today)}</span>
        </span>
        {entry.description && <span className="mt-2.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{entry.description}</span>}
        <span className="mt-3 flex flex-wrap gap-1.5">
          {entry.subjects.slice(0, SHOWN_SUBJECTS).map((subject) => (
            <span key={subject} className="chip">
              <span className="size-1.5 rounded-full" style={{ background: resolveColor(undefined, subject).solid }} aria-hidden="true" />
              {subject}
            </span>
          ))}
          {more > 0 && <span className="chip">+{more}</span>}
        </span>
        <span className="tnum mt-3 text-[12.5px] text-ink-3">
          {entry.branchCount} branş · {entry.videoCount} video · {formatHours(entry.totalMinutes)}
        </span>
      </button>
    </li>
  );
}
