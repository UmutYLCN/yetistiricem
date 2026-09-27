import { useId, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BadgeCheck, Briefcase, Check, GraduationCap, ImageUp, NotebookPen, School, Trash2 } from 'lucide-react';
import { avatarFromFile } from '../../lib/avatarImage';
import type { ApiResult } from '../../lib/catalogApi';
import type { ProfileField, Stage, StudentProfile } from '../../lib/studentProfile';
import { AVATAR_SHAPES, MAX_BIO, MAX_PROFILE_TEXT, STAGE_OPTIONS, fieldsFor, gradeLabel, gradesFor, isAvatarShape, stageLabel } from '../../lib/studentProfile';
import { ProfileAvatar, ShapeSvg } from './ProfileAvatar';
import { SHAPE_ART } from './shapeArt';
import { msg } from '../../lib/messages';


const STAGE_ICONS: Record<Stage, LucideIcon> = {
  'high-school': School,
  'exam-prep': NotebookPen,
  university: GraduationCap,
  graduate: BadgeCheck,
  working: Briefcase,
};

/** The stage as a small green badge ("Üniversite öğrencisi"). */
export function StageChip({ stage, className = '' }: { stage: Stage; className?: string }) {
  const Icon = STAGE_ICONS[stage];
  return (
    <p className={`chip chip-forest ${className}`}>
      <Icon aria-hidden="true" />
      {msg(stageLabel(stage))}
    </p>
  );
}

interface AvatarPickerProps {
  value: string | null;
  name: string;
  onChange: (avatar: string | null) => void;
  /** Uploads a prepared photo; the result is the path the profile stores. */
  onUpload: (blob: Blob, extension: 'webp' | 'jpg') => Promise<ApiResult<string>>;
  /** Show the picked picture beside the choices. */
  preview?: boolean;
}

/** The eight drawn shapes, and a photo of the student's own. */
export function AvatarPicker({ value, name, onChange, onUpload, preview = true }: AvatarPickerProps) {
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photo = value !== null && !isAvatarShape(value);

  const pick = async (file: File) => {
    setBusy(true);
    setError(null);
    const prepared = await avatarFromFile(file);
    if (!prepared.ok) {
      setBusy(false);
      setError(prepared.error);
      return;
    }
    const uploaded = await onUpload(prepared.blob, prepared.extension);
    setBusy(false);
    if (uploaded.ok) onChange(uploaded.data);
    else setError(uploaded.error);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {preview && <ProfileAvatar avatar={value} name={name} size={84} className="self-center sm:self-auto" />}
      <div className="min-w-0 flex-1">
        <div role="radiogroup" aria-label={msg("Profil resmi")} className="grid grid-cols-8 gap-2">
          {AVATAR_SHAPES.map(shape => {
            const selected = value === shape;
            return (
              <button
                key={shape}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={msg(SHAPE_ART[shape].name)}
                title={msg(SHAPE_ART[shape].name)}
                onClick={() => {
                  setError(null);
                  onChange(shape);
                }}
                className={`relative aspect-square min-w-0 overflow-hidden rounded-full transition-transform hover:scale-105 ${
                  selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : 'ring-1 ring-line-strong'
                }`}
              >
                <ShapeSvg shape={shape} />
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            id={`${uid}-file`}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/*"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void pick(file);
            }}
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            <ImageUp aria-hidden="true" />
            {busy ? msg("Hazırlanıyor…") : photo ? msg("Başka fotoğraf seç") : msg("Kendi fotoğrafını yükle")}
          </button>
          {value !== null && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
              <Trash2 aria-hidden="true" />
              {msg("\n              Resmi kaldır\n            ")}</button>
          )}
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : (
          <p className="field-hint">{msg("Fotoğrafın kare olarak kırpılır. Profil resmin Keşfet’te kamplarının yanında görünür.")}</p>
        )}
      </div>
    </div>
  );
}

/** "Şu an ne yapıyorsun?": one card per stage. */
export function StagePicker({ value, onChange }: { value: Stage | null; onChange: (stage: Stage) => void }) {
  const uid = useId();
  return (
    <fieldset>
      <legend className="field-label">{msg("Şu an ne yapıyorsun?")}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {STAGE_OPTIONS.map(option => {
          const Icon = STAGE_ICONS[option.stage];
          const checked = value === option.stage;
          return (
            <label key={option.stage} className={`choice-card choice-card-sm items-center ${checked ? 'is-checked' : ''}`}>
              <input type="radio" name={`${uid}-stage`} className="visually-hidden" checked={checked} onChange={() => onChange(option.stage)} />
              <span className="choice-card-icon">
                <Icon aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-snug font-semibold text-ink">{msg(option.label)}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{msg(option.hint)}</span>
              </span>
              <span className="choice-card-check" aria-hidden="true">
                {checked && <Check strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The questions the chosen stage asks (school, department, class, profession). */
export function StageFields({ profile, onChange }: { profile: StudentProfile; onChange: (field: ProfileField, value: string | null) => void }) {
  const uid = useId();
  const specs = fieldsFor(profile.stage);
  if (specs.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {specs.map(spec => {
        const id = `${uid}-${spec.field}`;
        if (spec.field === 'grade') {
          return (
            <div key={spec.field}>
              <label htmlFor={id} className="field-label">
                {msg(spec.label)}
              </label>
              <select id={id} className="input" value={profile.grade ?? ''} onChange={event => onChange('grade', event.target.value || null)}>
                <option value="">{msg("Seç")}</option>
                {gradesFor(profile.stage).map(grade => (
                  <option key={grade} value={grade}>
                    {msg(gradeLabel(grade))}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        return (
          <div key={spec.field}>
            <label htmlFor={id} className="field-label">
              {msg(spec.label)}
            </label>
            <input
              id={id}
              className="input"
              value={profile[spec.field] ?? ''}
              maxLength={MAX_PROFILE_TEXT}
              placeholder={msg(spec.placeholder)}
              autoComplete="off"
              onChange={event => onChange(spec.field, event.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}

/** The optional bio: a few lines about goals, with a character count. */
export function BioField({ value, onChange }: { value: string | null; onChange: (bio: string) => void }) {
  const uid = useId();
  const length = (value ?? '').length;
  return (
    <div>
      <label htmlFor={`${uid}-bio`} className="field-label">
        {msg("\n        Hakkında ")}<span className="font-normal text-ink-3">{msg("(isteğe bağlı)")}</span>
      </label>
      <textarea
        id={`${uid}-bio`}
        className="input"
        rows={3}
        value={value ?? ''}
        maxLength={MAX_BIO}
        placeholder={msg("Örn. 2027’de tıp kazanmak için çalışıyorum. Her gün 3 saat, hafta sonu deneme.")}
        aria-describedby={`${uid}-bio-note`}
        onChange={event => onChange(event.target.value)}
      />
      <p id={`${uid}-bio-note`} className="field-hint flex justify-between gap-3">
        <span>{msg("Hedeflerin, neye çalıştığın ya da kendine bir not.")}</span>
        <span className={`tnum shrink-0 ${length >= MAX_BIO ? 'text-warn' : ''}`}>
          {length}{msg("/")}{MAX_BIO}
        </span>
      </p>
    </div>
  );
}
