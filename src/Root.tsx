import { Suspense, lazy } from 'react';

// Each page loads only its own code: the planner at `/app`, the landing page elsewhere.
const App = lazy(() => import('./App.tsx'));
const Landing = lazy(() => import('./components/landing/Landing.tsx'));

/** The page for this load. Moving between the pages is always a full page load (see `lib/routes`). */
export function Root({ inApp, startInDemo }: { inApp: boolean; startInDemo: boolean }) {
  return <Suspense fallback={null}>{inApp ? <App startInDemo={startInDemo} /> : <Landing />}</Suspense>;
}
