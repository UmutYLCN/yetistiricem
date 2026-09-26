import { Suspense, lazy } from 'react';

// Each page loads only its own code: the planner at `/app`, the landing page elsewhere.
const App = lazy(() => import('./App.tsx'));
const Landing = lazy(() => import('./components/landing/Landing.tsx'));

/** The page for this load. Moving between the pages is always a full page load (see `lib/routes`). */
export function Root({ inApp, startInDemo, importPayload }: { inApp: boolean; startInDemo: boolean; importPayload: string | null }) {
  return <Suspense fallback={null}>{inApp ? <App startInDemo={startInDemo} importPayload={importPayload} /> : <Landing />}</Suspense>;
}
