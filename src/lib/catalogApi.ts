import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { SharedCamp } from './campShare';
import type { CatalogEntry, PublishRow } from './catalog';
import { CATALOG_COLUMNS, readCatalogCamp, readCatalogRow } from './catalog';
import { AUTH_KEY } from './authKey';
import type { StudentProfile } from './studentProfile';
import { profileRow, readProfileRow } from './studentProfile';

// The app's connection to Supabase: sign-in (the planner needs an account)
// and Keşfet (docs/kesfet.md). The URL and the
// publishable key are public by design (row level security guards the
// data); a service-role key must never reach the browser. The client loads
// on demand, so the planner does not ship it until Keşfet is used.

const URL_ENV: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const KEY_ENV: string | undefined = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;



export const catalogConfigured = Boolean(URL_ENV && KEY_ENV);

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!URL_ENV || !KEY_ENV) return Promise.resolve(null);
  const [url, key] = [URL_ENV, KEY_ENV];
  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) =>
      createClient(url, key, {
        auth: { storageKey: AUTH_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      })
    )
    .catch(() => {
      clientPromise = null;
      return null;
    });
  return clientPromise;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const OFFLINE = 'Keşfet’e ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.';
const NOT_CONFIGURED = 'Keşfet bu sunucuda kurulmamış.';
const AUTH_OFFLINE = 'Giriş hizmetine ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.';
const AUTH_NOT_CONFIGURED = 'Giriş bu sunucuda kurulmamış.';

