// The site has two pages on one bundle: the landing page at `/` and the
// planner ("Dashboard") at `/app`; every other path shows the landing page.
// Links between them are plain page loads, never client-side navigation: the
// planner reads storage once per page load (`loadPlannerOnce`), so mounting it
// a second time in the same page would show, and then save, stale data.

export const LANDING_PATH = '/';
export const APP_PATH = '/app';

const DEMO_PARAM = 'demo';
/** Opens the planner in the demo preview (sample data, nothing saved). */
export const DEMO_APP_PATH = `${APP_PATH}?${DEMO_PARAM}`;

export function isAppPath(pathname: string): boolean {
  return pathname === APP_PATH || pathname.startsWith(`${APP_PATH}/`);
}

/**
 * Whether this page load asked for the demo preview. The flag is removed from
 * the address bar, so reloading opens the saved plan instead.
 */
export function takeDemoRequest(): boolean {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(DEMO_PARAM)) return false;
  url.searchParams.delete(DEMO_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}
