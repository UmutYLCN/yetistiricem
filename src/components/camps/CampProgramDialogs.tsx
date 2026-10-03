import { useId, useMemo, useState } from 'react';
import { CalendarClock, CircleCheck, TriangleAlert } from 'lucide-react';
import type { CampSchedule, StudyCamp } from '../../types';
import type { RhythmDraft } from '../../lib/campDraft';
import { detailErrors, hasRhythmErrors, rhythmDraftOf, rhythmErrors, sameSchedule, scheduleOf } from '../../lib/campDraft';
import { focusFirstInvalid } from '../../lib/dom';
import { assessDeadline, buildCampSchedule, planEndDate } from '../../lib/engine';
import { formatLongDate } from '../../lib/format';
import { withTempo } from '../../lib/plannerOps';
import { MAX_CAMP_NAME } from '../../lib/studyCamp';
import { RhythmEditor } from '../rhythm/RhythmEditor';
import { Dialog } from '../ui/Dialog';
import { CampDatesFields } from '../wizard/CampDetails';
import { msg } from '../../lib/messages';
import { useConfirm } from '../ui/ConfirmDialog';


/**
 * Edits one camp's tempo: dates, how the week is formed and its values.
 * Other camps keep their own tempo. Completion and shifts are kept; once the
 * camp has started the new tempo applies from today (`withTempo`).
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
  const started = camp.schedule.startDate < today;
  const [rhythm, setRhythm] = useState<RhythmDraft>(() => rhythmDraftOf(camp.schedule, branchIds));
  const [startDate, setStartDate] = useState(camp.schedule.startDate);
  const [targetEndDate, setTargetEndDate] = useState(camp.schedule.targetEndDate ?? '');
  const [tried, setTried] = useState(false);
  const confirm = useConfirm();

  const dates = detailErrors({ name: camp.name, startDate, targetEndDate });
  const rhythmProblems = rhythmErrors(rhythm, camp.branches);
  const valid = Object.keys(dates).length === 0 && !hasRhythmErrors(rhythmProblems);
  const schedule = useMemo(() => (valid ? scheduleOf({ startDate, targetEndDate, rhythm }) : null), [valid, startDate, targetEndDate, rhythm]);
  // Nothing to save until the plan would actually change.
  const unchanged = schedule !== null && sameSchedule(schedule, camp.schedule, branchIds);
  const effect = useMemo(() => {
    if (!schedule) return null;
    const result = buildCampSchedule(withTempo(camp, schedule, today), { today });
    const finish = planEndDate(result.plans);
    return { finish, deadline: assessDeadline({ finishDate: finish, targetEndDate: schedule.targetEndDate, unscheduledCount: result.unscheduledItems.length }) };
  }, [schedule, camp, today]);

  // A moved start date re-lays the plan from scratch and drops the camp's stored shifts and earlier tempos.
  const resetsShifts = schedule !== null && schedule.startDate !== camp.schedule.startDate && (camp.shiftEvents.length > 0 || (camp.tempoHistory?.length ?? 0) > 0);

  const save = async () => {
    setTried(true);
    if (!schedule) {
      focusFirstInvalid(document.querySelector('dialog[open]'));
      return;
    }
    if (resetsShifts) {
      const ok = await confirm({
        title: msg('Plan baştan dizilsin mi?'),
        tone: 'danger',
        confirmLabel: msg('Baştan diz'),
        body: <p>{msg('Başlangıç tarihi değişince plan yeni tarihten, yalnızca şimdi seçtiğin tempoyla sıfırdan dizilir; bu kampta yaptığın erteleme, kaydırma ve önceki tempo değişiklikleri silinir. Tamamlama işaretlerin korunur.')}</p>,
      });
      if (!ok) return;
    }
    if (!unchanged) onSave(schedule);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={msg("Tempoyu düzenle")}
      description={
        <>
          {msg("\n          Bu değişiklik yalnızca ")}<span className="font-semibold text-ink">{msg("“")}{camp.name}{msg("”")}</span> {msg(" için geçerli. Tamamlanan görevlerin ve\n          ileri taşımaların korunur; başlangıç tarihini değiştirirsen ertelemeler sıfırlanır.\n        ")}
          {started && startDate === camp.schedule.startDate && <> {msg("Kamp başladığı için yeni tempo bugünden itibaren geçerli; geçmiş günler olduğu gibi kalır.")}</>}
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
                      : msg("Planlanacak video yok")}
              </span>
            </p>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {msg("\n            Vazgeç\n          ")}</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={unchanged} title={unchanged ? msg("Değişiklik yok") : undefined}>
            {msg("\n            Kaydet\n          ")}</button>
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
        {resetsShifts && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-line bg-sunk px-3 py-2 text-[13px] text-ink-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
            {msg('Başlangıç tarihini değiştirirsen plan yeni tarihten, yalnızca şimdi seçtiğin tempoyla sıfırdan dizilir ve bu kampta yaptığın erteleme, kaydırma ve önceki tempo değişiklikleri silinir. Tamamlama işaretlerin korunur.')}
          </p>
        )}
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
      title={msg("Kampı yeniden adlandır")}
      width={460}
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {msg("\n            Vazgeç\n          ")}</button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {msg("\n            Kaydet\n          ")}</button>
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
          {msg("\n          Kamp adı\n        ")}</label>
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
