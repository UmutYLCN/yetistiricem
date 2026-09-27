import { Check, Undo2 } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import { formatMinutes } from '../../lib/format';

/** The same completion screen in the player and the landing's inert preview. */
export function FocusCompletion({
  completed,
  next,
  onUndo,
}: {
  completed: boolean;
  next: Pick<DailyPlanItem, 'title' | 'durationMinutes'> | null;
  onUndo: () => void;
}) {
  return (
    <>
      <span className="focus-done-mark" aria-hidden="true">
        <Check strokeWidth={3} />
      </span>
      <p className="font-display mt-4 text-[26px] text-ink max-sm:mt-2 max-sm:text-[20px]">Harika iş!</p>
      <p className="mt-1 text-[14px] text-ink-2">
        {completed ? '“İzledim” olarak işaretlendi.' : 'İşaret geri alındı.'}{' '}
        {completed && (
          <button type="button" className="inline-flex items-center gap-1 font-semibold text-ink-2 underline" onClick={onUndo}>
            <Undo2 className="size-3.5" aria-hidden="true" />
            Geri al
          </button>
        )}
      </p>
      {next ? (
        <p className="mt-4 max-w-[28rem] text-[13.5px] text-ink-3 max-sm:hidden">
          Sıradaki: <span className="font-semibold text-ink-2">{next.title}</span>
          <span className="tnum"> · {formatMinutes(next.durationMinutes)}</span>
        </p>
      ) : (
        <p className="mt-4 text-[13.5px] text-ink-3 max-sm:mt-2">Bugünün odakta izlenecek görevleri bitti.</p>
      )}
    </>
  );
}
