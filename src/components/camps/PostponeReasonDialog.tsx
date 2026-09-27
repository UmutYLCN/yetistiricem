import { useEffect, useId, useRef, useState } from 'react';
import { Check, Forward, Lightbulb, Play, Undo2 } from 'lucide-react';
import type { PostponeReason } from '../../types';
import { MAX_SHIFT_NOTE_LENGTH, POSTPONE_REASONS } from '../../lib/engine';
import { formatLongDate, formatMinutes } from '../../lib/format';
import type { ShortTask } from '../../lib/postpone';
import { REASON_COPY, microTipFor } from '../../lib/postpone';
import { Dialog } from '../ui/Dialog';
import { REASON_ICONS } from './reasonIcons';

/** A shift waiting for its reason. */
export interface PostponeRequest {
  /** Tasks that will be carried forward, over every camp shown. */
  count: number;
  resumeDate: string;
  /** Camps that get their own event ("Tüm Kamplar"). */
  campCount: number;
  /** The shortest carried task, for the "one small win" tip. */
  shortest?: ShortTask;
}

export interface PostponeChoice {
  reason?: PostponeReason;
  note?: string;
}

interface Props {
  /** Null when closed. */
  request: PostponeRequest | null;
  /** Set once the shift is stored with a reason: the dialog then shows that reason's tip. */
  savedReason: PostponeReason | null;
  /** Stores the shift, with the reason or (question skipped) without. */
  onConfirm: (choice: PostponeChoice) => void;
  /** Takes the stored shift back (from the tip). */
  onUndo: () => void;
  /** Before saving: nothing is shifted. After: the tip is done. */
  onClose: () => void;
  /** Opens focus mode on the next task with a video; missing when there is none. */
  onStartFocus?: () => void;
}

/**
 * "Ritmi güncelle" (carrying the rest forward) as a short coaching moment: the student names why
 * the tasks were left (or skips the question), the shift is stored with that
 * reason, and a small, concrete next step for that reason is suggested.
 */
export function PostponeReasonDialog({ request, savedReason, onConfirm, onUndo, onClose, onStartFocus }: Props) {
  const [reason, setReason] = useState<PostponeReason | null>(null);
  const [note, setNote] = useState('');
  const doneRef = useRef<HTMLButtonElement>(null);
  const uid = useId();

  // Each request starts empty (the dialog instance stays mounted).
  const [shownRequest, setShownRequest] = useState(request);
  if (request !== shownRequest) {
    setShownRequest(request);
    setReason(null);
    setNote('');
  }

  // The confirm button leaves with the question: hand focus to the tip's button.
  useEffect(() => {
    if (savedReason) doneRef.current?.focus();
  }, [savedReason]);

  const confirm = () => {
    if (reason) onConfirm({ reason, note: note.trim() || undefined });
  };

  const when = request ? formatLongDate(request.resumeDate) : '';
  const count = request?.count ?? 0;
  const perCamp = request && request.campCount > 1 ? ` Her kamp kendi temposuyla (${request.campCount} kamp).` : '';

  if (savedReason) {
    const tip = microTipFor(savedReason);
    const Icon = REASON_ICONS[savedReason];
    return (
      <Dialog
        open={request !== null}
        onClose={onClose}
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Icon className="size-3.5" aria-hidden="true" />
            {REASON_COPY[savedReason].label}
          </span>
        }
        title="Sorun değil, ritmin güncellendi"
        description={`${count} görev ${when} gününden itibaren yeniden planlandı.${perCamp}`}
        width={520}
        footer={
          <>
            <button type="button" className="btn btn-ghost mr-auto" onClick={onUndo}>
              <Undo2 aria-hidden="true" />
              Geri al
            </button>
            <button ref={doneRef} type="button" className="btn btn-primary" onClick={onClose}>
              Tamam
            </button>
          </>
        }
      >
        <section className="postpone-tip" aria-labelledby={`${uid}-tip`}>
          <span className="postpone-tip-icon" aria-hidden="true">
            <Lightbulb />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-accent-strong">Küçük bir öneri</p>
            <h3 id={`${uid}-tip`} className="mt-1 text-[17px] font-semibold text-ink">
              {tip.title}
            </h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{tip.body}</p>
            {savedReason === 'distraction' && onStartFocus && (
              <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onStartFocus}>
                <Play aria-hidden="true" />
                Yetişir Focus’u aç
              </button>
            )}
            {savedReason === 'exhausted' && request?.shortest && (
              <p className="mt-3 rounded-[10px] bg-sunk px-3 py-2 text-[13.5px] text-ink-2">
                En kısa görevin: <span className="font-semibold break-words text-ink">{request.shortest.title}</span>
                <span className="tnum whitespace-nowrap"> · {formatMinutes(request.shortest.minutes)}</span>
              </p>
            )}
          </div>
        </section>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={request !== null}
      onClose={onClose}
      eyebrow="Ritmi güncelle"
      title="Neden yetişmedi?"
      description={`${count} görev ${when} gününden itibaren yeniden planlanacak.${perCamp} Nedenini seçmek, seni en çok neyin zorladığını görmene yardım eder.`}
      width={520}
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn-ghost mr-auto max-sm:px-2.5" onClick={() => onConfirm({})}>
            Belirtmeden güncelle
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn btn-primary" disabled={reason === null} onClick={confirm}>
            <Forward aria-hidden="true" />
            Ritmi güncelle
          </button>
        </>
      }
    >
      <fieldset>
        <legend className="visually-hidden">Erteleme nedeni</legend>
        <div className="grid gap-2">
          {POSTPONE_REASONS.map(key => {
            const Icon = REASON_ICONS[key];
            const checked = reason === key;
            return (
              <label key={key} className={`choice-card choice-card-sm ${checked ? 'is-checked' : ''}`}>
                <input
                  type="radio"
                  name={`${uid}-reason`}
                  className="visually-hidden"
                  checked={checked}
                  onChange={() => setReason(key)}
                />
                <span className="choice-card-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] leading-snug font-semibold text-ink">{REASON_COPY[key].label}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{REASON_COPY[key].hint}</span>
                </span>
                <span className="choice-card-check self-center" aria-hidden="true">
                  {checked && <Check strokeWidth={3} />}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-4">
        <label htmlFor={`${uid}-note`} className="field-label">
          Not <span className="font-normal text-ink-3">(isteğe bağlı)</span>
        </label>
        <input
          id={`${uid}-note`}
          className="input"
          value={note}
          maxLength={MAX_SHIFT_NOTE_LENGTH}
          placeholder="Örn. türevde örnek soru çözmem lazım"
          onChange={event => setNote(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') confirm();
          }}
        />
      </div>
    </Dialog>
  );
}
