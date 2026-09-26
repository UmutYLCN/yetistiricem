import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { SharedCamp } from './campShare';
import type { CatalogEntry, PublishRow } from './catalog';
import { CATALOG_COLUMNS, readCatalogCamp, readCatalogRow } from './catalog';
import { AUTH_KEY } from './persistence';

// Keşfet's connection to Supabase (docs/kesfet.md). The URL and the
// publishable key are public by design (row level security guards the
// data); a service-role key must never reach the browser. The client loads
// on demand, so the planner does not ship it until Keşfet is used.

const URL_ENV: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const KEY_ENV: string | undefined = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Where supabase-js keeps the session (next to the app's other `yt_*` keys; "Tüm verileri sil" clears it). */
export const AUTH_STORAGE_KEY = AUTH_KEY;

export const catalogConfigured = Boolean(URL_ENV && KEY_ENV);

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!URL_ENV || !KEY_ENV) return Promise.resolve(null);
  const [url, key] = [URL_ENV, KEY_ENV];
  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) =>
      createClient(url, key, {
        auth: { storageKey: AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      })
    )
    .catch(() => {
      clientPromise = null;
      return null;
    });
  return clientPromise;
}

/** The address bar holds a sign-in answer (the magic link or Google sent the student back). */
export function hasAuthCallback(): boolean {
  return /(?:^|[#&])(access_token|error_description)=/.test(window.location.hash);
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const OFFLINE = 'Keşfet’e ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.';
const NOT_CONFIGURED = 'Keşfet bu sunucuda kurulmamış.';

function failure(error: { message?: string; code?: string } | null | undefined): { ok: false; error: string } {
  const message = error?.message ?? '';
  if (message.includes('publish_limit')) return { ok: false, error: 'En fazla 20 kamp yayınlayabilirsin. Yenisi için eskilerinden birini kaldır.' };
  if (error?.code === '42501' || message.includes('row-level security')) {
    return { ok: false, error: 'Bu işlem için giriş yapman gerekiyor.' };
  }
  if (/fetch|network/i.test(message)) return { ok: false, error: OFFLINE };
  return { ok: false, error: 'Keşfet şu an yanıt vermedi. Biraz sonra tekrar dene.' };
}

async function run<T>(fn: (client: SupabaseClient) => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  const client = await getSupabase();
  if (!client) return { ok: false, error: catalogConfigured ? OFFLINE : NOT_CONFIGURED };
  try {
    return await fn(client);
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

const LIST_LIMIT = 200;

/** The newest published camps (rows that are not usable entries are left out). */
export function listPublishedCamps(): Promise<ApiResult<CatalogEntry[]>> {
  return run(async client => {
    const { data, error } = await client.from('published_camps').select(CATALOG_COLUMNS).order('created_at', { ascending: false }).limit(LIST_LIMIT);
    if (error) return failure(error);
    return { ok: true, data: (data ?? []).flatMap(row => readCatalogRow(row) ?? []) };
  });
}

/** One entry with its camp; `camp` is null when the stored document is broken. */
export function getPublishedCamp(id: string): Promise<ApiResult<{ entry: CatalogEntry; camp: SharedCamp | null } | null>> {
  return run(async client => {
    const { data, error } = await client.from('published_camps').select(`${CATALOG_COLUMNS}, payload`).eq('id', id).maybeSingle();
    if (error) return failure(error);
    const entry = data ? readCatalogRow(data) : null;
    return { ok: true, data: entry ? { entry, camp: readCatalogCamp((data as { payload?: unknown }).payload) } : null };
  });
}

/** Publishes a camp, or updates the entry this author already has for it. */
export function publishCamp(row: PublishRow): Promise<ApiResult<CatalogEntry>> {
  return run(async client => {
    const { data, error } = await client
      .from('published_camps')
      .upsert(row, { onConflict: 'author_id,source_camp_id' })
      .select(CATALOG_COLUMNS)
      .single();
    if (error) return failure(error);
    const entry = readCatalogRow(data);
    return entry ? { ok: true, data: entry } : failure(null);
  });
}

export function unpublishCamp(id: string): Promise<ApiResult<null>> {
  return run(async client => {
    const { error } = await client.from('published_camps').delete().eq('id', id);
    return error ? failure(error) : { ok: true, data: null };
  });
}

/** The entry this author has for one of their camps, if they published it. */
export function findPublication(sourceCampId: string, authorId: string): Promise<ApiResult<CatalogEntry | null>> {
  return run(async client => {
    const { data, error } = await client
      .from('published_camps')
      .select(CATALOG_COLUMNS)
      .eq('author_id', authorId)
      .eq('source_camp_id', sourceCampId)
      .maybeSingle();
    if (error) return failure(error);
    return { ok: true, data: data ? readCatalogRow(data) : null };
  });
}

export function getDisplayName(userId: string): Promise<ApiResult<string | null>> {
  return run(async client => {
    const { data, error } = await client.from('profiles').select('display_name').eq('id', userId).maybeSingle();
    if (error) return failure(error);
    return { ok: true, data: typeof data?.display_name === 'string' ? data.display_name : null };
  });
}

export function setDisplayName(userId: string, name: string): Promise<ApiResult<string>> {
  return run(async client => {
    const { error } = await client.from('profiles').upsert({ id: userId, display_name: name.trim() });
    return error ? failure(error) : { ok: true, data: name.trim() };
  });
}

// ---------------------------------------------------------------------------
// Sign-in

export interface Providers {
  email: boolean;
  google: boolean;
}

/** Which sign-in ways the Supabase project has turned on. */
export async function signInProviders(): Promise<Providers> {
  if (!URL_ENV || !KEY_ENV) return { email: false, google: false };
  try {
    const response = await fetch(`${URL_ENV}/auth/v1/settings`, { headers: { apikey: KEY_ENV } });
    const body = (await response.json()) as { external?: Record<string, unknown>; disable_signup?: boolean };
    return { email: body.external?.email === true, google: body.external?.google === true };
  } catch {
    return { email: true, google: false };
  }
}

export function sendMagicLink(email: string, redirectTo: string): Promise<ApiResult<null>> {
  return run(async client => {
    const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo } });
    if (!error) return { ok: true, data: null };
    if (error.status === 429) return { ok: false, error: 'Çok sık giriş bağlantısı istendi. Birkaç dakika sonra tekrar dene.' };
    if (error.status === 400) return { ok: false, error: 'Bu e-posta adresi geçersiz görünüyor.' };
    return failure(error);
  });
}

export async function signInWithGoogle(redirectTo: string): Promise<ApiResult<null>> {
  return run(async client => {
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    return error ? failure(error) : { ok: true, data: null };
  });
}

export async function signOut(): Promise<void> {
  const client = await getSupabase();
  await client?.auth.signOut().catch(() => {});
}

/** Follows the session: called now with the current one and again on every change. Returns the unsubscribe. */
export async function watchSession(onChange: (session: Session | null) => void): Promise<() => void> {
  const client = await getSupabase();
  if (!client) {
    onChange(null);
    return () => {};
  }
  const { data } = client.auth.onAuthStateChange((_event, session) => onChange(session));
  const { data: current } = await client.auth.getSession();
  onChange(current.session);
  return () => data.subscription.unsubscribe();
}
