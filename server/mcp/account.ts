// The MCP server acts for one student: an OAuth access token Supabase Auth
// issued to an AI client the student approved (docs/mcp.md). Every read and
// write goes to Supabase with that token, so row level security limits it to
// the student's own plan; the server holds no service key.

export interface SupabaseConfig {
  /** The project URL, e.g. https://<ref>.supabase.co */
  url: string;
  /** The publishable (public) key. */
  key: string;
}

export interface Account {
  userId: string;
  token: string;
}

export type FetchText = (input: string, init: RequestInit) => Promise<Response>;

const TOKEN_CACHE_MS = 60_000;
const TOKEN_CACHE_SIZE = 200;
const TIMEOUT_MS = 15_000;

/** The claims of a JWT, unverified (Supabase verifies the token itself). */
function claimsOf(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(json, c => c.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof claims === 'object' && claims !== null && !Array.isArray(claims) ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Checks bearer tokens with Supabase Auth (`/auth/v1/user`), each answer
 * reused for a minute. Only tokens issued through the OAuth server (they carry
 * a `client_id` claim) are accepted: a browser session token copied out of the
 * app is not an approved AI client.
 */
export function createTokenChecker(config: SupabaseConfig, options: { fetch?: FetchText; now?: () => number } = {}) {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const now = options.now ?? Date.now;
  const cache = new Map<string, { expires: number; userId: string | null }>();

  return async (token: string): Promise<string | null> => {
    const cached = cache.get(token);
    if (cached && cached.expires > now()) return cached.userId;
    const claims = claimsOf(token);
    let userId: string | null = null;
    if (claims && typeof claims.client_id === 'string' && claims.client_id) {
      let response: Response;
      try {
        response = await doFetch(`${config.url}/auth/v1/user`, {
          headers: { apikey: config.key, Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        throw new Error('auth-unavailable');
      }
      if (response.status >= 500) throw new Error('auth-unavailable');
      const user = response.ok ? ((await response.json().catch(() => null)) as { id?: unknown } | null) : null;
      if (typeof user?.id === 'string' && user.id === claims.sub) userId = user.id;
    }
    cache.set(token, { expires: now() + TOKEN_CACHE_MS, userId });
    while (cache.size > TOKEN_CACHE_SIZE) cache.delete(cache.keys().next().value as string);
    return userId;
  };
}

export class AccountError extends Error {
  readonly code: 'offline' | 'conflict' | 'refused';

  constructor(code: AccountError['code']) {
    super(code);
    this.code = code;
  }
}

export interface StoredPlan {
  /** The cloud document (`toCloudDocument`), or null when the account has saved nothing yet. */
  data: unknown;
  /** 0 when there is no row yet. */
  revision: number;
}

/** The student's plan row, read with their own token. */
export async function readPlan(config: SupabaseConfig, account: Account, doFetch: FetchText = fetch): Promise<StoredPlan> {
  let response: Response;
  try {
    response = await doFetch(`${config.url}/rest/v1/planner_states?select=data,revision&user_id=eq.${encodeURIComponent(account.userId)}&limit=1`, {
      headers: { apikey: config.key, Authorization: `Bearer ${account.token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new AccountError('offline');
  }
  if (response.status === 401 || response.status === 403) throw new AccountError('refused');
  if (!response.ok) throw new AccountError('offline');
  const rows: unknown = await response.json();
  const row = Array.isArray(rows) ? (rows[0] as { data?: unknown; revision?: unknown } | undefined) : undefined;
  if (!row) return { data: null, revision: 0 };
  return { data: row.data ?? null, revision: typeof row.revision === 'number' ? row.revision : 0 };
}

/** Saves the plan on top of `baseRevision` (`save_planner_state`); a newer copy saved meanwhile is a `conflict`. */
export async function savePlan(config: SupabaseConfig, account: Account, data: unknown, baseRevision: number, doFetch: FetchText = fetch): Promise<number> {
  let response: Response;
  try {
    response = await doFetch(`${config.url}/rest/v1/rpc/save_planner_state`, {
      method: 'POST',
      headers: { apikey: config.key, Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_data: data, p_base_revision: baseRevision }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new AccountError('offline');
  }
  if (response.ok) {
    const revision: unknown = await response.json();
    if (typeof revision === 'number') return revision;
    throw new AccountError('offline');
  }
  const body = await response.text();
  if (body.includes('revision_conflict')) throw new AccountError('conflict');
  if (response.status === 401 || response.status === 403) throw new AccountError('refused');
  throw new AccountError('offline');
}

/** RFC 9728 metadata: where an MCP client gets a token for this server. */
export function resourceMetadata(resource: string, config: SupabaseConfig) {
  return {
    resource,
    authorization_servers: [`${config.url}/auth/v1`],
    bearer_methods_supported: ['header'],
    resource_name: 'Yetişir',
    resource_documentation: 'https://github.com/UmutYLCN/yetistiricem/blob/main/docs/mcp.md',
  };
}