function failure(error: { message?: string; code?: string } | null | undefined): { ok: false; error: string } {
  const message = error?.message ?? '';
  if (message.includes('duplicate_camp')) {
    return { ok: false, error: 'Bu kamp Keşfet’te başka biri tarafından zaten yayınlanmış. Yalnızca kendi hazırladığın kampları yayınlayabilirsin.' };
  }
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

async function runAuth<T>(fn: (client: SupabaseClient) => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  const client = await getSupabase();
  if (!client) return { ok: false, error: catalogConfigured ? AUTH_OFFLINE : AUTH_NOT_CONFIGURED };
  try {
    return await fn(client);
  } catch {
    return { ok: false, error: AUTH_OFFLINE };
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
// The student's private profile (picture, school details)

const PROFILE_COLUMNS = 'avatar, stage, school, department, grade, profession, bio, onboarded_at';

function profileFailure(error: { message?: string; code?: string } | null | undefined): { ok: false; error: string } {
  const message = error?.message ?? '';
  if (error?.code === '42501' || message.includes('row-level security')) return { ok: false, error: 'Bu işlem için giriş yapman gerekiyor.' };
  if (error?.code === '23514') return { ok: false, error: 'Profil bilgilerinden biri kabul edilmedi. Fotoğrafı ya da yazdıklarını kontrol edip tekrar dene.' };
  if (/fetch|network/i.test(message)) return { ok: false, error: AUTH_OFFLINE };
  return { ok: false, error: 'Profilin şu an kaydedilemedi. Biraz sonra tekrar dene.' };
}

/** The signed-in student's profile; null when they have none yet (the welcome questions are due). */
export function getStudentProfile(userId: string): Promise<ApiResult<StudentProfile | null>> {
  return runAuth(async client => {
    const { data, error } = await client.from('student_profiles').select(PROFILE_COLUMNS).eq('user_id', userId).maybeSingle();
    if (error) return profileFailure(error);
    return { ok: true, data: data ? readProfileRow(data) : null };
  });
}

export function saveStudentProfile(userId: string, profile: StudentProfile): Promise<ApiResult<StudentProfile>> {
  return runAuth(async client => {
    const row = { user_id: userId, ...profileRow(profile), updated_at: new Date().toISOString() };
    const { data, error } = await client.from('student_profiles').upsert(row).select(PROFILE_COLUMNS).single();
    if (error) return profileFailure(error);
    return { ok: true, data: readProfileRow(data) };
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

export function signInWithPassword(email: string, password: string): Promise<ApiResult<null>> {
  return runAuth(async client => {
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return { ok: true, data: null };
    if (error.code === 'email_not_confirmed') return { ok: false, error: 'E-posta adresi henüz doğrulanmamış. Supabase’te e-posta onayı açıksa önce gelen bağlantıyı onayla.' };
    if (error.code === 'invalid_credentials' || error.status === 400) return { ok: false, error: 'E-posta veya şifre hatalı. Bilgilerini kontrol edip tekrar dene.' };
    if (error.status === 429) return { ok: false, error: 'Çok sık deneme yapıldı. Birkaç dakika sonra tekrar dene.' };
    return { ok: false, error: 'Giriş yapılamadı. Biraz sonra tekrar dene.' };
  });
}

export interface PasswordSignUpResult {
  emailConfirmationRequired: boolean;
}

export function signUpWithPassword(email: string, password: string, redirectTo: string): Promise<ApiResult<PasswordSignUpResult>> {
  return runAuth(async client => {
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      if (error.code === 'user_already_exists' || error.message.toLowerCase().includes('already registered')) {
        return { ok: false, error: 'Bu e-posta ile zaten hesap var. Giriş yapmayı dene.' };
      }
      if (error.code === 'weak_password') return { ok: false, error: 'Şifre Supabase’in güvenlik koşullarını karşılamıyor.' };
      if (error.code === 'signup_disabled') return { ok: false, error: 'Yeni hesap oluşturma Supabase ayarlarında kapalı.' };
      if (error.code === 'email_address_invalid') return { ok: false, error: 'Bu e-posta adresi geçersiz görünüyor.' };
      if (error.status === 429) return { ok: false, error: 'Çok sık hesap oluşturma denemesi yapıldı. Biraz sonra tekrar dene.' };
      if (error.status === 400) return { ok: false, error: 'E-posta veya şifre kabul edilmedi. Bilgilerini kontrol et.' };
      return { ok: false, error: 'Hesap oluşturulamadı. Biraz sonra tekrar dene.' };
    }
    return { ok: true, data: { emailConfirmationRequired: data.session === null } };
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

// ---------------------------------------------------------------------------
// AI connections (docs/mcp.md): Supabase Auth's OAuth server sends the student
// to `/oauth/consent` to approve or deny an AI client such as Claude.

export type ConsentRequest =
  | { kind: 'ask'; clientName: string; clientSite: string; returnsTo: string; email: string }
  /** Approved before: go straight back to the client. */
  | { kind: 'done'; redirectUrl: string };

const CONSENT_FAILED = 'Bağlantı isteği okunamadı. Yapay zekâ uygulamasından bağlanmayı yeniden başlat.';

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
};

/** A redirect back to the client only when it is a web address. */
function safeRedirect(url: string | undefined): string | null {
  try {
    const parsed = new URL(url ?? '');
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export function getConsentRequest(authorizationId: string): Promise<ApiResult<ConsentRequest>> {
  return runAuth<ConsentRequest>(async client => {
    const { data, error } = await client.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || !data) return { ok: false, error: CONSENT_FAILED };
    if (!('authorization_id' in data)) {
      const redirectUrl = safeRedirect(data.redirect_url);
      return redirectUrl ? { ok: true, data: { kind: 'done', redirectUrl } } : { ok: false, error: CONSENT_FAILED };
    }
    return {
      ok: true,
      data: {
        kind: 'ask',
        clientName: data.client.name?.trim() || 'Bir yapay zekâ uygulaması',
        clientSite: hostOf(data.client.uri ?? ''),
        returnsTo: hostOf(data.redirect_uri),
        email: data.user.email,
      },
    };
  });
}

/** Approves or denies; the answer is the address to send the browser back to the client. */
export function answerConsent(authorizationId: string, approve: boolean): Promise<ApiResult<string>> {
  return runAuth(async client => {
    const options = { skipBrowserRedirect: true };
    const { data, error } = approve
      ? await client.auth.oauth.approveAuthorization(authorizationId, options)
      : await client.auth.oauth.denyAuthorization(authorizationId, options);
    const redirectUrl = safeRedirect(data?.redirect_url);
    return error || !redirectUrl ? { ok: false, error: CONSENT_FAILED } : { ok: true, data: redirectUrl };
  });
}

/** An AI client the student approved (Supabase OAuth grant). */
export interface AiConnection {
  clientId: string;
  name: string;
  site: string;
  /** ISO timestamp. */
  grantedAt: string;
}

export function listAiConnections(): Promise<ApiResult<AiConnection[]>> {
  return runAuth(async client => {
    const { data, error } = await client.auth.oauth.listGrants();
    if (error) return { ok: false, error: 'Bağlı yapay zekâ uygulamaları okunamadı. Biraz sonra tekrar dene.' };
    return {
      ok: true,
      data: (data ?? []).map(grant => ({
        clientId: grant.client.id,
        name: grant.client.name?.trim() || 'Adsız uygulama',
        site: hostOf(grant.client.uri ?? ''),
        grantedAt: grant.granted_at,
      })),
    };
  });
}

/** Ends an AI client's access: its consent and sessions go; it has to ask again. */
export function revokeAiConnection(clientId: string): Promise<ApiResult<null>> {
  return runAuth(async client => {
    const { error } = await client.auth.oauth.revokeGrant({ clientId });
    return error ? { ok: false, error: 'Bağlantı kaldırılamadı. Biraz sonra tekrar dene.' } : { ok: true, data: null };
  });
}
