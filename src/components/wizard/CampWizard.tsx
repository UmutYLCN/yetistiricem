import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus } from 'lucide-react';
import type { StudyCamp, SubjectPlaylist, UserPreferences } from '../../types';
import type { CampDraft, RhythmDraft, StudyHabits } from '../../lib/campDraft';
import {
  campFromDraft,
  detailErrors,
  hasRhythmErrors,
  hasSourceErrors,
  initialDraft,
  rhythmErrors,
  scheduleOf,
  sourceErrors,
  syncManual,
} from '../../lib/campDraft';
import { totalMinutesOf } from '../../lib/camps';
import { focusFirstInvalid } from '../../lib/dom';
import { formatMinutes } from '../../lib/format';
import { RhythmEditor } from '../rhythm/RhythmEditor';
import { Dialog } from '../ui/Dialog';
import { BranchSources } from './BranchSources';
import { CampDatesFields, CampNameField, WorkloadNote } from './CampDetails';
import { PlanPreview } from './PlanPreview';

interface Props {
  open: boolean;
  onClose: () => void;
  today: string;
  /** Preferences of an older version to start the rhythm from. */
  seed: UserPreferences | null;
  /** Speed and practice share to borrow from the open camp (never its tempo). */
  habits: StudyHabits | null;
  onCreate: (camp: StudyCamp) => void;
}

const STEPS = [
  { title: 'Kaynaklar', heading: 'Videolarını ve listelerini ekle', intro: 'Her YouTube oynatma listesi ayrı bir branş olur. Adlarını sonra da değiştirebilirsin.' },
  { title: 'Kamp', heading: 'Kampına bir ad ve tarih ver', intro: 'Kamp, bütün branşlarını kapsayan çalışma programın.' },
  { title: 'Ritim', heading: 'Haftanı nasıl kuralım?', intro: 'Önce yöntemi seç; sonra yalnızca ona ait ayarlar açılır.' },
  { title: 'Önizleme', heading: 'Planına göz at', intro: 'Hiçbir şey kaydedilmedi. Beğenmediğin bir şey olursa geri dönüp değiştir.' },
] as const;

type Step = 0 | 1 | 2 | 3;

/**
 * New camp in four steps: sources → name and dates → weekly rhythm →
 * preview. The draft survives closing the dialog until the camp is created.
 */
