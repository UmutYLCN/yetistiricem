import { useId, useState } from 'react';
import { CalendarClock, Gauge, TriangleAlert } from 'lucide-react';
import type { DeadlineOverrun } from '../../lib/deadlineOverrun';
import { diffDays } from '../../lib/engine';
import { formatHourCount, formatLongDate, formatMinutes } from '../../lib/format';
import { msg, translateTemplate } from '../../lib/messages';
import { Dialog } from '../ui/Dialog';

/**
 * After a postponement pushes a camp past its target date: the gap, and three
 * ways on. Raising the daily time applies from today (like "Tempoyu düzenle"),
 * moving the target only changes the date, keeping it changes nothing.
 */
export function DeadlineOverrunDialog({
  campName,
  startDate,
  overrun,
  onRaiseHours,
  onMoveTarget,
  onKeep,
}: {
  campName: string;
  /** The camp's start: a target cannot be earlier. */
  startDate: string;
  overrun: DeadlineOverrun;
  onRaiseHours: (hours: number) => void;
  onMoveTarget: (targetEndDate: string) => void;
  /** "Böyle kalsın", Escape or the close button: nothing changes. */
  onKeep: () => void;
}) {
  const uid = useId();
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState(overrun.finishDate);
  const { suggestion, targetEndDate, finishDate } = overrun;
  const dateError = !date ? msg('Bir tarih seç.') : date < startDate ? msg('Hedef tarih başlangıçtan önce olamaz.') : null;

  const description = translateTemplate('“{camp}” için hedefin {target}. Bu ertelemeyle plan {finish} tarihinde bitiyor, {days} gün geç.', {
    camp: campName,
    target: formatLongDate(targetEndDate),
    finish: formatLongDate(finishDate),
    days: diffDays(targetEndDate, finishDate),
  });

  if (picking) {
    return (
      <Dialog
        open
        onClose={onKeep}
        eyebrow={msg('Hedef tarih')}
        title={msg('Hedef tarihi ertele')}
        description={description}
        width={480}
        dismissOnBackdrop={false}
        footer={
          <>
            <button type="button" className="btn btn-ghost mr-auto" onClick={() => setPicking(false)}>
              {msg('Geri')}
            </button>
            <button type="button" className="btn btn-primary" disabled={dateError !== null} onClick={() => onMoveTarget(date)}>
              <CalendarClock aria-hidden="true" />
              {msg('Hedefi kaydet')}
            </button>
          </>
        }
      >
        <label className="field-label" htmlFor={`${uid}-target`}>
          {msg('Yeni hedef tarih')}
        </label>
        <input
          id={`${uid}-target`}
          type="date"
          required
          data-autofocus
          className="input tnum"
          min={startDate}
          value={date}
          onChange={event => setDate(event.target.value)}
          aria-invalid={dateError ? true : undefined}
          aria-describedby={`${uid}-target-hint`}
        />
        <p id={`${uid}-target-hint`} className={dateError ? 'field-error' : 'field-hint'}>
          {dateError ?? translateTemplate('Bu ritimle plan {finish} tarihinde bitiyor.', { finish: formatLongDate(finishDate) })}
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onKeep}
      eyebrow={msg('Hedef tarih')}
      title={msg('Plan hedef tarihini aşıyor')}
      description={description}
      width={540}
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn-ghost mr-auto" onClick={onKeep}>
            {msg('Böyle kalsın')}
          </button>
          <button type="button" className={`btn ${suggestion ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setPicking(true)}>
            <CalendarClock aria-hidden="true" />
            {msg('Hedef tarihi ertele')}
          </button>
          {suggestion && (
            <button type="button" className="btn btn-primary" data-autofocus onClick={() => onRaiseHours(suggestion.hours)}>
              <Gauge aria-hidden="true" />
              {translateTemplate('Günlük süreyi {hours} saate çıkar', { hours: formatHourCount(suggestion.hours) })}
            </button>
          )}
        </>
      }
    >
      <div className="grid gap-3">
        {suggestion ? (
          <p className="text-[14.5px] leading-relaxed text-ink-2">
            {translateTemplate('Günde {hours} çalışırsan plan {finish} tarihinde biter ve hedefe yetişirsin. Yeni süre bugünden başlar; geçmiş günler olduğu gibi kalır.', {
              hours: formatMinutes(suggestion.hours * 60),
              finish: formatLongDate(suggestion.finishDate),
            })}
          </p>
        ) : (
          <div className="callout callout-warn" role="status">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-[13.5px] text-ink-2">
              {overrun.targetPassed
                ? msg('Hedef tarih geçti; günlük süreyi artırmak artık yetiştirmez. Yeni bir hedef tarih seçebilirsin.')
                : translateTemplate('Günlük üst sınırın olan {limit} bile hedefe yetiştirmiyor. Hedef tarihi erteleyebilir ya da üst sınırı Tercihler’den değiştirebilirsin.', {
                    limit: formatMinutes(overrun.limit * 60),
                  })}
            </p>
          </div>
        )}
        {suggestion?.intense && (
          <div className="callout callout-warn" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-[13.5px] text-ink-2">
              <span className="font-semibold text-ink">{msg('Bu çok yoğun olabilir.')}</span>{' '}
              {suggestion.hours > overrun.limit
                ? translateTemplate('Önerilen süre, günlük üst sınırın olan {limit} saatin üstünde.', { limit: formatHourCount(overrun.limit) })
                : translateTemplate('Önerilen süre, şu anki günlük sürenin ({current}) 1,5 katından fazla. Sürdürebileceğin bir tempo değilse hedef tarihi ertelemek de olur.', {
                    current: formatMinutes(overrun.currentHours * 60),
                  })}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
