import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { LanguageContext } from './lib/LanguageContext';
import { initializeLanguage, saveLanguage } from './lib/language';
import type { AppLanguage } from './lib/language';
import { msg } from './lib/messages';

// Each page loads only its own code: the planner at `/app`, the docs at `/docs`, the AI connection approval at `/oauth/consent`, the landing page elsewhere.
const App = lazy(() => import('./App.tsx'));
const Landing = lazy(() => import('./components/landing/Landing.tsx'));
const OAuthConsent = lazy(() => import('./components/auth/OAuthConsent.tsx'));
const Docs = lazy(() => import('./components/docs/DocsPage.tsx'));

/** The page for this load. Moving between the pages is always a full page load (see `lib/routes`). */
interface RootProps {
  inApp: boolean;
  inConsent: boolean;
  inDocs: boolean;
  startInDemo: boolean;
  importPayload: string | null;
  mcpDraftId: string | null;
  openDiscover: boolean;
}

export function Root({ inApp, inConsent, inDocs, startInDemo, importPayload, mcpDraftId, openDiscover }: RootProps) {
  const [language, setLanguageState] = useState<AppLanguage>(initializeLanguage);
  const setLanguage = useCallback((next: AppLanguage) => {
    saveLanguage(next);
    setLanguageState(next);
  }, []);

  useEffect(() => {
    if (inDocs) return;
    const pathname = window.location.pathname;
    if (pathname === '/app' || pathname.startsWith('/app/')) document.title = `${msg('Dashboard')} · Yetişir`;
    else if (pathname === '/oauth/consent' || pathname.startsWith('/oauth/consent/')) document.title = `${msg('Bağlantı onayı')} · Yetişir`;
    else if (pathname === '/docs' || pathname.startsWith('/docs/')) document.title = `${msg('Belgeler')} · Yetişir`;
    else document.title = msg('Yetişir — Panik yok, yetişir');
    const descriptions = {
      tr: 'Panik yok, yetişir. YouTube ders videolarını günlük ritmine göre dağıtan, hedefine ne zaman yetişeceğini gün gün hesaplayan çalışma planlayıcı.',
      en: 'Plan your YouTube lessons around your daily routine. Yetişir calculates when you will reach your goal, day by day.',
      es: 'Organiza tus vídeos de YouTube según tu rutina. Yetişir calcula día a día cuándo alcanzarás tu objetivo.',
      fr: 'Organisez vos vidéos YouTube selon votre rythme. Yetişir calcule jour après jour quand vous atteindrez votre objectif.',
    };
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', descriptions[language]);
  }, [language, inDocs]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <Suspense fallback={null}>
        {inApp ? (
          <App startInDemo={startInDemo} importPayload={importPayload} mcpDraftId={mcpDraftId} openDiscover={openDiscover} />
        ) : inConsent ? (
          <OAuthConsent />
        ) : inDocs ? (
          <Docs />
        ) : (
          <Landing />
        )}
      </Suspense>
    </LanguageContext.Provider>
  );
}
