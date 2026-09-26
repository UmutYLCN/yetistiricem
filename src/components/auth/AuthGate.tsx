import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Eye, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { Account } from '../../hooks/useAccount';
import { useAccount } from '../../hooks/useAccount';
import { AUTH_KEY, hasSavedSignIn } from '../../lib/authKey';
import { APP_PATH, DEMO_APP_PATH, LANDING_PATH } from '../../lib/routes';
import { BrandMark } from '../ui/BrandMark';
import { SignInForm } from './SignInForm';

/** The planner's sign-in page. */
function SignInScreen({ account }: { account: Account }) {
  return (
    <div className="signin-page">
      <div className="signin-backdrop" aria-hidden="true" />
      <main id="main" className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-4 py-12">
        <a href={LANDING_PATH} className="mx-auto flex items-center gap-2.5 rounded-[10px]" aria-label="Yetiştiricem ana sayfası">
          <BrandMark size={34} />
          <span className="text-[17px] font-semibold tracking-[-0.015em] text-ink">Yetiştiricem</span>
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
          <SignInForm onEmail={email => account.signInWithEmail(email)} onGoogle={() => account.continueWithGoogle()} />
        </section>
        <p className="mt-5 text-center text-[12.5px] leading-relaxed text-ink-3">
          Kampların ve ilerlemen bu tarayıcıda saklanır; hesabın planına ve Keşfet’e erişimini sağlar.
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

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Oturum kontrol ediliyor">
      <div className="flex flex-col items-center gap-4">
        <BrandMark size={40} />
        <LoaderCircle className="size-5 animate-spin text-ink-3" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * The planner needs an account. Signed-out visitors see the sign-in page;
 * the demo (nothing is saved there) and a server without sign-in set up
 * open without one. A browser with a saved session opens the planner at once
 * while the session is confirmed. The planner reads storage once per page
 * load, so it never mounts twice in one page: if the session ends after it
 * showed, a fresh page starts on the sign-in screen.
 */
export function AuthGate({ startInDemo, children }: { startInDemo: boolean; children: (account: Account) => ReactNode }) {
  const account = useAccount(true);
  const [optimistic] = useState(hasSavedSignIn);
  const { status } = account.state;
  const open =
    startInDemo || status === 'off' || status === 'signed-in' || (optimistic && (status === 'idle' || status === 'loading'));
  const [shown, setShown] = useState(false);
  if (open && !shown) setShown(true);

  useEffect(() => {
    if (!shown || startInDemo || status !== 'signed-out') return;
    try {
      // A session that turned out invalid must not open the planner again on the next load.
      localStorage.removeItem(AUTH_KEY);
    } catch {
      // Storage blocked: the sign-in page shows either way.
    }
    window.location.replace(APP_PATH);
  }, [shown, startInDemo, status]);

  if (shown) return <>{children(account)}</>;
  if (status === 'signed-out') return <SignInScreen account={account} />;
  return <Splash />;
}
