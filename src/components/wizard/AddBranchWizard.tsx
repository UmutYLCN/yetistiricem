import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Forward, Gauge, Plus } from 'lucide-react';
import type { StudyCamp, SubjectPlaylist } from '../../types';
import { hasSourceErrors, sourceErrors } from '../../lib/campDraft';
import { totalMinutesOf, youtubeIdsOf } from '../../lib/camps';
import { focusFirstInvalid } from '../../lib/dom';
import { addDays, assessDeadline, buildCampSchedule, dailyHoursForDeadline, dayOfWeek, diffDays, planEndDate } from '../../lib/engine';
import { LONG_WEEKDAYS, SHORT_WEEKDAYS, WEEK_ORDER, formatHours, formatLongDate, formatMinutes, formatShortDate, relativeDayLabel } from '../../lib/format';
import { withAddedBranches } from '../../lib/plannerOps';
import { tempoSummary, weekdaysLabel } from '../../lib/planView';
import { resolveColor } from '../../lib/subjects';
import { WeekdayToggles } from '../rhythm/RhythmEditor';
import { Dialog } from '../ui/Dialog';
import { BranchSources } from './BranchSources';
import { DeadlineSignal, PreviewWeeks } from './PlanPreview';
import { WizardStepper } from './WizardStepper';

type StepId = 'sources' | 'days' | 'preview';

const STEP_INFO: Record<StepId, { title: string; heading: string; intro: string }> = {
  sources: {
    title: 'Kaynaklar',
    heading: 'Eklenecek listeleri seç',
    intro: 'Her YouTube oynatma listesi bu kampta ayrı bir branş olur. Adlarını sonra da değiştirebilirsin.',
  },
  days: {
    title: 'Günler',
    heading: 'Yeni branşlar hangi günlerde çalışılsın?',
    intro: 'Bu kampın haftasını sen kuruyorsun. Seçtiğin günlere yeni branşların hepsi eklenir.',
  },
  preview: {
    title: 'Önizleme',
    heading: 'Planın nasıl değişecek?',
    intro: 'Henüz hiçbir şey kaydedilmedi. Kampın adı, tarihleri ve temposu aynı kalır; plan bu tempoya göre yeniden dağıtılır.',
  },
};

interface Props {
  /** The existing camp the branches join, fixed when the wizard opens. */
  camp: StudyCamp;
  today: string;
  completedMap: Record<string, boolean>;
  onAdd: (branches: SubjectPlaylist[], weekdays: number[] | undefined) => void;
  onClose: () => void;
}

/**
 * Adds branches to an existing camp: sources → (manual camps) weekdays →
 * preview of the camp's plan with them. It never asks for a name, dates or a
 * rhythm: the camp keeps its own tempo.
 */
