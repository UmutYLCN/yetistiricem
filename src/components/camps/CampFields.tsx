import { useId } from 'react';
import { Check } from 'lucide-react';
import { PALETTE, SUBJECTS, defaultColorKey } from '../../lib/subjects';
import type { CampFieldValues } from './campForm';

interface Props {
  values: CampFieldValues;
  onChange: (values: CampFieldValues) => void;
  errors: Partial<Record<keyof CampFieldValues, string>>;
  showErrors: boolean;
}

export function CampFields({ values, onChange, errors, showErrors }: Props) {
  const uid = useId();
  const set = (patch: Partial<CampFieldValues>) => onChange({ ...values, ...patch });
  const activeColor = values.colorKey || defaultColorKey(values.subject);
  const subjects = SUBJECTS.includes(values.subject) ? SUBJECTS : [values.subject, ...SUBJECTS];
  const titleError = showErrors ? errors.title : undefined;
  const playlistError = showErrors ? errors.playlistUrl : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor={`${uid}-title`}>
          Kamp adı
        </label>
        <input
          id={`${uid}-title`}
          className="input"
          maxLength={80}
          placeholder="ör. TYT Matematik kampı"
          value={values.title}
          onChange={e => set({ title: e.target.value })}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? `${uid}-title-error` : undefined}
          data-autofocus
        />
        {titleError && (
          <p id={`${uid}-title-error`} className="field-error">
            {titleError}
          </p>
        )}
      </div>

      <div>
        <label className="field-label" htmlFor={`${uid}-subject`}>
          Ders
        </label>
        <select id={`${uid}-subject`} className="input" value={values.subject} onChange={e => set({ subject: e.target.value })}>
          {subjects.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="field-label">Renk</legend>
        <div className="flex flex-wrap gap-1">
          {PALETTE.map(color => {
            const selected = color.key === activeColor;
            return (
              <button
                key={color.key}
                type="button"
                onClick={() => set({ colorKey: color.key })}
                aria-pressed={selected}
                aria-label={color.label}
                title={color.label}
                className="flex size-7 items-center justify-center rounded-full"
                style={{ background: color.solid, boxShadow: selected ? `0 0 0 2px var(--color-card), 0 0 0 4px ${color.solid}` : undefined }}
              >
                {selected && <Check className="size-4 text-white" strokeWidth={3} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label className="field-label" htmlFor={`${uid}-channel`}>
          Kanal / kaynak <span className="font-normal text-ink-3">(isteğe bağlı)</span>
        </label>
        <input
          id={`${uid}-channel`}
          className="input"
          maxLength={80}
          placeholder="Videoların kanalı"
          value={values.channelName}
          onChange={e => set({ channelName: e.target.value })}
        />
      </div>

      <div>
        <label className="field-label" htmlFor={`${uid}-playlist`}>
          Oynatma listesi <span className="font-normal text-ink-3">(isteğe bağlı)</span>
        </label>
        <input
          id={`${uid}-playlist`}
          className="input"
          inputMode="url"
          placeholder="https://www.youtube.com/playlist?list=…"
          value={values.playlistUrl}
          onChange={e => set({ playlistUrl: e.target.value })}
          aria-invalid={playlistError ? true : undefined}
          aria-describedby={`${uid}-playlist-${playlistError ? 'error' : 'hint'}`}
        />
        {playlistError ? (
          <p id={`${uid}-playlist-error`} className="field-error">
            {playlistError}
          </p>
        ) : (
          <p id={`${uid}-playlist-hint`} className="field-hint">
            Yalnızca kaynağa dönmek için saklanır; videolar otomatik alınmaz.
          </p>
        )}
      </div>
    </div>
  );
}
