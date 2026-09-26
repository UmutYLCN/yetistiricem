// The sign-in session's storage key and the cheap checks around it, kept in a
// module of their own so the landing page and the startup code can use them
// without loading the auth client.

/** Where supabase-js keeps the session (next to the app's other `yt_*` keys; "Tüm verileri sil" clears it). */
export const AUTH_KEY = 'yt_auth';

/** A session is saved in this browser (it may still need a refresh; the auth client decides). */
export function hasSavedSignIn(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Why an email confirmation or Google sign-in failed, in Turkish; null when
 * the hash holds no error.
 */
export function readAuthError(hash: string = window.location.hash): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.has('error') && !params.has('error_description')) return null;
  if (params.get('error_code') === 'otp_expired') {
    return 'Giriş bağlantısının süresi dolmuş ya da daha önce kullanılmış. Aşağıdan yeni bir bağlantı iste.';
  }
  if (params.get('error') === 'access_denied') return 'Giriş tamamlanmadı. Tekrar denemek için aşağıdan giriş yap.';
  return 'Giriş veya e-posta onayı tamamlanamadı. Yeniden deneyebilirsin.';
}

/** The address bar holds an auth callback (email confirmation or Google sign-in). */
export function hasAuthCallback(hash: string = window.location.hash): boolean {
  return /(?:^|[#&])(access_token|error_description)=/.test(hash);
}
