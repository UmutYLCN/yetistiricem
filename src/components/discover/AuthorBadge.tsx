/** A publisher's name with an initial for an avatar. */
export function AuthorBadge({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initial = name.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        className={`grid shrink-0 place-items-center rounded-full bg-sunk font-semibold text-ink-2 ring-1 ring-line-strong ${
          size === 'sm' ? 'size-6 text-[11px]' : 'size-7 text-[12px]'
        }`}
        aria-hidden="true"
      >
        {initial}
      </span>
      <span className="min-w-0 truncate font-semibold text-ink">{name}</span>
    </span>
  );
}
