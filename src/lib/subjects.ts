// Subject colours. Camps store a palette key in `colorTag`; camps saved by
// older versions store a Tailwind class such as `bg-indigo-500`, which is
// mapped to the closest palette entry here. The values suit the dark theme:
// `solid` reads as text on cards (AA) and carries a dark check mark.

export interface SubjectColor {
  key: string;
  label: string;
  /** Dot, bar and accent colour. */
  solid: string;
  /** Quiet background tint. */
  soft: string;
}

export const PALETTE: SubjectColor[] = [
  { key: 'ink', label: 'Mürekkep', solid: '#8fa0f8', soft: '#212432' },
  { key: 'forest', label: 'Orman', solid: '#6fcf8a', soft: '#1c2b23' },
  { key: 'clay', label: 'Kil', solid: '#f2916c', soft: '#2f221f' },
  { key: 'ochre', label: 'Hardal', solid: '#e3b341', soft: '#2d2719' },
  { key: 'plum', label: 'Mürdüm', solid: '#cc9ae6', soft: '#292330' },
  { key: 'teal', label: 'Petrol', solid: '#3cc6c0', soft: '#15292a' },
  { key: 'rose', label: 'Gül', solid: '#f58ea7', soft: '#2f2227' },
  { key: 'olive', label: 'Zeytin', solid: '#b3c46a', soft: '#26291e' },
  { key: 'slate', label: 'Arduvaz', solid: '#9aa5b1', soft: '#222528' },
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
