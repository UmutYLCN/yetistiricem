import type { ReactNode } from 'react';
import { Heart } from 'lucide-react';
import { coverPhotoUrl } from '../../lib/catalogApi';
import { subjectColors } from '../../lib/subjects';
import { msg } from '../../lib/messages';


function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * An abstract picture of the camp: rows of lesson pills in its branches'
 * colours over a soft wash of them, drawn the same way every time for the
 * same camp. Decorative only.
 */
export function CampCover({ seed, subjects, rows = 3, className = '', children }: { seed: string; subjects: readonly string[]; rows?: number; className?: string; children?: ReactNode }) {
  const colors = subjectColors(subjects);
  const random = seeded(seed);
  const wash = [
    `radial-gradient(90% 120% at 0% 0%, color-mix(in srgb, ${colors[0]} 26%, transparent), transparent 62%)`,
    `radial-gradient(80% 120% at 100% 100%, color-mix(in srgb, ${colors[1 % colors.length]} 20%, transparent), transparent 64%)`,
    'var(--color-sunk)',
  ].join(', ');
  let pill = 0;
  return (
    <span className={`camp-cover ${className}`} style={{ background: wash }}>
      <span className="camp-cover-rows" aria-hidden="true">
        {Array.from({ length: rows }, (_, row) => {
          const count = 2 + Math.floor(random() * 3);
          return (
            <span key={row} className="camp-cover-row" style={{ marginLeft: `${Math.round(random() * 18)}%` }}>
              {Array.from({ length: count }, (_, i) => {
                const color = colors[pill++ % colors.length];
                return (
                  <span
                    key={i}
                    className="camp-cover-pill"
                    style={{
                      width: `${14 + Math.round(random() * 22)}%`,
                      background: `color-mix(in srgb, ${color} ${i === 0 && row === 0 ? 70 : 38}%, transparent)`,
                    }}
                  />
                );
              })}
            </span>
          );
        })}
      </span>
      {children}
    </span>
  );
}

/** A camp's cover: the author's photo when they chose one, otherwise the drawn cover. */
export function CoverImage({
  seed,
  subjects,
  cover,
  rows,
  className = '',
  children,
}: {
  seed: string;
  subjects: readonly string[];
  cover: string | null;
  rows?: number;
  className?: string;
  children?: ReactNode;
}) {
  const url = cover ? coverPhotoUrl(cover) : null;
  if (!url) {
    return (
      <CampCover seed={seed} subjects={subjects} rows={rows} className={className}>
        {children}
      </CampCover>
    );
  }
  return (
    <span className={`camp-cover bg-sunk ${className}`}>
      <img src={url} alt={msg("")} className="absolute inset-0 size-full object-cover" loading="lazy" decoding="async" draggable={false} />
      {children}
    </span>
  );
}

/** The heart that saves a camp for later, with how many saved it. */
export function SaveButton({
  saved,
  count,
  name,
  onToggle,
  variant = 'overlay',
}: {
  saved: boolean;
  count?: number;
  name: string;
  onToggle: () => void;
  variant?: 'overlay' | 'button';
}) {
  const label = saved ? `${name}: kaydedilenlerden çıkar` : `${name}: kaydet`;
  if (variant === 'button') {
    return (
      <button type="button" className={`btn btn-secondary w-full ${saved ? 'text-danger' : ''}`} aria-pressed={saved} aria-label={label} onClick={onToggle}>
        <Heart className={saved ? 'fill-current' : ''} aria-hidden="true" />
        {saved ? msg("Kaydedildi") : msg("Kaydet")}
        {count !== undefined && count > 0 && <span className="tnum text-ink-3">{msg("· ")}{count}</span>}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`save-heart ${saved ? 'is-saved' : ''}`}
      aria-pressed={saved}
      aria-label={label}
      onClick={event => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <Heart className={saved ? 'fill-current' : ''} aria-hidden="true" />
    </button>
  );
}
