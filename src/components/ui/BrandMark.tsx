/** The app mark (also `public/favicon.svg`): a green check on a dark tile, with the orange "today" dot. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="#16171a" stroke="#2e3034" />
      <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#3ecf8e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.5" cy="24.5" r="3" fill="#ff8a3d" />
    </svg>
  );
}
