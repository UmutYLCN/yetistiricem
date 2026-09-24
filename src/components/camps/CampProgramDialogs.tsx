import { useId, useMemo, useState } from 'react';
import { CalendarClock, CircleCheck, TriangleAlert } from 'lucide-react';
import type { CampSchedule, StudyCamp } from '../../types';
import type { RhythmDraft } from '../../lib/campDraft';
import { detailErrors, hasRhythmErrors, rhythmDraftOf, rhythmErrors, sameSchedule, scheduleOf } from '../../lib/campDraft';
import { focusFirstInvalid } from '../../lib/dom';
import { assessDeadline, buildCampSchedule, planEndDate } from '../../lib/engine';
import { formatLongDate } from '../../lib/format';
import { MAX_CAMP_NAME } from '../../lib/studyCamp';
import { RhythmEditor } from '../rhythm/RhythmEditor';
import { Dialog } from '../ui/Dialog';
import { CampDatesFields } from '../wizard/CampDetails';

/**
 * Edits one camp's tempo: dates, how the week is formed and its values.
 * Other camps keep their own tempo. Completion and shifts are kept.
 */
export function CampTempoDialog({
  camp,
  today,
  onSave,
  onClose,
}: {
  camp: StudyCamp;
  today: string;
  onSave: (schedule: CampSchedule) => void;
  onClose: () => void;
}) {
  const branchIds = camp.branches.map(b => b.id);
  const [rhythm, setRhythm] = useState<RhythmDraft>(() => rhythmDraftOf(camp.schedule, branchIds));
  const [startDate, setStartDate] = useState(camp.schedule.startDate);
  const [targetEndDate, setTargetEndDate] = useState(camp.schedule.targetEndDate ?? '');
  const [tried, setTried] = useState(false);

  const dates = detailErrors({ name: camp.name, startDate, targetEndDate });
  const rhythmProblems = rhythmErrors(rhythm, camp.branches);
  const valid = Object.keys(dates).length === 0 && !hasRhythmErrors(rhythmProblems);
  const schedule = useMemo(() => (valid ? scheduleOf({ startDate, targetEndDate, rhythm }) : null), [valid, startDate, targetEndDate, rhythm]);
  // Nothing to save until the plan would actually change.
  const unchanged = schedule !== null && sameSchedule(schedule, camp.schedule, branchIds);
  const effect = useMemo(() => {
    if (!schedule) return null;
    const result = buildCampSchedule({ ...camp, schedule }, { today });
    const finish = planEndDate(result.plans);
    return { finish, deadline: assessDeadline({ finishDate: finish, targetEndDate: schedule.targetEndDate, unscheduledCount: result.unscheduledItems.length }) };
  }, [schedule, camp, today]);

  const save = () => {
    setTried(true);
    if (!schedule) {
      focusFirstInvalid(document.querySelector('dialog[open]'));
      return;
    }
    if (!unchanged) onSave(schedule);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Tempoyu düzenle"
      description={
        <>
          Bu değişiklik yalnızca <span className="font-semibold text-ink">“{camp.name}”</span> için geçerli. Tamamlanan görevlerin ve
          ileri taşımaların korunur.
        </>
      }
      width={760}
      dismissOnBackdrop={false}
      footer={
        <>
          {effect && (
            <p className="mr-auto flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-2">
              {effect.deadline.kind === 'late' || effect.deadline.kind === 'incomplete' ? (
                <TriangleAlert className="size-4 shrink-0 text-accent-strong" aria-hidden="true" />
              ) : effect.deadline.kind === 'on-track' ? (
                <CircleCheck className="size-4 shrink-0 text-forest" aria-hidden="true" />
              ) : (
                <CalendarClock className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
              )}
              <span className="truncate">
                {effect.deadline.kind === 'late'
                  ? `Hedefin ${effect.deadline.lateDays} gün gerisinde`
                  : effect.deadline.kind === 'incomplete'
                    ? `${effect.deadline.unscheduledCount} video plana giremiyor`
                    : effect.finish
                      ? `Bitiş: ${formatLongDate(effect.finish)}`
                      : 'Planlanacak video yok'}
              </span>
            </p>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={unchanged} title={unchanged ? 'Değişiklik yok' : undefined}>
            Kaydet
          </button>
        </>
      }
    >
      <div className="space-y-6 pt-2">
        <CampDatesFields
          startDate={startDate}
          targetEndDate={targetEndDate}
          today={today}
          errors={dates}
          onChange={patch => {
            if (patch.startDate !== undefined) setStartDate(patch.startDate);
            if (patch.targetEndDate !== undefined) setTargetEndDate(patch.targetEndDate);
          }}
        />
        <RhythmEditor value={rhythm} onChange={setRhythm} branches={camp.branches} errors={rhythmProblems} showErrors={tried} />
      </div>
    </Dialog>
  );
}

export function RenameCampDialog({ camp, onSave, onClose }: { camp: StudyCamp; onSave: (name: string) => void; onClose: () => void }) {
  const uid = useId();
  const [name, setName] = useState(camp.name);
  const [tried, setTried] = useState(false);
  const error = !name.trim() ? 'Kampına bir ad ver.' : undefined;

  const save = () => {
    setTried(true);
    if (error) return;
    onSave(name.trim().slice(0, MAX_CAMP_NAME));
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Kampı yeniden adlandır"
      width={460}
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Kaydet
          </button>
        </>
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          save();
        }}
      >
        <label className="field-label" htmlFor={`${uid}-name`}>
          Kamp adı
        </label>
        <input
          id={`${uid}-name`}
          className="input"
          maxLength={MAX_CAMP_NAME}
          value={name}
          onChange={e => setName(e.target.value)}
          aria-invalid={tried && error ? true : undefined}
          aria-describedby={tried && error ? `${uid}-error` : undefined}
          data-autofocus
        />
        {tried && error && (
          <p id={`${uid}-error`} className="field-error">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
