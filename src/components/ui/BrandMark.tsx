import { msg } from '../../lib/messages';
/**
 * The app mark (also `public/favicon.svg`): a clock ring swept almost all the
 * way round, a check inside, and the orange "today" dot where the ring meets
 * the top: the plan arrives on time. Yetişir.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="#16171a" stroke="#2e3034" />
      <path d="M20.5 8.21A9 9 0 1 1 10.21 9.11" fill="none" stroke="#3ecf8e" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11.9 16.3l3 3 5.6-6" fill="none" stroke="#3ecf8e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="7" r="2.4" fill="#ff8a3d" />
    </svg>
  );
}

/** The lowercase wordmark, with the full stop in the brand green. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-[-0.02em] text-ink ${className}`}>
      {msg("\n      yetişir")}<span className="text-forest">{msg(".")}</span>
    </span>
  );
}
