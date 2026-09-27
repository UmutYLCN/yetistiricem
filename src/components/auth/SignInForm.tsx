import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { ApiResult, PasswordSignUpResult, Providers } from '../../lib/catalogApi';
import { signInProviders } from '../../lib/catalogApi';
import { msg } from '../../lib/messages';


const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The Google "G" (its brand colours live in the file, not in the theme). */
function GoogleMark() {
  return <img src="/google-g.svg" alt={msg("")} className="size-4" />;
}

interface Props {
  onSignIn: (email: string, password: string) => Promise<ApiResult<null>>;
  onSignUp: (email: string, password: string) => Promise<ApiResult<PasswordSignUpResult>>;
  onGoogle: () => Promise<ApiResult<null>>;
}

type Mode = 'sign-in' | 'sign-up';

/** Password sign-in and account creation, with Google when the project has it turned on. */
export function SignInForm({ onSignIn, onSignUp, onGoogle }: Props) {
  const uid = useId();
  const [providers, setProviders] = useState<Providers | null>(null);
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void signInProviders().then(found => {
      if (!cancelled) setProviders(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const changeMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    setConfirmation('');
    setError(null);
    setNotice(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError(msg('Geçerli bir e-posta adresi yaz.'));
      return;
    }
    if (!password) {
      setError(msg('Şifreni yaz.'));
      return;
    }
    if (mode === 'sign-up' && password !== confirmation) {
      setError(msg('Şifreler eşleşmiyor.'));
      return;
    }

    setBusy(true);
    if (mode === 'sign-in') {
      const result = await onSignIn(email, password);
      setBusy(false);
      if (!result.ok) setError(result.error);
      else setNotice(msg('Giriş başarılı. Planın açılıyor…'));
      return;
    }

    const result = await onSignUp(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
    } else if (result.data.emailConfirmationRequired) {
      setNotice(msg('Hesap isteği alındı. E-posta onayı açıksa gelen kutunu kontrol et; e-posta alamıyorsan Supabase’te Confirm email ayarını geçici olarak kapat.'));
    } else {
      setNotice(msg('Giriş başarılı. Planın açılıyor…'));
    }
  };

  const google = async () => {
    setBusy(true);
    setError(null);
    const result = await onGoogle();
    // On success the browser leaves for Google.
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-sunk p-1" aria-label={msg("Hesap işlemi")}>
        <button
          type="button"
          className={`rounded-[8px] px-3 py-2 text-[13.5px] font-medium transition-colors ${mode === 'sign-in' ? 'bg-card text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}
          aria-pressed={mode === 'sign-in'}
          disabled={busy}
          onClick={() => changeMode('sign-in')}
        >
          {msg("\n          Giriş yap\n        ")}</button>
        <button
          type="button"
          className={`rounded-[8px] px-3 py-2 text-[13.5px] font-medium transition-colors ${mode === 'sign-up' ? 'bg-card text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}
          aria-pressed={mode === 'sign-up'}
          disabled={busy}
          onClick={() => changeMode('sign-up')}
        >
          {msg("\n          Hesap oluştur\n        ")}</button>
      </div>

      {providers?.google && (
        <>
          <button type="button" className="btn btn-secondary w-full" onClick={() => void google()} disabled={busy}>
            <GoogleMark />
            {msg("\n            Google ile devam et\n          ")}</button>
          <div className="flex items-center gap-3 text-[12px] text-ink-3" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            {msg("\n            ya da e-posta ile\n            ")}<span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={event => void submit(event)} noValidate>
        <label htmlFor={`${uid}-email`} className="field-label">
          {msg("\n          E-posta\n        ")}</label>
        <input
          id={`${uid}-email`}
          type="email"
          className="input"
          autoComplete="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-error` : undefined}
          data-autofocus
          disabled={busy}
        />

        <label htmlFor={`${uid}-password`} className="field-label mt-4">
          {msg("\n          Şifre\n        ")}</label>
        <input
          id={`${uid}-password`}
          type="password"
          className="input"
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          value={password}
          onChange={event => setPassword(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-error` : undefined}
          disabled={busy}
        />

        {mode === 'sign-up' && (
          <>
            <label htmlFor={`${uid}-confirmation`} className="field-label mt-4">
              {msg("\n              Şifreyi tekrar yaz\n            ")}</label>
            <input
              id={`${uid}-confirmation`}
              type="password"
              className="input"
              autoComplete="new-password"
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${uid}-error` : undefined}
              disabled={busy}
            />
          </>
        )}

        {error && (
          <p id={`${uid}-error`} className="field-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="field-hint" role="status">
            {notice}
          </p>
        )}
        <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy}>
          {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {mode === 'sign-in' ? msg("E-posta ve şifreyle giriş yap") : msg("Hesap oluştur")}
        </button>
      </form>
    </div>
  );
}
