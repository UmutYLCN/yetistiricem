import { useId } from 'react';
import type { ReactNode } from 'react';
import { CalendarRange, Check, Minus, Plus, RotateCcw, Sparkles, TriangleAlert, Wand2 } from 'lucide-react';
import type { PlanMode, RhythmPreset, SubjectPlaylist } from '../../types';
import type { RhythmDraft, RhythmErrors } from '../../lib/campDraft';
import { assignLeftovers, startManualWeek, syncManual } from '../../lib/campDraft';
import { getEffectiveMinutes } from '../../lib/engine';
import { LONG_WEEKDAYS, SHORT_WEEKDAYS, WEEK_ORDER, formatMinutes } from '../../lib/format';
import type { AutoRhythm, ManualRhythm, WeekdayType } from '../../lib/studyCamp';
import { MAX_DAILY_HOURS, MIN_DAILY_HOURS, PRESET_ORDER, RHYTHM_PRESETS, emptyWeekPlan, resolveAutoRhythm, suggestWeekPlan, unassignedBranches } from '../../lib/studyCamp';
import { resolveColor } from '../../lib/subjects';

interface Props {
  value: RhythmDraft;
  onChange: (next: RhythmDraft) => void;
  branches: SubjectPlaylist[];
  errors: RhythmErrors;
  showErrors: boolean;
}

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
const PRACTICE = [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1];

/**
 * How the week is formed. The user first picks automatic or manual; only
 * then do the fields of that choice appear.
 */
