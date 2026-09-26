import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { ApiResult, PasswordSignUpResult } from '../../lib/catalogApi';
import { MAX_DISPLAY_NAME, displayNameProblem } from '../../lib/catalog';
import { SignInForm } from '../auth/SignInForm';
import { Dialog } from '../ui/Dialog';

interface SignInProps {
  open: boolean;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<ApiResult<null>>;
  onSignUp: (email: string, password: string) => Promise<ApiResult<PasswordSignUpResult>>;
  onGoogle: () => Promise<ApiResult<null>>;
}

/** Sign-in from inside the app (the demo's Keşfet): publishing needs an account. */
export function SignInDialog({ open, onClose, onSignIn, onSignUp, onGoogle }: SignInProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={440}
      title="Giriş yap"
      description="Kamp yayınlamak ve kendi planını kurmak için giriş yapman gerekir."
    >
      {open && <SignInForm onSignIn={onSignIn} onSignUp={onSignUp} onGoogle={onGoogle} />}
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
