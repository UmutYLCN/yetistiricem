import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BookOpenCheck, CalendarPlus, Check, LoaderCircle, LogOut, ShieldOff, TriangleAlert, X } from 'lucide-react';
import { useAccount } from '../../hooks/useAccount';
import type { ConsentRequest } from '../../lib/catalogApi';
import { answerConsent, getConsentRequest } from '../../lib/catalogApi';
import { LANDING_PATH } from '../../lib/routes';
import { BrandMark, Wordmark } from '../ui/BrandMark';
import { SignInForm } from './SignInForm';
import { msg, translateTemplate } from '../../lib/messages';


type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; request: Extract<ConsentRequest, { kind: 'ask' }> };

const authorizationId = new URLSearchParams(window.location.search).get('authorization_id') ?? '';

function Frame({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="signin-page">
      <div className="signin-backdrop" aria-hidden="true" />
      <main id="main" className="relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col justify-center px-4 py-12">
        <a href={LANDING_PATH} className="mx-auto flex items-center gap-2.5 rounded-[10px]" aria-label={msg("Yetişir ana sayfası")}>
          <BrandMark size={34} />
          <Wordmark className="text-[18px]" />
        </a>
        <h1 className="font-display mt-8 text-center text-[26px] leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-[14.5px] text-ink-2">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <p className="callout callout-warn mt-7 text-[13.5px] text-ink-2" role="alert">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

const PERMISSIONS = [
  { icon: BookOpenCheck, text: 'Kamplarını, günlük planını ve ilerlemeni okuyabilir; seni değerlendirmek için.' },
  { icon: CalendarPlus, text: 'Seninle hazırladığı kampları planına ekleyebilir.' },
  { icon: ShieldOff, text: 'Bir şey silemez, Keşfet’te yayın yapamaz, şifrene ulaşamaz.' },
];

/**
 * `/oauth/consent`: an AI client (Claude, ChatGPT, Grok…) asks to act for
 * the student through the MCP server (docs/mcp.md). Supabase Auth's OAuth
 * server sends the student here with `authorization_id`; they sign in if
 * needed, then allow or deny, and go back to the client.
 */
export default function OAuthConsent() {
  const account = useAccount(true);
  const { state } = account;
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [busy, setBusy] = useState<'allow' | 'deny' | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const userId = state.status === 'signed-in' ? state.userId : null;

  useEffect(() => {
    if (!userId || !authorizationId) return;
    let cancelled = false;
    void getConsentRequest(authorizationId).then(result => {
      if (cancelled) return;
      if (!result.ok) setLoaded({ status: 'error', message: result.error });
      else if (result.data.kind === 'done') window.location.replace(result.data.redirectUrl);
      else setLoaded({ status: 'ready', request: result.data });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const answer = async (approve: boolean) => {
    setBusy(approve ? 'allow' : 'deny');
    setAnswerError(null);
    const result = await answerConsent(authorizationId, approve);
    if (result.ok) {
      window.location.assign(result.data);
      return;
    }
    setBusy(null);
    setAnswerError(result.error);
  };

  if (state.status === 'off') {
    return (
      <Frame title={msg("Bağlantı kurulamıyor")}>
        <Problem message={msg('Bu sunucuda giriş kurulmamış (docs/kesfet.md).')} />
      </Frame>
    );
  }
  if (!authorizationId) {
    return (
      <Frame title={msg("Yapay zekâ bağlantısı")} subtitle={msg('Bu sayfa Claude, ChatGPT gibi bir uygulamadan Yetişir’e bağlanırken açılır.')}>
        <Problem message={msg('Bağlantı isteği bulunamadı. Bağlanmayı yapay zekâ uygulamasından başlat.')} />
      </Frame>
    );
  }
  if (state.status === 'signed-out') {
    return (
      <Frame title={msg("Bağlanmak için giriş yap")} subtitle={msg('Yapay zekâ uygulaması Yetişir hesabına bağlanmak istiyor.')}>
        {account.callbackError && <Problem message={account.callbackError} />}
        <section className="card mt-7 p-5 sm:p-6" aria-label={msg("Giriş")}>
          <SignInForm
            onSignIn={(email, password) => account.signInWithPassword(email, password)}
            onSignUp={(email, password) => account.signUpWithPassword(email, password, window.location.href)}
            onGoogle={() => account.continueWithGoogle(window.location.href)}
          />
        </section>
      </Frame>
    );
  }
  if (state.status !== 'signed-in' || loaded.status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label={msg("Bağlantı isteği okunuyor")}>
        <LoaderCircle className="size-5 animate-spin text-ink-3" aria-hidden="true" />
      </div>
    );
  }
  if (loaded.status === 'error') {
    return (
      <Frame title={msg("Bağlantı isteği açılamadı")}>
        <Problem message={loaded.message} />
      </Frame>
    );
  }

  const { request } = loaded;
  return (
    <Frame
      title={translateTemplate('{client} bağlanmak istiyor', { client: request.clientName })}
      subtitle={
        <>
          <span className="font-semibold text-ink">{request.email}</span> {msg(" hesabına erişim istiyor.\n        ")}</>
      }
    >
      <section className="card mt-7 p-5 sm:p-6" aria-label={msg("İstenen izinler")}>
        <p className="eyebrow">{msg("İzin verirsen")}</p>
        <ul className="mt-3 space-y-3">
          {PERMISSIONS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-[14px] text-ink-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
              <span>{msg(text)}</span>
            </li>
          ))}
        </ul>
        {(request.clientSite || request.returnsTo) && (
          <p className="mt-4 text-[12.5px] text-ink-3">
            {request.clientSite && <>{msg("Uygulama: ")}{request.clientSite}{msg(". ")}</>}
            {request.returnsTo && <>{msg("Onaydan sonra ")}{request.returnsTo} {msg(" adresine dönülür.")}</>}
          </p>
        )}
        {answerError && (
          <p className="field-error mt-4" role="alert">
            {answerError}
          </p>
        )}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" className="btn btn-secondary" onClick={() => void answer(false)} disabled={busy !== null}>
            {busy === 'deny' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
            {msg("\n            Reddet\n          ")}</button>
          <button type="button" className="btn btn-primary" onClick={() => void answer(true)} disabled={busy !== null} data-autofocus>
            {busy === 'allow' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            {msg("\n            İzin ver\n          ")}</button>
        </div>
      </section>
      <p className="mt-5 text-center text-[12.5px] leading-relaxed text-ink-3">
        {msg("\n        Bağlantıyı istediğin zaman Yetişir’de Profil ve ayarlar → Yapay zekâ bağlantıları bölümünden kaldırabilirsin.\n      ")}</p>
      <div className="mt-4 flex justify-center">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void account.signOut()} disabled={busy !== null}>
          <LogOut aria-hidden="true" />
          {msg("\n          Başka hesapla giriş yap\n        ")}</button>
      </div>
    </Frame>
  );
}
