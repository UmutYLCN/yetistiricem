import { useId } from 'react';
import { Info } from 'lucide-react';
import type { DetailErrors } from '../../lib/campDraft';
import { addDays } from '../../lib/engine';
import { formatLongDate } from '../../lib/format';
import { MAX_CAMP_NAME } from '../../lib/studyCamp';
import { msg } from '../../lib/messages';


interface NameProps {
  value: string;
  error?: string;
  onChange: (name: string) => void;
}

export function CampNameField({ value, error, onChange }: NameProps) {
  const uid = useId();
  return (
    <div>
      <label className="field-label" htmlFor={`${uid}-name`}>
        {msg("\n        Kamp adı\n      ")}</label>
      <input
        id={`${uid}-name`}
        className="input"
        maxLength={MAX_CAMP_NAME}
        placeholder={msg("ör. TYT 2027 kampı")}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${uid}-name-${error ? 'error' : 'hint'}`}
        data-autofocus
      />
      {error ? (
        <p id={`${uid}-name-error`} className="field-error">
          {error}
        </p>
      ) : (
        <p id={`${uid}-name-hint`} className="field-hint">
          {msg("\n          Tüm branşlarını kapsayan programın adı.\n        ")}</p>
      )}
    </div>
  );
}

interface DatesProps {
  startDate: string;
  targetEndDate: string;
  today: string;
  errors: Pick<DetailErrors, 'startDate' | 'targetEndDate'>;
  onChange: (patch: { startDate?: string; targetEndDate?: string }) => void;
}

const TARGET_SHORTCUTS = [
  { label: '+1 ay', days: 30 },
  { label: '+3 ay', days: 91 },
  { label: '+6 ay', days: 182 },
];

/** Required start date and optional target end date. */
export function CampDatesFields({ startDate, targetEndDate, today, errors, onChange }: DatesProps) {
  const uid = useId();
  const startInPast = !errors.startDate && startDate < today;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="field-label" htmlFor={`${uid}-start`}>
          {msg("\n          Başlangıç tarihi\n        ")}</label>
        <input
          id={`${uid}-start`}
          type="date"
          required
          className="input tnum"
          value={startDate}
          onChange={e => onChange({ startDate: e.target.value })}
          aria-invalid={errors.startDate ? true : undefined}
          aria-describedby={`${uid}-start-${errors.startDate ? 'error' : 'hint'}`}
        />
        {errors.startDate ? (
          <p id={`${uid}-start-error`} className="field-error">
            {errors.startDate}
          </p>
        ) : (
          <p id={`${uid}-start-hint`} className={`field-hint ${startInPast ? 'font-medium text-warn' : ''}`}>
            {startInPast ? msg("Geçmiş bir gün: o günlere düşen videolar geciken görünür.") : msg("İlk ders günü bu tarihten başlar.")}
          </p>
        )}
      </div>

      <div>
        <label className="field-label" htmlFor={`${uid}-target`}>
          {msg("\n          Hedef bitiş tarihi ")}<span className="font-normal text-ink-3">{msg("(isteğe bağlı)")}</span>
        </label>
        <input
          id={`${uid}-target`}
          type="date"
          className="input tnum"
          min={startDate || undefined}
          value={targetEndDate}
          onChange={e => onChange({ targetEndDate: e.target.value })}
          aria-invalid={errors.targetEndDate ? true : undefined}
          aria-describedby={`${uid}-target-${errors.targetEndDate ? 'error' : 'hint'}`}
        />
        {errors.targetEndDate ? (
          <p id={`${uid}-target-error`} className="field-error">
            {errors.targetEndDate}
          </p>
        ) : (
          <p id={`${uid}-target-hint`} className="field-hint">
            {targetEndDate ? msg("Plan bu tarihe yetişiyor mu, önizlemede görürsün.") : msg("Boş bırakırsan plan tüm videolar bitene kadar sürer.")}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {!errors.startDate &&
            TARGET_SHORTCUTS.map(shortcut => {
              const date = addDays(startDate, shortcut.days);
              return (
                <button
                  key={shortcut.label}
                  type="button"
                  className="btn btn-ghost btn-sm border border-line"
                  aria-pressed={targetEndDate === date}
                  onClick={() => onChange({ targetEndDate: date })}
                  aria-label={`Hedef: ${formatLongDate(date)}`}
                >
                  {shortcut.label}
                </button>
              );
            })}
          {targetEndDate && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ targetEndDate: '' })}>
              {msg("\n              Hedefi kaldır\n            ")}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkloadNote({ branches, videos, minutes }: { branches: number; videos: number; minutes: string }) {
  return (
    <p className="flex items-start gap-2 rounded-[12px] bg-sunk px-3.5 py-3 text-[13px] text-ink-2">
      <Info className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
      <span>
        {msg("\n        Bu kampta ")}<span className="font-semibold text-ink">{branches} {msg(" branş")}</span>{msg(", ")}<span className="font-semibold text-ink">{videos} {msg(" video")}</span> {msg(" ve")}{msg(" ")}
        {msg("\n        yaklaşık ")}<span className="font-semibold text-ink">{minutes}</span> {msg(" video süresi var. Hedef tarih seçersen, ritmin buna yetip\n        yetmediğini önizlemede gösteririz.\n      ")}</span>
    </p>
  );
}
