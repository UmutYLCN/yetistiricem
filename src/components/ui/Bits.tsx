import type { ReactNode } from 'react';
import type { CampKind } from '../../lib/camps';
import { KIND_LABEL } from '../../lib/camps';

export function Meter({ value, max, label, color }: { value: number; max: number; label: string; color?: string }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      className="meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span style={{ width: `${ratio * 100}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

export function SubjectDot({ color, className = '' }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 shrink-0 rounded-full ${className}`}
      style={{ background: color }}
    />
  );
}

export function KindBadge({ kind }: { kind: CampKind }) {
  if (kind === 'manual') return null;
  const className = kind === 'demo-template' ? 'chip chip-demo' : 'chip chip-warn';
  return <span className={className}>{KIND_LABEL[kind]}</span>;
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-[13px] font-semibold tracking-wide text-ink-2 uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}
