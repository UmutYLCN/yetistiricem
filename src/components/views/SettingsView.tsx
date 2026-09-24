import { useId, useRef, useState } from 'react';
import { Download, Eye, LogOut, RotateCcw, Upload } from 'lucide-react';
import type { UserPreferences } from '../../types';
import { focusFirstInvalid } from '../../lib/dom';
import { getEffectiveMinutes, isDateKey } from '../../lib/engine';
import { LONG_WEEKDAYS, WEEK_ORDER, formatMinutes } from '../../lib/format';
import { PageHeader } from '../layout/PageHeader';

type DayKind = 'study' | 'mock' | 'rest';

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
const PRACTICE = [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1];
const MAX_SUBJECTS = [1, 2, 3, 4, 5, 6];
const DAY_KIND_LABEL: Record<DayKind, string> = { study: 'Çalışma', mock: 'Deneme', rest: 'Dinlenme' };

interface Draft {
  hours: string;
  speed: number;
  practice: number;
  maxSubjects: number;
  startDate: string;
  days: DayKind[]; // index = weekday (0 = Sunday)
}

function toDraft(p: UserPreferences): Draft {
  return {
    hours: String(p.dailyStudyHours).replace('.', ','),
    speed: p.playbackSpeed,
    practice: p.practiceMultiplier,
    maxSubjects: p.maxSubjectsPerDay,
    startDate: p.startDate,
    days: Array.from({ length: 7 }, (_, dow) =>
      p.mockExamDays.includes(dow) ? 'mock' : p.restDays.includes(dow) || !p.activeDays.includes(dow) ? 'rest' : 'study'
    ),
  };
}

interface Validation {
  hours?: string;
  startDate?: string;
  days?: string;
}

function validate(d: Draft): { errors: Validation; prefs: UserPreferences | null } {
  const errors: Validation = {};
  const hours = Number(d.hours.trim().replace(',', '.'));
  if (!d.hours.trim() || !Number.isFinite(hours)) errors.hours = 'Saat olarak bir sayı yaz (ör. 3 ya da 2,5).';
  else if (hours < 0.5) errors.hours = 'Günde en az yarım saat olmalı.';
  else if (hours > 16) errors.hours = 'Günde en fazla 16 saat seçebilirsin.';
  if (!isDateKey(d.startDate) || d.startDate < '2000-01-01' || d.startDate > '2100-12-31') {
    errors.startDate = 'Geçerli bir başlangıç tarihi seç.';
  }
  if (!d.days.includes('study')) errors.days = 'Haftada en az bir çalışma günü olmalı; yoksa videolar hiçbir güne yerleşmez.';
  if (Object.keys(errors).length > 0) return { errors, prefs: null };
  const byKind = (kind: DayKind) => d.days.flatMap((k, dow) => (k === kind ? [dow] : []));
  return {
    errors,
    prefs: {
      dailyStudyHours: Math.round(hours * 100) / 100,
      playbackSpeed: d.speed,
      practiceMultiplier: d.practice,
      maxSubjectsPerDay: d.maxSubjects,
      activeDays: byKind('study'),
      restDays: byKind('rest'),
      mockExamDays: byKind('mock'),
      startDate: d.startDate,
    },
  };
}

function samePrefs(a: UserPreferences, b: UserPreferences): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface Props {
  preferences: UserPreferences;
  onSave: (prefs: UserPreferences) => void;
  isDemo: boolean;
  campCount: number;
  onBackup: () => void;
  onRestoreFile: (file: File) => void;
  onReset: () => void;
  onStartDemo: () => void;
  onExitDemo: () => void;
}