export function AddBranchWizard({ camp, today, completedMap, onAdd, onClose }: Props) {
  const uid = useId();
  const manual = camp.schedule.mode === 'manual';
  const steps: StepId[] = manual ? ['sources', 'days', 'preview'] : ['sources', 'preview'];
  const [branches, setBranches] = useState<SubjectPlaylist[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [tried, setTried] = useState<Set<StepId>>(() => new Set());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const current = steps[step];
  const errors = sourceErrors(branches);
  const weekdayError = manual && weekdays.length === 0 ? 'Yeni branşların hangi günlerde çalışılacağını seç.' : undefined;
  const stepValid = (id: StepId) => (id === 'sources' ? !hasSourceErrors(errors) : id === 'days' ? !weekdayError : true);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    headingRef.current?.focus({ preventScroll: true });
    // Scroll only the dialog body: scrollIntoView would also shift the (overflow: hidden) dialog on phones.
    headingRef.current?.closest('.dialog-body')?.scrollTo({ top: 0 });
  }, [step]);

  const goTo = (target: number) => {
    moved.current = true;
    setStep(target);
    setReached(r => Math.max(r, target));
  };

  const next = () => {
    if (!stepValid(current)) {
      setTried(t => new Set(t).add(current));
      focusFirstInvalid(document.querySelector('dialog[open]'));
      return;
    }
    if (step < steps.length - 1) goTo(step + 1);
  };

  const add = () => {
    const invalid = steps.findIndex(id => !stepValid(id));
    if (invalid >= 0) {
      setTried(t => new Set(t).add(steps[invalid]));
      goTo(invalid);
      return;
    }
    onAdd(branches, manual ? weekdays : undefined);
    onClose();
  };

  const videos = branches.reduce((acc, b) => acc + b.videos.length, 0);
  const minutes = branches.reduce((acc, b) => acc + totalMinutesOf(b.videos), 0);
  const info = STEP_INFO[current];
  const isLast = step === steps.length - 1;
  const { startDate, targetEndDate } = camp.schedule;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Branş ekle"
      description={
        <>
          <p>
            Yeni branşlar <span className="font-semibold text-ink">“{camp.name}”</span> kampına eklenir; yeni kamp oluşturulmaz.
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-ink-3">
            <Gauge className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {tempoSummary(camp.schedule)} · başlangıç {formatShortDate(startDate)}
              {targetEndDate && ` · hedef ${formatShortDate(targetEndDate)}`}
            </span>
          </p>
        </>
      }
      width={880}
      tall
      dismissOnBackdrop={false}
      subheader={
        <WizardStepper
          label="Branş ekleme adımları"
          titles={steps.map(id => STEP_INFO[id].title)}
          step={step}
          reached={reached}
          canVisit={s => s <= reached && steps.slice(0, s).every(stepValid)}
          onVisit={goTo}
        />
      }
      footer={
        <>
          <p className="tnum mr-auto min-w-0 truncate text-[12.5px] text-ink-3 max-sm:hidden">
            {branches.length > 0 ? `${branches.length} yeni branş · ${videos} video · ${formatMinutes(minutes)}` : `“${camp.name}” kampına`}
          </p>
          {step > 0 ? (
            <button type="button" className="btn btn-secondary max-sm:flex-1" onClick={() => goTo(step - 1)}>
              <ArrowLeft aria-hidden="true" />
              Geri
            </button>
          ) : (
            <button type="button" className="btn btn-secondary max-sm:flex-1" onClick={onClose}>
              Vazgeç
            </button>
          )}
          {isLast ? (
            <button type="button" className="btn btn-primary max-sm:flex-1" onClick={add}>
              <Plus aria-hidden="true" />
              {branches.length > 1 ? `${branches.length} branşı kampa ekle` : 'Kampa ekle'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary max-sm:flex-1" onClick={next}>
              {steps[step + 1] === 'preview' ? 'Önizle' : 'Devam'}
              <ArrowRight aria-hidden="true" />
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

        {current === 'sources' && (
          <BranchSources
            branches={branches}
            onChange={setBranches}
            errors={errors}
            showErrors={tried.has('sources')}
            campYoutubeIds={camp.branches.flatMap(youtubeIdsOf)}
            usedColors={camp.branches.map(b => b.colorTag)}
            adding
          />
        )}

        {current === 'days' && (
          <fieldset className="rounded-[14px] border border-line bg-card p-4">
            <legend id={`${uid}-days`} className="px-1 text-[14px] font-semibold text-ink">
              Çalışma günleri
            </legend>
            <WeekdayToggles
              labelledBy={`${uid}-days`}
              selected={weekdays}
              disabledDays={camp.schedule.mockExamDays}
              onToggle={dow => setWeekdays(days => (days.includes(dow) ? days.filter(d => d !== dow) : [...days, dow]))}
            />
            <CurrentWeek camp={camp} />
            <DaysHint camp={camp} selected={weekdays} />
            {tried.has('days') && weekdayError && (
              <p className="field-error" role="alert">
                {weekdayError}
              </p>
            )}
          </fieldset>
        )}

        {current === 'preview' && (
          <AdditionPreview camp={camp} branches={branches} weekdays={manual ? weekdays : undefined} completedMap={completedMap} today={today} />
        )}
      </div>
    </Dialog>
  );
}

/** Mock days take no videos; choosing a rest day turns it into a study day. */
function DaysHint({ camp, selected }: { camp: StudyCamp; selected: number[] }) {
  const { mockExamDays, weekPlan } = camp.schedule;
  const restPicked = WEEK_ORDER.filter(d => selected.includes(d) && (weekPlan[d]?.length ?? 0) === 0);
  return (
    <>
      {mockExamDays.length > 0 && (
        <p className="field-hint">{WEEK_ORDER.filter(d => mockExamDays.includes(d)).map(d => LONG_WEEKDAYS[d]).join(', ')} deneme günü; oraya video konmaz.</p>
      )}
      {restPicked.length > 0 && (
        <p className="field-hint">
          {restPicked.map(d => LONG_WEEKDAYS[d]).join(', ')} şu an dinlenme günü; eklersen ders günü olur.
        </p>
      )}
    </>
  );
}

/** The camp's weekly plan as it is now: under each weekday toggle from `sm`, a list below it on phones. */
function CurrentWeek({ camp }: { camp: StudyCamp }) {
  const names = new Map(camp.branches.map(b => [b.id, b.subject]));
  const { mockExamDays, weekPlan } = camp.schedule;
  return (
    <div className="mt-3">
      <p className="text-[12px] font-semibold text-ink-3">Bu kampta şu an</p>
      <ul className="mt-1.5 grid gap-1 text-[13px] sm:grid-cols-7 sm:gap-1.5 sm:text-center sm:text-[12px]">
        {WEEK_ORDER.map(dow => {
          const ids = mockExamDays.includes(dow) ? [] : (weekPlan[dow] ?? []);
          const label = mockExamDays.includes(dow)
            ? 'Deneme'
            : ids.length > 0
              ? ids.map(id => names.get(id) ?? 'Bilinmeyen branş').join(', ')
              : 'Dinlenme';
          return (
            <li key={dow} className="flex min-w-0 gap-2 sm:block">
              <span className="w-8 shrink-0 font-semibold text-ink-3 sm:sr-only">{SHORT_WEEKDAYS[dow]}</span>
              <span className={`min-w-0 leading-snug [overflow-wrap:anywhere] ${ids.length > 0 ? 'text-ink' : 'text-ink-3'}`}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** What the addition brings and how the camp's plan changes with it. */
function AdditionPreview({
  camp,
  branches,
  weekdays,
  completedMap,
  today,
}: {
  camp: StudyCamp;
  branches: SubjectPlaylist[];
  weekdays: number[] | undefined;
  completedMap: Record<string, boolean>;
  today: string;
}) {
  const view = useMemo(() => {
    const before = buildCampSchedule(camp, { completedMap, today });
    const { camp: next, carried } = withAddedBranches(camp, branches, { weekdays, completedMap, today });
    const after = buildCampSchedule(next, { completedMap, today });
    const finishBefore = planEndDate(before.plans);
    const finishAfter = planEndDate(after.plans);
    const deadline = assessDeadline({
      finishDate: finishAfter,
      targetEndDate: next.schedule.targetEndDate,
      unscheduledCount: after.unscheduledItems.length,
    });
    return {
      next,
      after,
      carried,
      finishBefore,
      finishAfter,
      deadline,
      // Only a late plan needs the (heavier) search for a daily time that fits.
      suggestion: deadline.kind === 'late' ? dailyHoursForDeadline(next, { today }) : null,
    };
  }, [camp, branches, weekdays, completedMap, today]);

  const { next, after, carried, finishBefore, finishAfter, deadline, suggestion } = view;
  const newIds = new Set(branches.map(b => b.id));
  const newItems = after.plans.flatMap(plan => plan.items.filter(item => newIds.has(item.playlistId)).map(item => ({ item, date: plan.date })));
  const newMinutes = newItems.reduce((acc, { item }) => acc + item.effectiveMinutes, 0);
  const firstNew = newItems.find(({ date }) => date >= today)?.date ?? null;
  const branchFinish = new Map<string, string>();
  for (const { item, date } of newItems) branchFinish.set(item.playlistId, date);
  const shiftDays = finishBefore && finishAfter ? diffDays(finishBefore, finishAfter) : null;
  const branchById = new Map(next.branches.map(b => [b.id, b]));
  const colorOf = (id: string) => {
    const branch = branchById.get(id);
    return resolveColor(branch?.colorTag, branch?.subject ?? '');
  };
  const upcoming = after.plans.filter(plan => plan.date >= today);

  const stats = [
    { label: 'Yeni çalışma', value: formatHours(newMinutes), note: `${newItems.length} görev` },
    { label: 'İlk yeni görev', value: firstNew ? formatShortDate(firstNew) : '—', note: firstNew ? `${LONG_WEEKDAYS[dayOfWeek(firstNew)]} · ${relativeDayLabel(firstNew, today)}` : 'plana girmedi' },
    { label: 'Tahmini bitiş', value: finishAfter ? formatShortDate(finishAfter) : '—', note: finishBefore ? `şu an ${formatShortDate(finishBefore)}` : 'şu an plan boş' },
    {
      label: 'Bitişe etkisi',
      value: shiftDays === null ? '—' : shiftDays > 0 ? `+${shiftDays} gün` : 'Değişmiyor',
      note: shiftDays !== null && shiftDays > 0 ? 'daha geç biter' : 'aynı tempoyla',
    },
  ];

  return (
    <div className="space-y-5">
      <section aria-labelledby="addition-branches">
        <h4 id="addition-branches" className="mb-2 text-[12.5px] font-semibold tracking-wide text-ink-3 uppercase">
          Eklenecek branşlar
        </h4>
        <ul className="space-y-2">
          {branches.map(branch => {
            const color = resolveColor(branch.colorTag, branch.subject);
            const end = branchFinish.get(branch.id);
            return (
              <li key={branch.id} className="flex gap-3 rounded-[12px] border border-line bg-card px-3.5 py-2.5">
                <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: color.solid }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold break-words" style={{ color: color.solid }}>
                    {branch.subject}
                  </p>
                  <p className="tnum text-[12.5px] break-words text-ink-3">
                    {branch.title}
                    {branch.channelName && ` · ${branch.channelName}`} · {branch.videos.length} video · {formatMinutes(totalMinutesOf(branch.videos))}
                  </p>
                  <p className="tnum mt-0.5 text-[12.5px] text-ink-2">
                    {weekdays && `${weekdaysLabel(weekdays.filter(d => !camp.schedule.mockExamDays.includes(d)))} · `}
                    {end ? `bitiş ${formatShortDate(end)}` : 'plana girmedi'}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.label} className="min-w-0 rounded-[12px] border border-line bg-card px-3.5 py-3">
            <dt className="eyebrow truncate">{stat.label}</dt>
            <dd className="font-display tnum mt-1 truncate text-[22px] leading-tight text-ink">{stat.value}</dd>
            <dd className="truncate text-[12px] text-ink-3">{stat.note}</dd>
          </div>
        ))}
      </dl>

      {carried > 0 && (
        <div className="callout callout-info">
          <Forward className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
          <p className="text-[13.5px] text-ink-2">
            Kamp {formatLongDate(camp.schedule.startDate)} tarihinde başladı. Yeni branşların bugüne kadarki günlere düşecek{' '}
            <span className="font-semibold text-ink">{carried} görevi</span> geciken olarak kalmaz; sırası bozulmadan{' '}
            {formatLongDate(addDays(today, 1))} gününden itibaren planlanır.
          </p>
        </div>
      )}

      <DeadlineSignal deadline={deadline} suggestion={suggestion} />
      {deadline.kind === 'late' && (
        <p className="-mt-3 text-[12.5px] text-ink-3">Tempo burada değişmez; istersen ekledikten sonra Kamplar’daki “Tempoyu düzenle” ile ayarla.</p>
      )}

      {upcoming.length > 0 && (
        <section aria-labelledby="addition-days">
          <h4 id="addition-days" className="mb-2 text-[12.5px] font-semibold tracking-wide text-ink-3 uppercase">
            Önümüzdeki günler
          </h4>
          <PreviewWeeks plans={upcoming} capacity={after.capacityMinutes} colorOf={colorOf} today={today} isNew={item => newIds.has(item.playlistId)} />
        </section>
      )}
    </div>
  );
}
