import { useCallback, useEffect, useState } from 'react';
import type { ApiResult } from '../lib/catalogApi';
import {
  catalogConfigured,
  getDisplayName,
  hasAuthCallback,
  sendMagicLink,
  setDisplayName,
  signInWithGoogle,
  signOut,
  watchSession,
} from '../lib/catalogApi';
import { discoverReturnUrl } from '../lib/routes';

export type AccountState =
  /** Keşfet is not set up on this server. */
  | { status: 'off' }
  /** Nothing asked for the account yet (the client is not loaded). */
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; email: string | null; displayName: string | null };

/**
 * The Keşfet account. The auth client loads the first time `wanted` is true
 * (or at once when the address bar carries a sign-in answer) and then keeps
 * following the session.
 */
export function useCatalogAccount(wanted: boolean) {
  const [started, setStarted] = useState(() => catalogConfigured && hasAuthCallback());
  const [state, setState] = useState<AccountState>(!catalogConfigured ? { status: 'off' } : started ? { status: 'loading' } : { status: 'idle' });
  if (catalogConfigured && wanted && !started) {
    setStarted(true);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    void watchSession(session => {
      if (cancelled) return;
      if (!session) {
        setState({ status: 'signed-out' });
        return;
      }
      const { id, email } = session.user;
      setState(current =>
        current.status === 'signed-in' && current.userId === id ? current : { status: 'signed-in', userId: id, email: email ?? null, displayName: null }
      );
      void getDisplayName(id).then(result => {
        if (cancelled || !result.ok) return;
        setState(current => (current.status === 'signed-in' && current.userId === id ? { ...current, displayName: result.data } : current));
      });
    }).then(stop => {
      if (cancelled) stop();
      else unsubscribe = stop;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [started]);

  const signInWithEmail = useCallback((email: string) => sendMagicLink(email, discoverReturnUrl()), []);
  const continueWithGoogle = useCallback(() => signInWithGoogle(discoverReturnUrl()), []);
  const leave = useCallback(async () => {
    await signOut();
    setState({ status: 'signed-out' });
  }, []);
  const rename = useCallback(
    async (name: string): Promise<ApiResult<string>> => {
      if (state.status !== 'signed-in') return { ok: false, error: 'Bu işlem için giriş yapman gerekiyor.' };
      const result = await setDisplayName(state.userId, name);
      if (result.ok) setState(current => (current.status === 'signed-in' ? { ...current, displayName: result.data } : current));
      return result;
    },
    [state]
  );

  return { state, signInWithEmail, continueWithGoogle, signOut: leave, rename };
}

export type CatalogAccount = ReturnType<typeof useCatalogAccount>;
