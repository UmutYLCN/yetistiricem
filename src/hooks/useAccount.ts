import { useCallback, useEffect, useState } from 'react';
import { hasAuthCallback, readAuthError } from '../lib/authKey';
import type { ApiResult } from '../lib/catalogApi';
import {
  catalogConfigured,
  getDisplayName,
  getStudentProfile,
  saveStudentProfile,
  signInWithPassword as authenticateWithPassword,
  signUpWithPassword as createPasswordAccount,
  setDisplayName,
  signInWithGoogle,
  signOut,
  watchSession,
} from '../lib/catalogApi';
import { appReturnUrl } from '../lib/routes';
import type { StudentProfile } from '../lib/studentProfile';

export type AccountState =
  /** Sign-in is not set up on this server (no Supabase config): the planner opens without it. */
  | { status: 'off' }
  /** Nothing asked for the account yet (the client is not loaded). */
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | {
      status: 'signed-in';
      userId: string;
      email: string | null;
      displayName: string | null;
      /** The private profile (picture, school details); null until one is saved. */
      profile: StudentProfile | null;
      /** `ready` once the profile was read, so the welcome questions are not asked by mistake. */
      profileStatus: 'loading' | 'ready' | 'error';
    };

/**
 * The student's account (the planner needs one; Keşfet shows its name). The
 * auth client loads the first time `wanted` is true (or at once when the
 * address bar carries a sign-in answer) and then keeps following the session.
 */
export function useAccount(wanted: boolean) {
  const [started, setStarted] = useState(() => catalogConfigured && hasAuthCallback());
  // A failed sign-in answer (e.g. an expired link), read before the address bar is cleaned.
  const [callbackError] = useState(() => readAuthError());
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
      // The auth client has read any sign-in answer by now; tokens and errors leave the address bar.
      if (hasAuthCallback()) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
      if (!session) {
        setState({ status: 'signed-out' });
        return;
      }
      const { id, email } = session.user;
      setState(current =>
        current.status === 'signed-in' && current.userId === id
          ? current
          : { status: 'signed-in', userId: id, email: email ?? null, displayName: null, profile: null, profileStatus: 'loading' }
      );
      void getDisplayName(id).then(result => {
        if (cancelled || !result.ok) return;
        setState(current => (current.status === 'signed-in' && current.userId === id ? { ...current, displayName: result.data } : current));
      });
      void getStudentProfile(id).then(result => {
        if (cancelled) return;
        setState(current =>
          current.status === 'signed-in' && current.userId === id
            ? result.ok
              ? { ...current, profile: result.data, profileStatus: 'ready' }
              : { ...current, profileStatus: current.profileStatus === 'ready' ? 'ready' : 'error' }
            : current
        );
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

  const signInWithPassword = useCallback((email: string, password: string) => authenticateWithPassword(email, password), []);
  /** `returnTo`: where a confirmed new account returns (the planner by default). */
  const signUpWithPassword = useCallback(
    (email: string, password: string, returnTo: string = appReturnUrl()) => createPasswordAccount(email, password, returnTo),
    []
  );
  const continueWithGoogle = useCallback((returnTo: string = appReturnUrl()) => signInWithGoogle(returnTo), []);
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

  const saveProfile = useCallback(
    async (profile: StudentProfile): Promise<ApiResult<StudentProfile>> => {
      if (state.status !== 'signed-in') return { ok: false, error: 'Bu işlem için giriş yapman gerekiyor.' };
      const result = await saveStudentProfile(state.userId, profile);
      if (result.ok) {
        setState(current => (current.status === 'signed-in' ? { ...current, profile: result.data, profileStatus: 'ready' } : current));
      }
      return result;
    },
    [state]
  );

  return { state, callbackError, signInWithPassword, signUpWithPassword, continueWithGoogle, signOut: leave, rename, saveProfile };
}

export type Account = ReturnType<typeof useAccount>;
