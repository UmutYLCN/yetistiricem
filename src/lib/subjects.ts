// Subject colours. Camps store a palette key in `colorTag`; camps saved by
// older versions store a Tailwind class such as `bg-indigo-500`, which is
// mapped to the closest palette entry here.

export interface SubjectColor {
  key: string;
  label: string;
  /** Dot, bar and accent colour. */
  solid: string;
  /** Quiet background tint. */
  soft: string;
}

export const PALETTE: SubjectColor[] = [
  { key: 'ink', label: 'Mürekkep', solid: '#34496b', soft: '#e6ebf2' },
  { key: 'forest', label: 'Orman', solid: '#2e6b4f', soft: '#e3eee7' },
  { key: 'clay', label: 'Kil', solid: '#b35a35', soft: '#f5e5dc' },
  { key: 'ochre', label: 'Hardal', solid: '#9c7414', soft: '#f3ead3' },
  { key: 'plum', label: 'Mürdüm', solid: '#76507a', soft: '#efe6f0' },
  { key: 'teal', label: 'Petrol', solid: '#2c7473', soft: '#dfeeed' },
  { key: 'rose', label: 'Gül', solid: '#a14d5c', soft: '#f4e3e6' },
  { key: 'olive', label: 'Zeytin', solid: '#687529', soft: '#ebeedb' },
  { key: 'slate', label: 'Arduvaz', solid: '#5c6970', soft: '#e7ebed' },
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
