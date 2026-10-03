import { useId, useState } from 'react';
import { getDailyLimit, saveDailyLimit } from '../../lib/dailyLimit';
import { msg } from '../../lib/messages';
import { HoursStepper } from '../rhythm/RhythmEditor';

/** The student's ceiling on daily study time: the deadline prompt never suggests more. */
export function DailyLimitSetting() {
  const uid = useId();
  const [hours, setHours] = useState(getDailyLimit);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-1">
      <div className="min-w-0 flex-1">
        <p id={`${uid}-label`} className="font-medium text-ink">
          {msg('Günlük üst sınır')}
        </p>
        <p className="text-[13px] text-ink-2">{msg('Hedef tarihe yetişmek için önerilen günlük süre bunu geçmez.')}</p>
      </div>
      <HoursStepper
        labelledBy={`${uid}-label`}
        hours={hours}
        onChange={next => setHours(saveDailyLimit(next))}
        decreaseLabel={msg('Günlük üst sınırı yarım saat azalt')}
        increaseLabel={msg('Günlük üst sınırı yarım saat artır')}
      />
    </li>
  );
}
