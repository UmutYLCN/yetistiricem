import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Eye, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import type { Account } from '../../hooks/useAccount';
import { useAccount } from '../../hooks/useAccount';
import { hydrateAccount, isolateSignedOutPlanner } from '../../lib/cloudSync';
import { todayKey } from '../../lib/engine';
import { APP_PATH, DEMO_APP_PATH, LANDING_PATH } from '../../lib/routes';
import { BrandMark, Wordmark } from '../ui/BrandMark';
import { SignInForm } from './SignInForm';

/** The planner's sign-in page. */
function SignInScreen({ account }: { account: Account }) {
  const returnUrl = new URL(window.location.href);
  returnUrl.hash = '';
  const draftReturnUrl = returnUrl.searchParams.has('draft') ? returnUrl.toString() : undefined;
  return (
    <div className="signin-page">
      <div className="signin-backdrop" aria-hidden="true" />
      <main id="main" className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-4 py-12">
        <a href={LANDING_PATH} className="mx-auto flex items-center gap-2.5 rounded-[10px]" aria-label="Yetişir ana sayfası">
          <BrandMark size={34} />
          <Wordmark className="text-[18px]" />
        </a>
        <h1 className="font-display mt-8 text-center text-[28px] leading-tight text-ink">Planına giriş yap</h1>
        <p className="mt-2 text-center text-[14.5px] text-ink-2">Kampların, bugünün görevleri ve ilerlemen seni bekliyor.</p>
        {account.callbackError && (
          <p className="callout callout-warn mt-6 text-[13.5px] text-ink-2" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
            <span>{account.callbackError}</span>
          </p>
        )}
        <section className="card mt-7 p-5 sm:p-6" aria-label="Giriş">
          <SignInForm
            onSignIn={(email, password) => account.signInWithPassword(email, password)}
            onSignUp={(email, password) => account.signUpWithPassword(email, password, draftReturnUrl)}
            onGoogle={() => account.continueWithGoogle(draftReturnUrl)}
          />
        </section>
        <p className="mt-5 text-center text-[12.5px] leading-relaxed text-ink-3">
          Kampların ve ilerlemen hesabına kaydedilir; hangi cihazdan girersen gir planın seninle.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <a href={LANDING_PATH} className="btn btn-ghost btn-sm">
            <ArrowLeft aria-hidden="true" />
            Ana sayfa
          </a>
          <a href={DEMO_APP_PATH} className="btn btn-ghost btn-sm">
            <Eye aria-hidden="true" />
            Önce demoya göz at
          </a>
        </div>
      </main>
    </div>
  );
}

function Splash({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label={label}>
      <div className="flex flex-col items-center gap-4">
        <BrandMark size={40} />
        <LoaderCircle className="size-5 animate-spin text-ink-3" aria-hidden="true" />
        <p className="text-[13px] text-ink-3">{label}</p>
      </div>
    </div>
  );
}

function GateMessage({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="signin-page">
      <div className="signin-backdrop" aria-hidden="true" />
      <main id="main" className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col items-center justify-center px-4 py-12 text-center">
        <BrandMark size={40} />
        <h1 className="font-display mt-6 text-[24px] leading-tight text-ink">{title}</h1>
        <p className="mt-2 text-[14.5px] text-ink-2">{body}</p>
        {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
      </main>
    </div>
  );
}

type Hydration = { userId: string; status: 'loading' } | { userId: string; status: 'ready' } | { userId: string; status: 'error'; message: string };

/**
 * The planner needs an account, and it opens only on that account's plan:
 * signed-out visitors see the sign-in page; after sign-in the account's plan
 * is brought into this browser first (`hydrateAccount`: ownerless data is
 * backed up; another account's plan is never shown).
 * The demo (nothing is saved there) opens without an account, and so does a
 * development build without Supabase config. The planner reads storage once
 * per page load, so it never mounts twice in one page: if the session ends
 * after it showed, a fresh page starts on the sign-in screen.
 */
export function AuthGate({ startInDemo, children }: {
  startInDemo: boolean;
  children: (account: Account, userId: string | null) => ReactNode;
}) {
  const account = useAccount(true);
  const { state } = account;
  const userId = state.status === 'signed-in' ? state.userId : null;
  const [hydration, setHydration] = useState<Hydration | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState(false);
  const [shownOwner, setShownOwner] = useState<string | null>(null);
  const needsHydration = !startInDemo && !shown && userId !== null;

  useEffect(() => {
    if (!needsHydration || !userId) return;
    const controller = new AbortController();
    void hydrateAccount(userId, todayKey(), controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setHydration(result.ok ? { userId, status: 'ready' } : { userId, status: 'error', message: result.error });
    });
    return () => {
      controller.abort();
    };
  }, [needsHydration, userId, attempt]);

  useEffect(() => {
    if (!startInDemo && !shown && state.status === 'signed-out') isolateSignedOutPlanner();
  }, [startInDemo, shown, state.status]);

  const ready = hydration?.status === 'ready' && hydration.userId === userId;
  const localOnly = state.status === 'off' && import.meta.env.DEV;
  const open = startInDemo || localOnly || (userId !== null && ready);
  if (open && !shown) {
    setShownOwner(userId);
    setShown(true);
  }
  const ownerChanged = shown && !startInDemo && !localOnly && shownOwner !== userId;

  useEffect(() => {
    if (!shown || startInDemo || localOnly || (state.status !== 'signed-out' && !ownerChanged)) return;
    window.location.replace(APP_PATH);
  }, [shown, startInDemo, localOnly, state.status, ownerChanged]);

  if (shown) return <>{children(account, ownerChanged ? null : userId)}</>;
  if (state.status === 'off') {
    return <GateMessage title="Giriş bu sunucuda kurulmamış" body="Uygulamanın Supabase bağlantısı tanımlı değil (kurulum: docs/kesfet.md)." />;
  }
  if (state.status === 'signed-out') return <SignInScreen account={account} />;
  if (hydration?.status === 'error' && hydration.userId === userId) {
    return (
      <GateMessage
        title="Planın açılamadı"
        body={hydration.message}
        action={
          <>
            <button type="button" className="btn btn-primary" onClick={() => setAttempt(n => n + 1)}>
              <RefreshCw aria-hidden="true" />
              Tekrar dene
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void account.signOut()}>
              Çıkış yap
            </button>
          </>
        }
      />
    );
  }
  return <Splash label={userId ? 'Planın hazırlanıyor…' : 'Oturum kontrol ediliyor…'} />;
}
