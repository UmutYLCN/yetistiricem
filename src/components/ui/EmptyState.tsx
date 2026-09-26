import type { ReactNode } from 'react';

export type EmptyTone = 'neutral' | 'forest' | 'accent';

/** An empty state's icon on a raised tile, optionally with faint rings behind it. */
export function FeaturedIcon({
  icon,
  tone = 'neutral',
  size = 'md',
  rings = true,
}: {
  icon: ReactNode;
  tone?: EmptyTone;
  size?: 'sm' | 'md';
  rings?: boolean;
}) {
  return (
    <span
      className={`featured-icon ${size === 'sm' ? 'featured-icon-sm' : ''} ${tone === 'neutral' ? '' : `featured-icon-${tone}`}`}
      aria-hidden="true"
    >
      {rings && (
        <svg className="featured-icon-rings" viewBox="0 0 200 200" fill="none" stroke="currentColor">
          <circle cx="100" cy="100" r="34" />
          <circle cx="100" cy="100" r="54" />
          <circle cx="100" cy="100" r="74" />
        </svg>
      )}
      <span className="featured-icon-tile">{icon}</span>
    </span>
  );
}

interface EmptyStateProps {
  /** An illustration (decorative). Without one, `icon` shows as a featured icon. */
  art?: ReactNode;
  icon?: ReactNode;
  tone?: EmptyTone;
  title: string;
  /** A line of help under the title. */
  children?: ReactNode;
  actions?: ReactNode;
  footnote?: ReactNode;
  /** `sm` for small containers such as a day card. */
  size?: 'md' | 'sm';
  className?: string;
}

/** A centred empty state: a picture, the title, a line of help and what to do next. */
export function EmptyState({ art, icon, tone, title, children, actions, footnote, size = 'md', className = '' }: EmptyStateProps) {
  const small = size === 'sm';
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {art ?? (icon && <FeaturedIcon icon={icon} tone={tone} size={small ? 'sm' : 'md'} />)}
      {/* Positioned, so the text paints over the icon's rings. */}
      <div className={`relative flex flex-col items-center ${art ? (small ? 'mt-4' : 'mt-6') : icon ? (small ? 'mt-6' : 'mt-8') : ''}`}>
        <p className={small ? 'text-[15px] font-semibold text-ink' : 'font-display text-[19px] leading-snug text-ink'}>{title}</p>
        {children && (
          <p className={`mt-1.5 leading-relaxed ${small ? 'max-w-[15rem] text-[13px] text-ink-3' : 'max-w-sm text-[14px] text-ink-2'}`}>{children}</p>
        )}
        {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
        {footnote && <p className="mt-3 max-w-sm text-[12.5px] text-ink-3">{footnote}</p>}
      </div>
    </div>
  );
}
