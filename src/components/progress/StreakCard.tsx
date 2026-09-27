import { Check, Flame, Moon, Trophy, X } from 'lucide-react';
import type { ChainDay, Streak } from '../../lib/insights';
import { dayOfWeek, formatDateKey } from '../../lib/engine';
import { SHORT_WEEKDAYS, dateLocale } from '../../lib/format';
import { msg, translateTemplate } from '../../lib/messages';


const LINK_TEXT: Record<ChainDay['state'], string> = {
  done: 'çalışıldı',
  missed: 'çalışılmadı',
  rest: 'plan yok, seri korundu',
  pending: 'bugün, henüz görev tamamlanmadı',
};

function ChainLink({ day }: { day: ChainDay }) {
  const Icon = day.state === 'done' ? Check : day.state === 'missed' ? X : day.state === 'rest' ? Moon : Flame;
  return (
    <li className="flex flex-col items-center gap-1.5">
      <span className="chain-link" data-state={day.state} aria-hidden="true">
        <Icon strokeWidth={day.state === 'done' ? 3 : 2.25} />
      </span>
      <span className={`text-[10.5px] font-semibold ${day.state === 'pending' ? 'text-accent' : 'text-ink-3'}`} aria-hidden="true">
        {SHORT_WEEKDAYS[dayOfWeek(day.date)]}
      </span>
      <span className="visually-hidden">
        {formatDateKey(day.date, { day: 'numeric', month: 'long', weekday: 'long' }, dateLocale())}{msg(": ")}{msg(LINK_TEXT[day.state])}
      </span>
    </li>
  );
}

/** "Zinciri kırma": consecutive days with at least one task done, and what keeps it alive today. */
export function StreakCard({ streak, chain }: { streak: Streak; chain: ChainDay[] }) {
  const { current, best, todayDone, todayIsStudyDay } = streak;

  let status: { tone: 'forest' | 'accent' | 'quiet'; title: string; body?: string };
  if (todayDone) {
    status = { tone: 'forest', title: 'Bugünü kaydettin, zincir sağlam.', body: 'Yarın da tek bir görevle devam.' };
  } else if (todayIsStudyDay && current > 0) {
    status = {
      tone: 'accent',
      title: 'Bugün seriyi korumak için {count} video kaldı!',
      body: 'Tek bir görev tamamla, serin {days} güne çıksın.',
    };
  } else if (todayIsStudyDay) {
    status = { tone: 'accent', title: 'Bugün 1 video tamamla, yeni bir seri başlat.' };
  } else {
    status = { tone: 'quiet', title: 'Bugün planında çalışma yok; serin korunuyor.' };
  }

  return (
    <section className="card streak-glow flex min-w-0 flex-col p-5" aria-labelledby="progress-streak">
      <h2 id="progress-streak" className="eyebrow">
        {msg("\n        Yetişir serisi\n      ")}</h2>
      <div className="mt-3 flex items-center gap-3">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-[14px] ${
            current > 0 ? 'bg-accent-soft text-accent-strong' : 'bg-sunk text-ink-3'
          }`}
          aria-hidden="true"
        >
          <Flame className="size-6" fill={current > 0 ? 'currentColor' : 'none'} fillOpacity={0.25} />
        </span>
        <p className="min-w-0">
          <span className="font-display tnum block text-[34px] leading-none text-ink">
            {current} <span className="text-[17px] text-ink-2">{msg("gün")}</span>
          </span>
          <span className="mt-1 block text-[13px] text-ink-2">
            {current > 0
              ? translateTemplate('{count} günlük Yetişir serisi', { count: current })
              : msg("Yetişir serin henüz başlamadı")}
          </span>
        </p>
      </div>
      {best > 0 && (
        <p className="tnum mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3">
          <Trophy className="size-3.5" aria-hidden="true" />
          {msg("\n          En uzun serin: ")}<span className="font-semibold text-ink-2">{best} {msg(" gün")}</span>
        </p>
      )}

      <ol className="mt-4 flex justify-between gap-1" aria-label={msg("Son 7 gün")}>
        {chain.map(day => (
          <ChainLink key={day.date} day={day} />
        ))}
      </ol>

      <div
        className={`mt-4 rounded-[12px] px-3.5 py-3 text-[13.5px] ${
          status.tone === 'forest' ? 'callout-info border' : status.tone === 'accent' ? 'callout-accent border' : 'bg-sunk'
        }`}
      >
        <p className="font-semibold text-ink">
          {status.title.includes('{count}')
            ? translateTemplate(status.title, { count: 1 })
            : msg(status.title)}
        </p>
        {status.body && (
          <p className="mt-0.5 text-ink-2">
            {status.body.includes('{days}')
              ? translateTemplate(status.body, { days: current + 1 })
              : msg(status.body)}
          </p>
        )}
      </div>
    </section>
  );
}