export function CampWizard({ open, onClose, today, seed, habits, onCreate }: Props) {
  const [draft, setDraft] = useState<CampDraft>(() => initialDraft(today, seed, habits));
  const [step, setStep] = useState<Step>(0);
  const [reached, setReached] = useState<Step>(0);
  const [tried, setTried] = useState<Set<Step>>(() => new Set());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const errors = useMemo(
    () => ({
      sources: sourceErrors(draft.branches),
      details: detailErrors(draft),
      rhythm: rhythmErrors(draft.rhythm, draft.branches),
    }),
    [draft]
  );
  const stepValid = (s: Step) =>
    s === 0 ? !hasSourceErrors(errors.sources) : s === 1 ? Object.keys(errors.details).length === 0 : s === 2 ? !hasRhythmErrors(errors.rhythm) : true;

  // Move focus to the new step's heading (and the body back to its top).
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  const goTo = (target: Step) => {
    moved.current = true;
    setStep(target);
    setReached(r => (target > r ? target : r));
  };

  const next = () => {
    if (!stepValid(step)) {
      setTried(t => new Set(t).add(step));
      focusFirstInvalid(document.querySelector('dialog[open]'));
      return;
    }
    if (step < 3) goTo((step + 1) as Step);
  };

  const setBranches = (branches: SubjectPlaylist[]) =>
    setDraft(d => ({ ...d, branches, rhythm: { ...d.rhythm, manual: syncManual(d.rhythm.manual, branches) } }));
  const setRhythm = (rhythm: RhythmDraft) => setDraft(d => ({ ...d, rhythm }));

  const applyHours = (hours: number) =>
    setDraft(d => ({
      ...d,
      rhythm:
        d.rhythm.mode === 'manual'
          ? { ...d.rhythm, manual: { ...d.rhythm.manual, hours } }
          : { ...d.rhythm, auto: { ...d.rhythm.auto, hours } },
    }));

  const previewCamp = useMemo(
    () => (step === 3 ? { branches: draft.branches, schedule: scheduleOf(draft), shiftEvents: [] } : null),
    [step, draft]
  );

  const create = () => {
    for (const s of [0, 1, 2] as Step[]) {
      if (!stepValid(s)) {
        setTried(t => new Set(t).add(s));
        goTo(s);
        return;
      }
    }
    onCreate(campFromDraft(draft, today));
    setDraft(initialDraft(today, null, { playbackSpeed: draft.rhythm.playbackSpeed, practiceMultiplier: draft.rhythm.practiceMultiplier }));
    setStep(0);
    setReached(0);
    setTried(new Set());
    onClose();
  };

  const videos = draft.branches.reduce((acc, b) => acc + b.videos.length, 0);
  const minutes = draft.branches.reduce((acc, b) => acc + totalMinutesOf(b.videos), 0);
  const info = STEPS[step];
  const showErrors = tried.has(step);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Yeni kamp"
      width={880}
      tall
      dismissOnBackdrop={false}
      subheader={<Stepper step={step} reached={reached} canVisit={s => s <= reached && ([0, 1, 2] as Step[]).every(p => p >= s || stepValid(p))} onVisit={goTo} />}
      footer={
        <>
          <p className="tnum mr-auto min-w-0 truncate text-[12.5px] text-ink-3 max-sm:hidden">
            {draft.branches.length > 0 ? `${draft.branches.length} branş · ${videos} video · ${formatMinutes(minutes)}` : 'Taslak kapatınca da korunur.'}
          </p>
          {step > 0 ? (
            <button type="button" className="btn btn-secondary max-sm:flex-1" onClick={() => goTo((step - 1) as Step)}>
              <ArrowLeft aria-hidden="true" />
              Geri
            </button>
          ) : (
            <button type="button" className="btn btn-secondary max-sm:flex-1" onClick={onClose}>
              Vazgeç
            </button>
          )}
          {step < 3 ? (
            <button type="button" className="btn btn-primary max-sm:flex-1" onClick={next}>
              {step === 2 ? 'Önizle' : 'Devam'}
              <ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="btn btn-primary max-sm:flex-1" onClick={create}>
              <Plus aria-hidden="true" />
              Kampı oluştur
            </button>
          )}
        </>
      }
    >
      <div className="pt-4">
        <h3 ref={headingRef} tabIndex={-1} className="font-display scroll-mt-4 text-[21px] leading-tight text-ink outline-none">
          {info.heading}
        </h3>
        <p className="mt-1 mb-5 text-[14px] text-ink-2">{info.intro}</p>

        {step === 0 && (
          <BranchSources branches={draft.branches} onChange={setBranches} errors={errors.sources} showErrors={showErrors} />
        )}

        {step === 1 && (
          <div className="space-y-5">
            <CampNameField value={draft.name} error={showErrors ? errors.details.name : undefined} onChange={name => setDraft(d => ({ ...d, name }))} />
            <CampDatesFields
              startDate={draft.startDate}
              targetEndDate={draft.targetEndDate}
              today={today}
              errors={showErrors || draft.targetEndDate ? errors.details : {}}
              onChange={patch => setDraft(d => ({ ...d, ...patch }))}
            />
            <WorkloadNote branches={draft.branches.length} videos={videos} minutes={formatMinutes(minutes)} />
          </div>
        )}

        {step === 2 && (
          <RhythmEditor value={draft.rhythm} onChange={setRhythm} branches={draft.branches} errors={errors.rhythm} showErrors={showErrors} />
        )}

        {step === 3 && previewCamp && (
          <div className="space-y-4">
            <p className="text-[14px] text-ink-2">
              <span className="font-semibold text-ink">{draft.name.trim()}</span> ·{' '}
              {draft.rhythm.mode === 'manual' ? 'Branşlar günlere senin seçiminle yerleşti' : 'Otomatik dağıtım'}
            </p>
            <PlanPreview camp={previewCamp} today={today} onUseHours={applyHours} onEditRhythm={() => goTo(2)} />
          </div>
        )}
      </div>
    </Dialog>
  );
}

function Stepper({
  step,
  reached,
  canVisit,
  onVisit,
}: {
  step: Step;
  reached: Step;
  canVisit: (s: Step) => boolean;
  onVisit: (s: Step) => void;
}) {
  return (
    <nav aria-label="Kamp oluşturma adımları">
      <p className="mb-2 text-[12.5px] font-semibold text-ink-3 sm:hidden">
        Adım {step + 1} / {STEPS.length} · <span className="text-ink">{STEPS[step].title}</span>
      </p>
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {STEPS.map((s, i) => {
          const index = i as Step;
          const done = index !== step && index < Math.max(step, reached);
          const current = index === step;
          const enabled = !current && canVisit(index);
          return (
            <li key={s.title} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                className={`wizard-step ${current ? 'is-current' : done ? 'is-done' : ''}`}
                onClick={() => onVisit(index)}
                disabled={!enabled}
                aria-current={current ? 'step' : undefined}
              >
                <span className="wizard-step-dot tnum" aria-hidden="true">
                  {done ? <Check strokeWidth={3} /> : i + 1}
                </span>
                <span className="truncate max-sm:sr-only">{s.title}</span>
                {done && <span className="sr-only">(tamamlandı)</span>}
              </button>
              {i < STEPS.length - 1 && <span className={`h-0.5 min-w-3 flex-1 rounded-full ${index < step ? 'bg-forest' : 'bg-line'}`} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
