import { Heart } from 'lucide-react';
import type { CatalogEntry } from '../../lib/catalog';
import { diffDays, toDateKey } from '../../lib/engine';
import { formatHours } from '../../lib/format';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { CoverImage, SaveButton } from './CampCover';
import { msg } from '../../lib/messages';


/** Presentation-only examples have no real videos or duration totals to report. */
export type CatalogPreviewEntry = Pick<CatalogEntry, 'id' | 'name' | 'description' | 'author' | 'subjects' | 'tags' | 'cover' | 'saveCount' | 'createdAt'> & {
  preview: true;
};

/** Published within the last week. */
function isNew(createdAt: string, today: string) {
  const ago = diffDays(toDateKey(new Date(createdAt)), today);
  return Number.isFinite(ago) && ago <= 7;
}

/**
 * A published camp in Keşfet's grid: the cover as the card (a heart to save it
 * in the corner), then who made it, the name, its first tag and how many saved it.
 */
export function CatalogCard({
  entry,
  today,
  own,
  saved,
  onOpen,
  onToggleSave,
}: {
  entry: CatalogEntry | CatalogPreviewEntry;
  today: string;
  own: boolean;
  saved: boolean;
  onOpen: (id: string) => void;
  onToggleSave: (entry: CatalogEntry | CatalogPreviewEntry) => void;
}) {
  const stats = 'preview' in entry ? null : entry;
  const label = entry.tags[0] ? `#${entry.tags[0]}` : entry.subjects[0];
  const badge = own ? msg('Senin') : isNew(entry.createdAt, today) ? msg('Yeni') : null;
  return (
    <li className="relative min-w-0">
      <button type="button" className="catalog-item group" onClick={() => onOpen(entry.id)}>
        <CoverImage seed={entry.id} subjects={entry.subjects} cover={entry.cover} className="catalog-thumb">
          {badge && <span className="cover-badge absolute top-2.5 left-2.5">{badge}</span>}
          {stats && (
            <span className="cover-badge tnum absolute bottom-2.5 left-2.5">
              {stats.videoCount} {msg(" video · ")}{formatHours(stats.totalMinutes)}
            </span>
          )}
        </CoverImage>
        <span className="mt-2.5 flex min-w-0 items-center gap-2">
          <ProfileAvatar avatar={entry.author.avatar} name={entry.author.name} size={20} />
          <span className="min-w-0 truncate text-[13px] text-ink-2">{entry.author.name}</span>
        </span>
        <span className="mt-1 line-clamp-2 text-[15px] leading-snug font-semibold text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">
          {entry.name}
        </span>
        <span className="mt-1 flex min-w-0 items-center gap-3 text-[13px] text-ink-3">
          {label && <span className="min-w-0 truncate">{label}</span>}
          <span className="tnum inline-flex shrink-0 items-center gap-1">
            <Heart className="size-3.5" aria-hidden="true" />
            {entry.saveCount}
          </span>
        </span>
      </button>
      <span className="absolute top-2.5 right-2.5">
        <SaveButton saved={saved} name={entry.name} onToggle={() => onToggleSave(entry)} />
      </span>
    </li>
  );
}
