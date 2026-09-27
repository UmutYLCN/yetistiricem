// Appearance: 'system' follows the OS (`prefers-color-scheme`, no stored key);
// 'light'/'dark' are an explicit override. Applied as `data-theme` on <html>;
// the actual colours live in src/index.css (light values under
// `@media (prefers-color-scheme: light)` and `[data-theme="light"]`).
// index.html carries a small blocking script mirroring `applyTheme` so an
// explicit override paints before first render (no flash); this module is
// the one place both that script and the app agree on the key and values.
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_KEY = 'yt_theme';

function isExplicit(value: string | null): value is 'light' | 'dark' {
  return value === 'light' || value === 'dark';
}

export function getStoredTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return isExplicit(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersLight(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch {
    return false;
  }
}

/** What a preference actually paints as, once 'system' is settled. */
export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  return pref === 'system' ? (systemPrefersLight() ? 'light' : 'dark') : pref;
}

function syncThemeColorMeta(resolved: 'light' | 'dark'): void {
  try {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-dynamic]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('data-dynamic', 'true');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', resolved === 'light' ? '#f7f7f8' : '#08090a');
  } catch {
    // A wrong browser-chrome tint isn't worth failing over.
  }
}

/** Paints a preference. Safe to call repeatedly (settings, the header toggle). */
export function applyTheme(pref: ThemePreference): void {
  try {
    const root = document.documentElement;
    if (pref === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = pref;
  } catch {
    // No document (e.g. under node --test); nothing to paint.
  }
  syncThemeColorMeta(resolveTheme(pref));
}

/** Persists a preference (or clears it, for 'system') and paints it. */
export function setStoredTheme(pref: ThemePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Preference just won't survive a reload.
  }
  applyTheme(pref);
}

/** Call once on load, after the blocking script in index.html already painted. */
export function initTheme(): void {
  const pref = getStoredTheme();
  applyTheme(pref);
  try {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      // Only the browser-chrome tint needs a nudge; the colours themselves
      // already follow the OS live through the CSS media query.
      if (getStoredTheme() === 'system') syncThemeColorMeta(resolveTheme('system'));
    });
  } catch {
    // Older browsers just keep the meta tag's initial value.
  }
}
