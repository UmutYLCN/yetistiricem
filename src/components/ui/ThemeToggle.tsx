import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import type { ThemePreference } from '../../lib/theme';
import { resolveTheme } from '../../lib/theme';

/** A quiet icon button flipping light/dark (the landing header; no "system" here, the Ayarlar window has the full control). */
export function ThemeIconToggle({ className = '' }: { className?: string }) {
  const [pref, setPref] = useTheme();
  const resolved = resolveTheme(pref);
  const next: ThemePreference = resolved === 'light' ? 'dark' : 'light';
  const label = resolved === 'light' ? 'Koyu görünüme geç' : 'Açık görünüme geç';
  return (
    <button type="button" className={`landing-icon-button ${className}`} aria-label={label} title={label} onClick={() => setPref(next)}>
      {resolved === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </button>
  );
}

const OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: 'light', label: 'Açık', Icon: Sun },
  { value: 'dark', label: 'Koyu', Icon: Moon },
  { value: 'system', label: 'Sistem', Icon: Monitor },
];

/** Açık / Koyu / Sistem, the full control (the Ayarlar window). */
export function ThemeSegmented() {
  const [pref, setPref] = useTheme();
  return (
    <div className="segmented" role="group" aria-label="Görünüm">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button key={value} type="button" aria-pressed={pref === value} onClick={() => setPref(value)} className="inline-flex items-center gap-1.5">
          <Icon className="size-4" aria-hidden="true" />
          <span className="max-[420px]:sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
