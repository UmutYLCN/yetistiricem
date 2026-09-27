import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ApiResult } from '../../lib/catalogApi';
import { MAX_DISPLAY_NAME, displayNameProblem } from '../../lib/catalog';
import type { StudentProfile } from '../../lib/studentProfile';
import { EMPTY_PROFILE } from '../../lib/studentProfile';
import { Dialog } from '../ui/Dialog';
import { AvatarPicker, BioField, StageFields, StagePicker } from './ProfileForm';

interface Props {
  open: boolean;
  displayName: string | null;
  profile: StudentProfile | null;
  onRename: (name: string) => Promise<ApiResult<string>>;
  onSave: (profile: StudentProfile) => Promise<ApiResult<StudentProfile>>;
  onUploadAvatar: (blob: Blob, extension: 'webp' | 'jpg') => Promise<ApiResult<string>>;
}

const STEPS = [
  { title: 'Hoş geldin!', description: 'Önce seni tanıyalım: bir profil resmi seç ve adını kontrol et.' },
  { title: 'Şu an neredesin?', description: 'Planını kime göre kurduğumuzu bilmek için.' },
  { title: 'Biraz daha detay', description: 'Hepsi isteğe bağlı; sonra Profil’den değiştirebilirsin.' },
] as const;

/**
 * The welcome questions after the first sign-in: a picture, the name, and
 * where the student is (school, department, class, profession). Skipping
 * saves nothing but the answer "asked", so they are not asked again.
 */
export function OnboardingDialog({ open, displayName, profile, onRename, onSave, onUploadAvatar }: Props) {
  const uid = useId();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(displayName ?? '');
  const [draft, setDraft] = useState<StudentProfile>(profile ?? EMPTY_PROFILE);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const last = step === STEPS.length - 1;

  const finish = async (skipped: boolean) => {
    setBusy(true);
    setError(null);
    const trimmed = name.trim();
    if (!skipped && trimmed && trimmed !== (displayName ?? '')) {
      const renamed = await onRename(trimmed);
      if (!renamed.ok) {
        setBusy(false);
        setStep(0);
        setNameError(renamed.error);
        return;
      }
    }
    const answered = skipped ? { ...EMPTY_PROFILE, avatar: draft.avatar } : draft;
    const result = await onSave({ ...answered, onboardedAt: new Date().toISOString() });
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  const next = (event: FormEvent) => {
    event.preventDefault();
    if (step === 0) {
      const problem = displayNameProblem(name);
      if (problem) {
        setNameError(problem);
        return;
      }
    }
    if (last) void finish(false);
    else setStep(step + 1);
  };

  const { title, description } = STEPS[step];

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) void finish(true);
      }}
      width={600}
      eyebrow={`Adım ${step + 1} / ${STEPS.length}`}
      title={title}
      description={description}
      dismissOnBackdrop={false}
      subheader={
        <div className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-forest' : 'bg-sunk'}`} />
          ))}
        </div>
      }
      footer={
        <>
          {step > 0 ? (
            <button type="button" className="btn btn-ghost mr-auto" onClick={() => setStep(step - 1)} disabled={busy}>
              <ArrowLeft aria-hidden="true" />
              Geri
            </button>
          ) : (
            <button type="button" className="btn btn-ghost mr-auto" onClick={() => void finish(true)} disabled={busy}>
              Şimdilik geç
            </button>
          )}
          <button type="submit" form={`${uid}-form`} className="btn btn-primary" disabled={busy || (step === 1 && draft.stage === null)}>
            {last ? (busy ? 'Kaydediliyor…' : 'Başlayalım') : 'Devam'}
            {!last && <ArrowRight aria-hidden="true" />}
          </button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={next} noValidate className="space-y-5 pt-4">
        {step === 0 && (
          <>
            <AvatarPicker value={draft.avatar} name={name} onChange={avatar => setDraft(d => ({ ...d, avatar }))} onUpload={onUploadAvatar} />
            <div>
              <label htmlFor={`${uid}-name`} className="field-label">
                Adın
              </label>
              <input
                id={`${uid}-name`}
                className="input"
                value={name}
                maxLength={MAX_DISPLAY_NAME}
                onChange={event => {
                  setName(event.target.value);
                  setNameError(null);
                }}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={`${uid}-name-note`}
                data-autofocus
              />
              {nameError ? (
                <p id={`${uid}-name-note`} className="field-error" role="alert">
                  {nameError}
                </p>
              ) : (
                <p id={`${uid}-name-note`} className="field-hint">
                  Keşfet’te yayınladığın kamplarda bu ad görünür; e-postan gösterilmez.
                </p>
              )}
            </div>
          </>
        )}
        {step === 1 && <StagePicker value={draft.stage} onChange={stage => setDraft(d => ({ ...d, stage }))} />}
        {step === 2 && (
          <>
            <StageFields profile={draft} onChange={(field, value) => setDraft(d => ({ ...d, [field]: value }))} />
            <BioField value={draft.bio} onChange={bio => setDraft(d => ({ ...d, bio }))} />
          </>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
