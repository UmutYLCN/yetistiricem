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

const IMPORT_PARAM = 'import';

/** Removes a parameter from the address bar (reloading then opens the saved plan). */
function dropParam(url: URL, name: string) {
  url.searchParams.delete(name);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Whether this page load asked for the demo preview. The flag is removed from
 * the address bar, so reloading opens the saved plan instead.
 */
export function takeDemoRequest(): boolean {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(DEMO_PARAM)) return false;
  dropParam(url, DEMO_PARAM);
  return true;
}

/**
 * A camp share payload this page load was opened with (`/app?import=…`), or
 * null. It leaves the address bar at once, so a reload never asks again.
 */
export function takeImportRequest(): string | null {
  const url = new URL(window.location.href);
  const payload = url.searchParams.get(IMPORT_PARAM);
  if (payload === null) return null;
  dropParam(url, IMPORT_PARAM);
  return payload;
}

const VIEW_PARAM = 'view';
const DISCOVER_VIEW = 'kesfet';

/**
 * `/app?view=kesfet`: open on Keşfet (where sign-in links bring the student
 * back). Removed from the address bar like the other flags; a sign-in answer
 * in the hash stays for the auth client to read.
 */
export function takeDiscoverRequest(): boolean {
  const url = new URL(window.location.href);
  if (url.searchParams.get(VIEW_PARAM) !== DISCOVER_VIEW) return false;
  dropParam(url, VIEW_PARAM);
  return true;
}

/** Where signing in to the planner (magic link, Google) returns. */
export function appReturnUrl(origin: string = window.location.origin): string {
  return `${origin}${APP_PATH}`;
}

/** Where signing in from Keşfet in the demo returns: the planner on Keşfet. */
export function discoverReturnUrl(origin: string = window.location.origin): string {
  return `${origin}${APP_PATH}?${VIEW_PARAM}=${DISCOVER_VIEW}`;
}

/** The link that opens the planner and offers the shared camp. */
export function campImportUrl(payload: string, origin: string = window.location.origin): string {
  return `${origin}${APP_PATH}?${IMPORT_PARAM}=${payload}`;
}
