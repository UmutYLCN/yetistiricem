// Subject colours. Camps store a palette key in `colorTag`; camps saved by
// older versions store a Tailwind class such as `bg-indigo-500`, which is
// mapped to the closest palette entry here. `solid`/`soft` are `var()`
// references onto the `--palette-<key>-solid/soft` tokens in src/index.css,
// which carry both a dark and a light value: `solid` reads as text on cards
// (AA) and carries a check mark in `--color-on-fill`, in either theme.

export interface SubjectColor {
  key: string;
  label: string;
  /** Dot, bar and accent colour. */
  solid: string;
  /** Quiet background tint. */
  soft: string;
}

export const PALETTE: SubjectColor[] = [
  { key: 'ink', label: 'Mürekkep', solid: 'var(--palette-ink-solid)', soft: 'var(--palette-ink-soft)' },
  { key: 'forest', label: 'Orman', solid: 'var(--palette-forest-solid)', soft: 'var(--palette-forest-soft)' },
  { key: 'clay', label: 'Kil', solid: 'var(--palette-clay-solid)', soft: 'var(--palette-clay-soft)' },
  { key: 'ochre', label: 'Hardal', solid: 'var(--palette-ochre-solid)', soft: 'var(--palette-ochre-soft)' },
  { key: 'plum', label: 'Mürdüm', solid: 'var(--palette-plum-solid)', soft: 'var(--palette-plum-soft)' },
  { key: 'teal', label: 'Petrol', solid: 'var(--palette-teal-solid)', soft: 'var(--palette-teal-soft)' },
  { key: 'rose', label: 'Gül', solid: 'var(--palette-rose-solid)', soft: 'var(--palette-rose-soft)' },
  { key: 'olive', label: 'Zeytin', solid: 'var(--palette-olive-solid)', soft: 'var(--palette-olive-soft)' },
  { key: 'slate', label: 'Arduvaz', solid: 'var(--palette-slate-solid)', soft: 'var(--palette-slate-soft)' },
];

const BY_KEY = new Map(PALETTE.map(c => [c.key, c]));

export const SUBJECTS = [
  'Matematik',
  'Geometri',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Türkçe',
  'Edebiyat',
  'Tarih',
  'Coğrafya',
  'Felsefe',
  'Din Kültürü',
  'İngilizce',
  'Diğer',
];

const SUBJECT_DEFAULTS: Record<string, string> = {
  Matematik: 'ink',
  Geometri: 'teal',
  Fizik: 'plum',
  Kimya: 'ochre',
  Biyoloji: 'forest',
  Türkçe: 'clay',
  Edebiyat: 'rose',
  Tarih: 'olive',
  Coğrafya: 'teal',
  Felsefe: 'slate',
  'Din Kültürü': 'olive',
  İngilizce: 'rose',
  Diğer: 'slate',
};

const LEGACY_TAILWIND: Record<string, string> = {
  indigo: 'ink',
  blue: 'ink',
  sky: 'teal',
  cyan: 'teal',
  teal: 'teal',
  emerald: 'forest',
  green: 'forest',
  lime: 'olive',
  yellow: 'ochre',
  amber: 'ochre',
  orange: 'clay',
  red: 'rose',
  rose: 'rose',
  pink: 'rose',
  purple: 'plum',
  violet: 'plum',
  fuchsia: 'plum',
  gray: 'slate',
  slate: 'slate',
  zinc: 'slate',
  neutral: 'slate',
  stone: 'slate',
};

export function defaultColorKey(subject: string): string {
  const known = SUBJECT_DEFAULTS[subject];
  if (known) return known;
  let hash = 0;
  for (const ch of subject) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length].key;
}

export function resolveColor(colorTag: string | undefined, subject: string): SubjectColor {
  if (colorTag) {
    const direct = BY_KEY.get(colorTag);
    if (direct) return direct;
    const legacy = /^bg-([a-z]+)-\d{2,3}$/.exec(colorTag);
    const mapped = legacy ? LEGACY_TAILWIND[legacy[1]] : undefined;
    if (mapped) return BY_KEY.get(mapped)!;
  }
  return BY_KEY.get(defaultColorKey(subject))!;
}

/** Each branch name's colour (Keşfet's covers and bars); a camp without branches gets the accent green. */
export function subjectColors(subjects: readonly string[]): string[] {
  const colors = subjects.map(subject => resolveColor(undefined, subject).solid);
  return colors.length > 0 ? colors : ['var(--color-forest)'];
}
