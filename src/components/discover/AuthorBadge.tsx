/** A round initial standing in for a person's picture. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initial = name.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
  const box = size === 'sm' ? 'size-6 text-[11px]' : size === 'md' ? 'size-7 text-[12px]' : 'size-8 text-[13px]';
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-sunk font-semibold text-ink-2 ring-1 ring-line-strong ${box}`} aria-hidden="true">
      {initial}
    </span>
  );
}

/** A publisher's name with an initial for an avatar. */
export function AuthorBadge({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name} size={size} />
      <span className="min-w-0 truncate font-semibold text-ink">{name}</span>
    </span>
  );
}
