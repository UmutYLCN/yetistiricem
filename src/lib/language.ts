export const LANGUAGE_KEY = 'yt_language';

export const APP_LANGUAGES = [
  { code: 'tr', name: 'Türkçe' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number]['code'];

let activeLanguage: AppLanguage = 'tr';

function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return APP_LANGUAGES.some(language => language.code === value);
}

function supportedBrowserLanguage(): AppLanguage | null {
  try {
    const candidates = [...(navigator.languages ?? []), navigator.language];
    for (const candidate of candidates) {
      const base = candidate.toLowerCase().split('-')[0];
      if (isAppLanguage(base)) return base;
    }
  } catch {
    // Browser language detection is optional (e.g. in a non-browser test).
  }
  return null;
}

export function getInitialLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (isAppLanguage(stored)) return stored;
  } catch {
    // A blocked localStorage only makes the preference session-local.
  }
  return supportedBrowserLanguage() ?? 'tr';
}

export function initializeLanguage(): AppLanguage {
  const language = getInitialLanguage();
  applyLanguage(language);
  return language;
}

export function applyLanguage(language: AppLanguage): void {
  activeLanguage = language;
  try {
    const root = document.documentElement;
    root.lang = language;
    root.dir = 'ltr';
  } catch {
    // No document (e.g. under node --test).
  }
}

export function saveLanguage(language: AppLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // The choice still applies until this page closes.
  }
  applyLanguage(language);
}

export function currentLanguage(): AppLanguage {
  return activeLanguage;
}
