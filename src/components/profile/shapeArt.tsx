import type { ReactNode } from 'react';
import type { AvatarShape } from '../../lib/studentProfile';

interface ShapeArt {
  name: string;
  /** A role colour from `src/index.css`; the tile behind is a dark tint of it. */
  color: string;
  art: ReactNode;
}

const rays = (count: number, long: number, short: number) =>
  Array.from({ length: count }, (_, i) => {
    const h = i % 2 === 0 ? long : short;
    return <rect key={i} x={29.6} y={32 - h} width={4.8} height={h} rx={2.4} transform={`rotate(${(360 / count) * i} 32 32)`} />;
  });

/** The eight drawn pictures: soft abstract shapes, one colour each. */
export const SHAPE_ART: Record<AvatarShape, ShapeArt> = {
  'shape-1': { name: 'Kıvılcım', color: 'var(--color-study-clay)', art: <g>{rays(12, 21, 15)}</g> },
  'shape-2': {
    name: 'Çiçek',
    color: 'var(--color-study-plum)',
    art: (
      <g>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i - Math.PI / 2;
          return <circle key={i} cx={32 + Math.cos(a) * 11} cy={32 + Math.sin(a) * 11} r={8.5} />;
        })}
        <circle cx={32} cy={32} r={6} fill="var(--avatar-tile)" />
      </g>
    ),
  },
  'shape-3': {
    name: 'Kemer',
    color: 'var(--color-study-indigo)',
    art: (
      <g>
        <path d="M15 52V32a17 17 0 0 1 34 0v20h-9V32a8 8 0 0 0-16 0v20z" />
        <circle cx={32} cy={13} r={3.5} />
      </g>
    ),
  },
  'shape-4': {
    name: 'Dalga',
    color: 'var(--color-forest)',
    art: (
      <g fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round">
        <path d="M11 23c5.3-5 10.7-5 16 0s10.7 5 16 0 8-3.5 10-2.5" />
        <path d="M11 33c5.3-5 10.7-5 16 0s10.7 5 16 0 8-3.5 10-2.5" />
        <path d="M11 43c5.3-5 10.7-5 16 0s10.7 5 16 0 8-3.5 10-2.5" />
      </g>
    ),
  },
  'shape-5': {
    name: 'Halka',
    color: 'var(--color-warn)',
    art: (
      <g>
        <circle cx={32} cy={32} r={19} fill="none" stroke="currentColor" strokeWidth={4.5} />
        <circle cx={32} cy={32} r={10.5} fill="none" stroke="currentColor" strokeWidth={4.5} />
        <circle cx={32} cy={32} r={3.5} />
      </g>
    ),
  },
  'shape-6': {
    name: 'Yıldız',
    color: 'var(--color-accent)',
    art: <path d="M32 9c1.6 13.7 9.3 21.4 23 23-13.7 1.6-21.4 9.3-23 23-1.6-13.7-9.3-21.4-23-23 13.7-1.6 21.4-9.3 23-23z" />,
  },
  'shape-7': {
    name: 'Gün doğumu',
    color: 'var(--color-accent-strong)',
    art: (
      <g>
        <path d="M12 42a20 20 0 0 1 40 0z" />
        <rect x={10} y={46} width={44} height={4.5} rx={2.25} />
        <rect x={18} y={54} width={28} height={4.5} rx={2.25} />
      </g>
    ),
  },
  'shape-8': {
    name: 'Çakıl',
    color: 'var(--color-forest-strong)',
    art: (
      <g>
        <path d="M33 11c9 0 15 5.6 18.2 12.3 3.3 6.8 3.3 14.7-1.6 20.6-4.8 5.9-13.1 9.4-21 8.3-7.9-1-14.3-6.3-16.2-13.1-1.8-6.8.9-14.9 5.5-20.4C22.4 13.2 26.9 11 33 11z" />
        <circle cx={27} cy={29} r={3.6} fill="var(--avatar-tile)" />
        <circle cx={39} cy={29} r={3.6} fill="var(--avatar-tile)" />
      </g>
    ),
  },
};