export function RhythmEditor({ value, onChange, branches, errors, showErrors }: Props) {
  const uid = useId();
  const setMode = (mode: PlanMode) => {
    if (mode === value.mode) return;
    const empty = value.manual.weekPlan.every(day => day.length === 0);
    onChange({
      ...value,
      mode,
      // The first switch to manual starts from a suggested week, in step with the automatic rhythm.
      manual: mode === 'manual' ? (empty ? startManualWeek(value, branches) : syncManual(value.manual, branches)) : value.manual,
    });
  };

  return (
    <div className="space-y-6">
      <fieldset aria-describedby={showErrors && errors.mode ? `${uid}-mode-error` : undefined}>
        <legend className="mb-2.5 text-[15px] font-semibold text-ink">Haftalık plan nasıl oluşsun?</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <ChoiceCard
            name={`${uid}-mode`}
            checked={value.mode === 'auto'}
            onSelect={() => setMode('auto')}
            icon={<Sparkles aria-hidden="true" />}
            title="Otomatik dağıt"
            body="Günlerini, süreni ve günde kaç branş istediğini söyle; planlayıcı branşları sırayla dağıtsın."
          />
          <ChoiceCard
            name={`${uid}-mode`}
            checked={value.mode === 'manual'}
            onSelect={() => setMode('manual')}
            icon={<CalendarRange aria-hidden="true" />}
            title="Branşları günlere ben yerleştireceğim"
            body="Her güne hangi branşların geleceğini sen seç; o branşların sıradaki videoları kendiliğinden gelir."
          />
        </div>
        {showErrors && errors.mode && (
          <p id={`${uid}-mode-error`} className="field-error" role="alert">
            {errors.mode}
          </p>
        )}
      </fieldset>

      {value.mode === 'auto' && (
        <AutoFields value={value.auto} branchCount={branches.length} errors={errors} showErrors={showErrors} onChange={auto => onChange({ ...value, auto })} />
      )}
      {value.mode === 'manual' && (
        <ManualFields
          value={value.manual}
          branches={branches}
          perDay={resolveAutoRhythm(value.auto).perDay}
          errors={errors}
          showErrors={showErrors}
          onChange={manual => onChange({ ...value, manual })}
        />
      )}

      {value.mode !== null && (
        <details className="group rounded-[12px] border border-line bg-card">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[14px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            İzleme hızı ve tekrar payı
            <span className="text-[12.5px] font-normal text-ink-3">
              {value.playbackSpeed.toLocaleString('tr-TR')}x · %{Math.round(value.practiceMultiplier * 100)}
            </span>
          </summary>
          <div className="grid gap-4 border-t border-line px-4 py-4 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor={`${uid}-speed`}>
                İzleme hızı
              </label>
              <select
                id={`${uid}-speed`}
                className="input"
                value={value.playbackSpeed}
                onChange={e => onChange({ ...value, playbackSpeed: Number(e.target.value) })}
              >
                {withCurrent(SPEEDS, value.playbackSpeed).map(s => (
                  <option key={s} value={s}>
                    {s.toLocaleString('tr-TR')}x{s === 1 ? ' (normal)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor={`${uid}-practice`}>
                Tekrar ve soru payı
              </label>
              <select
                id={`${uid}-practice`}
                className="input"
                value={value.practiceMultiplier}
                onChange={e => onChange({ ...value, practiceMultiplier: Number(e.target.value) })}
              >
                {withCurrent(PRACTICE, value.practiceMultiplier).map(p => (
                  <option key={p} value={p}>
                    %{Math.round(p * 100)}
                  </option>
                ))}
              </select>
            </div>
            <p className="self-end rounded-[10px] bg-sunk px-3 py-2.5 text-[12.5px] text-ink-2">
              1 saatlik video ≈{' '}
              <span className="font-semibold text-ink">
                {formatMinutes(getEffectiveMinutes(60, value))}
              </span>{' '}
              çalışma
            </p>
          </div>
        </details>
      )}
    </div>
  );
}

function withCurrent(options: number[], current: number): number[] {
  return options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
}

function ChoiceCard({
  name,
  checked,
  onSelect,
  icon,
  title,
  body,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <label className={`choice-card ${checked ? 'is-checked' : ''}`}>
      <input type="radio" name={name} className="visually-hidden" checked={checked} onChange={onSelect} />
      <span className="choice-card-icon">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-[13px] leading-snug text-ink-2">{body}</span>
      </span>
      <span className="choice-card-check" aria-hidden="true">
        {checked && <Check strokeWidth={3} />}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Automatic

function AutoFields({
  value,
  branchCount,
  errors,
  showErrors,
  onChange,
}: {
  value: AutoRhythm;
  branchCount: number;
  errors: RhythmErrors;
  showErrors: boolean;
  onChange: (next: AutoRhythm) => void;
}) {
  const uid = useId();
  const resolved = resolveAutoRhythm(value);
  const preset = RHYTHM_PRESETS[value.preset];
  const nonStudy = WEEK_ORDER.filter(d => !resolved.days.includes(d));
  const mockDay = resolved.mockDays[0];
  const maxPerDay = Math.max(1, Math.min(8, branchCount || 1));

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="field-label">Ritim ön ayarı</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PRESET_ORDER.map(key => (
            <PresetOption key={key} name={`${uid}-preset`} preset={key} checked={value.preset === key} onSelect={() => onChange({ ...value, preset: key })} />
          ))}
        </div>
        <p className="field-hint">
          Aşağıdakiler isteğe bağlı: dokunmadığın alanı seçtiğin ön ayar doldurur. Kararsızsan “Dengeli” ile devam et.
        </p>
      </fieldset>

      <div className="grid gap-5 rounded-[14px] border border-line bg-card p-4 sm:grid-cols-2 sm:p-5">
        <div className="sm:col-span-2">
          <FieldHead
            id={`${uid}-days`}
            label="Çalışma günleri"
            custom={value.days !== null || value.mockDays !== null}
            onReset={() => onChange({ ...value, days: null, mockDays: null })}
          />
          <WeekdayToggles
            labelledBy={`${uid}-days`}
            selected={resolved.days}
            onToggle={dow =>
              onChange({
                ...value,
                days: resolved.days.includes(dow) ? resolved.days.filter(d => d !== dow) : [...resolved.days, dow],
                mockDays: resolved.mockDays.filter(d => d !== dow),
              })
            }
          />
          {showErrors && errors.days ? (
            <p className="field-error" role="alert">
              {errors.days}
            </p>
          ) : (
            <p className="field-hint">Seçmediğin günler dinlenme günü olur.</p>
          )}
        </div>

        <div>
          <FieldHead id={`${uid}-hours`} label="Günlük çalışma süresi" custom={value.hours !== null} onReset={() => onChange({ ...value, hours: null })} />
          <HoursStepper labelledBy={`${uid}-hours`} hours={resolved.hours} onChange={hours => onChange({ ...value, hours })} />
          {showErrors && errors.hours ? <p className="field-error">{errors.hours}</p> : <p className="field-hint">Video, not ve soru çözme dahil.</p>}
        </div>

        <div>
          <FieldHead id={`${uid}-perday`} label="Günde kaç farklı branş" custom={value.perDay !== null} onReset={() => onChange({ ...value, perDay: null })} />
          <Stepper
            labelledBy={`${uid}-perday`}
            value={resolved.perDay}
            min={1}
            max={Math.max(maxPerDay, resolved.perDay)}
            format={n => `${n} branş`}
            decreaseLabel="Günlük branş sayısını azalt"
            increaseLabel="Günlük branş sayısını artır"
            onChange={perDay => onChange({ ...value, perDay })}
          />
          <p className="field-hint">
            {branchCount > 0 && resolved.perDay > branchCount
              ? `Kampında ${branchCount} branş var; her gün en fazla ${branchCount} farklı branş çalışılır.`
              : 'Aynı gün en fazla bu kadar farklı branşa ait video gelir.'}
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor={`${uid}-mock`}>
            Deneme günü <span className="font-normal text-ink-3">(isteğe bağlı)</span>
          </label>
          <select
            id={`${uid}-mock`}
            className="input max-w-xs"
            value={mockDay ?? ''}
            onChange={e => onChange({ ...value, days: resolved.days, mockDays: e.target.value === '' ? [] : [Number(e.target.value)] })}
          >
            <option value="">Deneme günü yok</option>
            {nonStudy.map(d => (
              <option key={d} value={d}>
                {LONG_WEEKDAYS[d]}
              </option>
            ))}
          </select>
          <p className="field-hint">
            {nonStudy.length === 0 ? 'Her gün çalışma günü; deneme için bir günü boşalt.' : 'Deneme günlerine video konmaz.'}
          </p>
        </div>
      </div>
      <p className="text-[12.5px] text-ink-3">
        Ön ayar: {preset.label} · {preset.summary}.
      </p>
    </div>
  );
}

function PresetOption({ name, preset, checked, onSelect }: { name: string; preset: RhythmPreset; checked: boolean; onSelect: () => void }) {
  const info = RHYTHM_PRESETS[preset];
  return (
    <label className={`choice-card choice-card-sm ${checked ? 'is-checked' : ''}`}>
      <input type="radio" name={name} className="visually-hidden" checked={checked} onChange={onSelect} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[14.5px] font-semibold text-ink">
          {info.label}
          {preset === 'balanced' && <span className="chip chip-forest">Önerilen</span>}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{info.summary}</span>
      </span>
    </label>
  );
}

function FieldHead({ id, label, custom, onReset }: { id: string; label: string; custom: boolean; onReset: () => void }) {
  return (
    <div className="mb-2 flex min-h-6 flex-wrap items-center justify-between gap-2">
      <span id={id} className="text-[13px] font-semibold text-ink">
        {label}
      </span>
      {custom ? (
        <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold text-forest hover:underline" onClick={onReset}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Ön ayara dön
          <span className="sr-only">({label})</span>
        </button>
      ) : (
        <span className="text-[12px] text-ink-3">Ön ayardan</span>
      )}
    </div>
  );
}

export function WeekdayToggles({
  labelledBy,
  selected,
  onToggle,
  disabledDays = [],
}: {
  labelledBy: string;
  selected: number[];
  onToggle: (dow: number) => void;
  disabledDays?: number[];
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5" role="group" aria-labelledby={labelledBy}>
      {WEEK_ORDER.map(dow => {
        const on = selected.includes(dow);
        return (
          <button
            key={dow}
            type="button"
            aria-pressed={on}
            aria-label={LONG_WEEKDAYS[dow]}
            onClick={() => onToggle(dow)}
            disabled={disabledDays.includes(dow)}
            className={`day-toggle ${on ? 'is-on' : ''}`}
          >
            {SHORT_WEEKDAYS[dow]}
          </button>
        );
      })}
    </div>
  );
}

export function HoursStepper({ labelledBy, hours, onChange }: { labelledBy: string; hours: number; onChange: (hours: number) => void }) {
  return (
    <Stepper
      labelledBy={labelledBy}
      value={hours}
      min={MIN_DAILY_HOURS}
      max={MAX_DAILY_HOURS}
      step={0.5}
      format={h => formatMinutes(h * 60)}
      decreaseLabel="Günlük süreyi yarım saat azalt"
      increaseLabel="Günlük süreyi yarım saat artır"
      onChange={onChange}
    />
  );
}

function Stepper({
  labelledBy,
  value,
  min,
  max,
  step = 1,
  format,
  decreaseLabel,
  increaseLabel,
  onChange,
}: {
  labelledBy: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (value: number) => void;
}) {
  // Snap odd stored values (e.g. 2.75 h) onto the step grid when changed.
  const down = Math.max(min, Math.ceil(value / step - 1 - 1e-9) * step);
  const up = Math.min(max, Math.floor(value / step + 1 + 1e-9) * step);
  return (
    <div className="stepper" role="group" aria-labelledby={labelledBy}>
      <button type="button" onClick={() => onChange(down)} disabled={value <= min} aria-label={decreaseLabel}>
        <Minus aria-hidden="true" />
      </button>
      <output className="tnum" aria-live="polite">
        {format(value)}
      </output>
      <button type="button" onClick={() => onChange(up)} disabled={value >= max} aria-label={increaseLabel}>
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual

const DAY_TYPE_LABEL: Record<WeekdayType, string> = { study: 'Ders', mock: 'Deneme', rest: 'Dinlenme' };

function ManualFields({
  value,
  branches,
  perDay,
  errors,
  showErrors,
  onChange,
}: {
  value: ManualRhythm;
  branches: SubjectPlaylist[];
  perDay: number;
  errors: RhythmErrors;
  showErrors: boolean;
  onChange: (next: ManualRhythm) => void;
}) {
  const uid = useId();
  const left = unassignedBranches(value, branches);
  const setType = (dow: number, type: WeekdayType) =>
    onChange({ ...value, dayTypes: value.dayTypes.map((t, d) => (d === dow ? type : t)) });
  const toggleBranch = (dow: number, id: string) => {
    const day = value.weekPlan[dow];
    const next = day.includes(id) ? day.filter(b => b !== id) : [...day, id];
    onChange({
      ...value,
      weekPlan: value.weekPlan.map((d, i) => (i === dow ? branches.map(b => b.id).filter(b => next.includes(b)) : d)),
    });
  };
  const studyDays = WEEK_ORDER.filter(d => value.dayTypes[d] === 'study');
  // With no study day yet, suggest Monday–Saturday.
  const suggest = () => {
    const days = studyDays.length > 0 ? studyDays : [1, 2, 3, 4, 5, 6];
    onChange({
      ...value,
      dayTypes: value.dayTypes.map((t, d) => (days.includes(d) ? 'study' : t)),
      weekPlan: suggestWeekPlan(branches.map(b => b.id), days, Math.min(perDay, branches.length)),
    });
  };
  const daysOf = (id: string) => WEEK_ORDER.filter(d => value.dayTypes[d] === 'study' && value.weekPlan[d].includes(id));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <span id={`${uid}-hours`} className="field-label">
            Günlük çalışma süresi
          </span>
          <HoursStepper labelledBy={`${uid}-hours`} hours={value.hours} onChange={hours => onChange({ ...value, hours })} />
          {showErrors && errors.hours ? (
            <p className="field-error">{errors.hours}</p>
          ) : (
            <p className="field-hint">Bir güne bundan fazlası konmaz; sığmayan video sonraki gününe kalır.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={suggest}
          >
            <Wand2 aria-hidden="true" />
            Önerilen dağılım
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...value, weekPlan: emptyWeekPlan() })}>
            Temizle
          </button>
        </div>
      </div>

      <fieldset>
        <legend className="field-label">Haftalık yerleşim</legend>
        <p className="-mt-1 mb-2.5 text-[12.5px] text-ink-3">
          Her ders gününe branş seç. O gün, seçtiğin branşların sıradaki videoları liste sırasıyla gelir.
        </p>
        <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-card">
          {WEEK_ORDER.map(dow => {
            const type = value.dayTypes[dow];
            const dayError = showErrors ? errors.weekdays[dow] : undefined;
            return (
              <li key={dow} className="px-3 py-3 sm:px-4" aria-labelledby={`${uid}-day-${dow}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span id={`${uid}-day-${dow}`} className="text-[14.5px] font-semibold text-ink">
                    {LONG_WEEKDAYS[dow]}
                    {type === 'study' && value.weekPlan[dow].length > 0 && (
                      <span className="tnum ml-2 text-[12.5px] font-normal text-ink-3">{value.weekPlan[dow].length} branş</span>
                    )}
                  </span>
                  <div className="segmented" role="group" aria-label={`${LONG_WEEKDAYS[dow]} gün türü`}>
                    {(['study', 'mock', 'rest'] as const).map(kind => (
                      <button key={kind} type="button" aria-pressed={type === kind} onClick={() => setType(dow, kind)}>
                        {DAY_TYPE_LABEL[kind]}
                      </button>
                    ))}
                  </div>
                </div>
                {type === 'study' && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label={`${LONG_WEEKDAYS[dow]} branşları`}>
                    {branches.map(branch => {
                      const on = value.weekPlan[dow].includes(branch.id);
                      const color = resolveColor(branch.colorTag, branch.subject);
                      return (
                        <button
                          key={branch.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleBranch(dow, branch.id)}
                          className={`branch-chip ${on ? 'is-on' : ''}`}
                          style={on ? { background: color.soft, borderColor: color.solid, color: color.solid } : undefined}
                        >
                          <span className="size-2 shrink-0 rounded-full" style={{ background: color.solid }} aria-hidden="true" />
                          <span className="truncate">{branch.subject || 'Adsız branş'}</span>
                          {on && <Check className="size-3.5 shrink-0" strokeWidth={3} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {type !== 'study' && (
                  <p className="mt-1 text-[12.5px] text-ink-3">{type === 'mock' ? 'Video yok; deneme çözme günü.' : 'Video yok; dinlenme günü.'}</p>
                )}
                {dayError && <p className="field-error">{dayError}</p>}
              </li>
            );
          })}
        </ul>
        {showErrors && errors.days && (
          <p className="field-error" role="alert">
            {errors.days}
          </p>
        )}
      </fieldset>

      {branches.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12.5px] font-semibold tracking-wide text-ink-3 uppercase">Branşların haftası</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
            {branches.map(branch => {
              const days = daysOf(branch.id);
              const color = resolveColor(branch.colorTag, branch.subject);
              return (
                <li key={branch.id} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: color.solid }} aria-hidden="true" />
                  <span className="font-medium text-ink">{branch.subject}</span>
                  <span className={days.length === 0 ? 'font-semibold text-accent-strong' : 'text-ink-3'}>
                    {days.length === 0 ? 'hiçbir gün' : days.map(d => SHORT_WEEKDAYS[d]).join(', ')}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {left.length > 0 && (
        <div className={`callout ${showErrors ? 'callout-accent' : 'callout-warn'} flex-wrap items-center`} role={showErrors ? 'alert' : undefined}>
          <TriangleAlert className="size-4 shrink-0 text-accent-strong" aria-hidden="true" />
          <p className="min-w-[12rem] flex-1 text-[13.5px] text-ink-2">
            <span className="font-semibold text-ink">{left.map(b => b.subject).join(', ')}</span> henüz hiçbir güne yerleşmedi. Bir güne
            eklemezsen bu branşın videoları plana giremez.
          </p>
          {studyDays.length > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(assignLeftovers(value, branches))}>
              <Wand2 aria-hidden="true" />
              En boş günlere yerleştir
            </button>
          )}
        </div>
      )}
    </div>
  );
}
