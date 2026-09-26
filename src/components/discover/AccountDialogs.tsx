import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { LoaderCircle, Mail } from 'lucide-react';
import type { ApiResult, Providers } from '../../lib/catalogApi';
import { signInProviders } from '../../lib/catalogApi';
import { MAX_DISPLAY_NAME, displayNameProblem } from '../../lib/catalog';
import { Dialog } from '../ui/Dialog';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The Google "G" (its brand colours live in the file, not in the theme). */
function GoogleMark() {
  return <img src="/google-g.svg" alt="" className="size-4" />;
}

interface SignInProps {
  open: boolean;
  onClose: () => void;
  onEmail: (email: string) => Promise<ApiResult<null>>;
  onGoogle: () => Promise<ApiResult<null>>;
}

/** Sign-in for publishing: an e-mailed magic link, or Google when the project has it turned on. */
export function SignInDialog({ open, onClose, onEmail, onGoogle }: SignInProps) {
  const uid = useId();
  const [providers, setProviders] = useState<Providers | null>(null);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || providers) return;
    let cancelled = false;
    void signInProviders().then(found => {
      if (!cancelled) setProviders(found);
    });
    return () => {
      cancelled = true;
    };
  }, [open, providers]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError('Geçerli bir e-posta adresi yaz.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onEmail(email);
    setBusy(false);
    if (result.ok) setSentTo(email.trim());
    else setError(result.error);
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
    <Dialog
      open={open}
      onClose={onClose}
      width={440}
      title="Keşfet’e giriş yap"
      description="Kamp yayınlamak için giriş yapman gerekir. Kampları incelemek ve kendi planına eklemek için gerekmez."
    >
      {sentTo ? (
        <div className="flex flex-col items-center py-4 text-center">
          <span className="grid size-12 place-items-center rounded-[14px] bg-forest-soft text-forest" aria-hidden="true">
            <Mail className="size-6" />
          </span>
          <p className="mt-4 font-semibold text-ink">E-postana bir giriş bağlantısı gönderdik</p>
          <p className="mt-1 max-w-[20rem] text-[13.5px] text-ink-2">
            <span className="font-semibold break-all text-ink">{sentTo}</span> adresindeki bağlantıya bu cihazda tıkla; Keşfet’e giriş
            yapmış olarak dönersin.
          </p>
          <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setSentTo(null)}>
            Başka bir adres kullan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {providers?.google && (
            <>
              <button type="button" className="btn btn-secondary w-full" onClick={() => void google()} disabled={busy}>
                <GoogleMark />
                Google ile devam et
              </button>
              <div className="flex items-center gap-3 text-[12px] text-ink-3" aria-hidden="true">
                <span className="h-px flex-1 bg-line" />
                ya da
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}
          <form onSubmit={event => void submit(event)} noValidate>
            <label htmlFor={`${uid}-email`} className="field-label">
              E-posta
            </label>
            <input
              id={`${uid}-email`}
              type="email"
              className="input"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${uid}-error` : `${uid}-hint`}
              data-autofocus
            />
            {error ? (
              <p id={`${uid}-error`} className="field-error" role="alert">
                {error}
              </p>
            ) : (
              <p id={`${uid}-hint`} className="field-hint">
                E-posta adresin kimseye gösterilmez; kamplarında yalnızca görünen adın yer alır.
              </p>
            )}
            <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Mail aria-hidden="true" />}
              Giriş bağlantısı gönder
            </button>
          </form>
        </div>
      )}
    </Dialog>
  );
}

interface RenameProps {
  open: boolean;
  current: string | null;
  onClose: () => void;
  onSave: (name: string) => Promise<ApiResult<string>>;
}

/** The public name shown on the student's published camps. */
export function RenameDialog({ open, current, onClose, onSave }: RenameProps) {
  const uid = useId();
  const [name, setName] = useState(current ?? '');
  const [shownFor, setShownFor] = useState(open);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (open !== shownFor) {
    setShownFor(open);
    if (open) {
      setName(current ?? '');
      setError(null);
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const problem = displayNameProblem(name);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const result = await onSave(name);
    setBusy(false);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={420}
      title="Görünen adın"
      description="Yayınladığın kamplarda bu ad görünür."
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" form={`${uid}-form`} className="btn btn-primary" disabled={busy}>
            Kaydet
          </button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={event => void save(event)} noValidate>
        <label htmlFor={`${uid}-name`} className="field-label">
          Ad
        </label>
        <input
          id={`${uid}-name`}
          className="input"
          value={name}
          maxLength={MAX_DISPLAY_NAME}
          onChange={event => setName(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-error` : undefined}
          data-autofocus
        />
        {error && (
          <p id={`${uid}-error`} className="field-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
