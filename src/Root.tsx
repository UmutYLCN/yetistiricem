import { Suspense, lazy } from 'react';

// Each page loads only its own code: the planner at `/app`, the landing page elsewhere.
const App = lazy(() => import('./App.tsx'));
const Landing = lazy(() => import('./components/landing/Landing.tsx'));

/** The page for this load. Moving between the pages is always a full page load (see `lib/routes`). */
interface RootProps {
  inApp: boolean;
  startInDemo: boolean;
  importPayload: string | null;
  openDiscover: boolean;
}

export function Root({ inApp, startInDemo, importPayload, openDiscover }: RootProps) {
  return (
    <Suspense fallback={null}>
      {inApp ? <App startInDemo={startInDemo} importPayload={importPayload} openDiscover={openDiscover} /> : <Landing />}
    </Suspense>
  );
}
