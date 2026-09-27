import { X } from 'lucide-react';

const ROWS = [
  { tone: 'var(--color-study-indigo)', width: 72, time: '42:18' },
  { tone: 'var(--color-study-plum)', width: 58, time: '37:05' },
  { tone: 'var(--color-study-clay)', width: 66, time: '51:40' },
  { tone: 'var(--color-forest)', width: 48, time: '28:12' },
];

/**
 * While YouTube is read: a playlist window whose lessons arrive one by one
 * (decorative), what is happening, and a way to stop. Fills the composer, so
 * the student sees the next step without scrolling.
 */
export function FetchingStage({ title, detail, onCancel }: { title: string; detail: string; onCancel: () => void }) {
  return (
    <div className="fetch-stage" role="status" aria-live="polite">
      <div className="fetch-art" aria-hidden="true">
        <div className="fetch-window">
          <div className="fetch-window-bar">
            <span className="fetch-dot" />
            <span className="fetch-dot" />
            <span className="fetch-dot" />
            <span className="fetch-bar-title" />
          </div>
          <div className="fetch-progress">
            <span />
          </div>
          <ul className="fetch-rows">
            {ROWS.map((row, i) => (
              <li key={i} className="fetch-row" style={{ ['--i' as string]: i }}>
                <span className="fetch-thumb" style={{ background: `color-mix(in srgb, ${row.tone} 55%, var(--color-sunk))` }}>
                  <span className="fetch-play" />
                </span>
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="block h-2 rounded-full bg-ink-3/40" style={{ width: `${row.width}%` }} />
                  <span className="block h-1.5 w-1/3 rounded-full bg-ink-3/20" />
                </span>
                <span className="fetch-time">{row.time}</span>
              </li>
            ))}
          </ul>
        </div>
        <span className="fetch-orb fetch-orb-a" />
        <span className="fetch-orb fetch-orb-b" />
      </div>
      <p className="font-display mt-7 text-[19px] leading-tight text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[26rem] text-[13.5px] leading-relaxed text-ink-2">{detail}</p>
      <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={onCancel}>
        <X aria-hidden="true" />
        Vazgeç
      </button>
    </div>
  );
}