export function SettingsView({ preferences, onSave, isDemo, campCount, onBackup, onRestoreFile, onReset, onStartDemo, onExitDemo }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(preferences));
  const [basis, setBasis] = useState(preferences);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  // Saved preferences changed elsewhere (restore, reset, demo): start over from them.
  if (basis !== preferences) {
    setBasis(preferences);
    setDraft(toDraft(preferences));
    setSubmitted(false);
  }

  const { errors, prefs } = validate(draft);
  const dirty = prefs ? !samePrefs(prefs, preferences) : true;
  // An emptied hours field only complains once the user tries to save.
  const hoursError = errors.hours && (submitted || draft.hours.trim() !== '') ? errors.hours : undefined;
  const set = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }));

  const save = () => {
    setSubmitted(true);
    if (!prefs) {
      focusFirstInvalid();
      return;
    }
    onSave(prefs);
  };

  const exampleMinutes = prefs ? getEffectiveMinutes(60, prefs) : null;
  const speedOptions = SPEEDS.includes(draft.speed) ? SPEEDS : [...SPEEDS, draft.speed].sort((a, b) => a - b);
  const practiceOptions = PRACTICE.includes(draft.practice) ? PRACTICE : [...PRACTICE, draft.practice].sort((a, b) => a - b);
  const subjectOptions = MAX_SUBJECTS.includes(draft.maxSubjects) ? MAX_SUBJECTS : [...MAX_SUBJECTS, draft.maxSubjects];

  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <PageHeader title="Ayarlar" subtitle={isDemo ? 'Demo açık: buradaki değişiklikler kaydedilmez.' : undefined} />

      <section className="card" aria-labelledby={`${uid}-plan`}>
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <h2 id={`${uid}-plan`} className="text-[16px] font-semibold text-ink">
            Çalışma temposu
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Kaydettiğinde plan bu ayarlarla yeniden dağıtılır. Tamamlanan görevlerin ve ileri taşımaların korunur.
          </p>
        </div>

        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div>
            <label className="field-label" htmlFor={`${uid}-hours`}>
              Günlük çalışma süresi (saat)
            </label>
            <input
              id={`${uid}-hours`}
              className="input tnum"
              inputMode="decimal"
              value={draft.hours}
              onChange={e => set({ hours: e.target.value })}
              aria-invalid={hoursError ? true : undefined}
              aria-describedby={`${uid}-hours-${hoursError ? 'error' : 'hint'}`}
            />
            {hoursError ? (
              <p id={`${uid}-hours-error`} className="field-error">
                {hoursError}
              </p>
            ) : (
              <p id={`${uid}-hours-hint`} className="field-hint">
                Video + soru çözme dahil, 0,5 ile 16 saat arası.
              </p>
            )}
          </div>

          <div>
            <label className="field-label" htmlFor={`${uid}-start`}>
              Başlangıç tarihi
            </label>
            <input
              id={`${uid}-start`}
              type="date"
              className="input tnum"
              value={draft.startDate}
              onChange={e => set({ startDate: e.target.value })}
              aria-invalid={errors.startDate ? true : undefined}
              aria-describedby={errors.startDate ? `${uid}-start-error` : undefined}
            />
            {errors.startDate && (
              <p id={`${uid}-start-error`} className="field-error">
                {errors.startDate}
              </p>
            )}
          </div>

          <div>
            <label className="field-label" htmlFor={`${uid}-speed`}>
              İzleme hızı
            </label>
            <select id={`${uid}-speed`} className="input" value={draft.speed} onChange={e => set({ speed: Number(e.target.value) })}>
              {speedOptions.map(s => (
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
              value={draft.practice}
              onChange={e => set({ practice: Number(e.target.value) })}
              aria-describedby={`${uid}-practice-hint`}
            >
              {practiceOptions.map(p => (
                <option key={p} value={p}>
                  %{Math.round(p * 100)}
                </option>
              ))}
            </select>
            <p id={`${uid}-practice-hint`} className="field-hint">
              Her videonun süresine not alma ve soru çözme için eklenir.
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor={`${uid}-subjects`}>
              Günde en fazla ders
            </label>
            <select
              id={`${uid}-subjects`}
              className="input"
              value={draft.maxSubjects}
              onChange={e => set({ maxSubjects: Number(e.target.value) })}
            >
              {subjectOptions.map(n => (
                <option key={n} value={n}>
                  {n} ders
                </option>
              ))}
            </select>
          </div>

          <div className="self-end rounded-[10px] bg-sunk px-3.5 py-3 text-[13px] text-ink-2">
            {exampleMinutes !== null ? (
              <>
                Bu ayarlarla 1 saatlik bir video yaklaşık <span className="font-semibold text-ink">{formatMinutes(exampleMinutes)}</span>{' '}
                çalışma sayılır.
              </>
            ) : (
              'Hataları düzeltince örnek hesap burada görünür.'
            )}
          </div>

          <fieldset className="sm:col-span-2" aria-describedby={errors.days ? `${uid}-days-error` : undefined}>
            <legend className="field-label">Haftalık düzen</legend>
            <ul className="divide-y divide-line rounded-[12px] border border-line">
              {WEEK_ORDER.map(dow => (
                <li key={dow} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2">
                  <span id={`${uid}-day-${dow}`} className="text-[14px] font-medium text-ink">
                    {LONG_WEEKDAYS[dow]}
                  </span>
                  <div className="segmented" role="group" aria-labelledby={`${uid}-day-${dow}`}>
                    {(['study', 'mock', 'rest'] as const).map(kind => (
                      <button
                        key={kind}
                        type="button"
                        aria-pressed={draft.days[dow] === kind}
                        onClick={() => setDraft(d => ({ ...d, days: d.days.map((k, i) => (i === dow ? kind : k)) }))}
                      >
                        {DAY_KIND_LABEL[kind]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {errors.days && (
              <p id={`${uid}-days-error`} className="field-error" role="alert">
                {errors.days}
              </p>
            )}
          </fieldset>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">
          {dirty && prefs && <p className="mr-auto text-[12.5px] text-ink-3">Kaydedilmemiş değişiklikler var.</p>}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!dirty}
            onClick={() => {
              setDraft(toDraft(preferences));
              setSubmitted(false);
            }}
          >
            Geri al
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty}>
            Kaydet
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby={`${uid}-data`}>
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <h2 id={`${uid}-data`} className="text-[16px] font-semibold text-ink">
            Verilerin
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Her şey yalnızca bu tarayıcıda saklanır; sunucuya gönderilmez. Tarayıcı verisini temizlemeden önce yedek al.
          </p>
        </div>
        <ul className="divide-y divide-line">
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">Yedek indir</p>
              <p className="text-[13px] text-ink-2">Kamplar, tamamlananlar, ileri taşımalar, notlar ve ayarlar tek bir JSON dosyasında.</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={onBackup} disabled={isDemo}>
              <Download aria-hidden="true" />
              İndir
            </button>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">Yedekten geri yükle</p>
              <p className="text-[13px] text-ink-2">Dosya kontrol edilir ve onayından sonra mevcut verilerin yerine geçer.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onRestoreFile(file);
              }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={isDemo}>
              <Upload aria-hidden="true" />
              Dosya seç
            </button>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">Demo önizleme</p>
              <p className="text-[13px] text-ink-2">
                {isDemo
                  ? 'Şu an örnek bir plana bakıyorsun. Çıkınca kendi verilerine dönersin.'
                  : 'Örnek bir planla uygulamayı dene. Verilerine dokunmaz, hiçbir şey kaydedilmez.'}
              </p>
            </div>
            {isDemo ? (
              <button type="button" className="btn btn-secondary" onClick={onExitDemo}>
                <LogOut aria-hidden="true" />
                Demodan çık
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={onStartDemo}>
                <Eye aria-hidden="true" />
                Demoyu aç
              </button>
            )}
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-danger">Tüm verileri sıfırla</p>
              <p className="text-[13px] text-ink-2">
                {campCount > 0 ? `${campCount} kamp, ilerlemen, notların ve ayarların silinir.` : 'Ayarlar varsayılana döner.'} Geri
                alınamaz.
              </p>
            </div>
            <button type="button" className="btn btn-danger-quiet" onClick={onReset} disabled={isDemo}>
              <RotateCcw aria-hidden="true" />
              Sıfırla
            </button>
          </li>
        </ul>
        {isDemo && (
          <p className="border-t border-line px-5 py-3 text-[12.5px] text-ink-3 sm:px-6">
            Demo açıkken yedekleme, geri yükleme ve sıfırlama kapalı.
          </p>
        )}
      </section>

      <section className="rounded-[14px] border border-dashed border-line-strong px-5 py-4 text-[13px] text-ink-2 sm:px-6">
        <h2 className="font-semibold text-ink">Nasıl çalışır?</h2>
        <p className="mt-1">
          Bir oynatma listesi bağlantısı yapıştırdığında videoların adları ve süreleri sunucu üzerinden YouTube Data API ile
          okunur; istersen videoları elle de girebilirsin. Hiçbir video, bağlantı ya da süre uydurulmaz. Plan; günlük süreni, izleme hızını ve tekrar payını hesaba katarak videoları sırayla günlere böler. Bir görevi
          işaretlemek planı kaydırmaz; geride kalanları yalnızca sen “ileri taşı” dediğinde yeniden dağıtır.
        </p>
      </section>
    </div>
  );
}
