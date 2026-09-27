import { Suspense, lazy } from 'react';

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
  openDiscover: boolean;
}

export function Root({ inApp, inConsent, inDocs, startInDemo, importPayload, openDiscover }: RootProps) {
  return (
    <Suspense fallback={null}>
      {inApp ? (
        <App startInDemo={startInDemo} importPayload={importPayload} openDiscover={openDiscover} />
      ) : inConsent ? (
        <OAuthConsent />
      ) : inDocs ? (
        <Docs />
      ) : (
        <Landing />
      )}
    </Suspense>
  );
}
