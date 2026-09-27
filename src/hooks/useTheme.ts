import { useState } from 'react';
import type { ThemePreference } from '../lib/theme';
import { getStoredTheme, setStoredTheme } from '../lib/theme';

/** The appearance preference (light/dark/system) and a setter that persists and paints it. */
export function useTheme(): [ThemePreference, (pref: ThemePreference) => void] {
  const [pref, setPref] = useState<ThemePreference>(getStoredTheme);
  return [
    pref,
    (next: ThemePreference) => {
      setStoredTheme(next);
      setPref(next);
    },
  ];
}
