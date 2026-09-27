import { useRef, useState } from 'react';
import { Bell, BellOff, ListPlus, LoaderCircle, TriangleAlert } from 'lucide-react';
import { formatClock, formatLongDate, formatMinutes } from '../../lib/format';
import type { PlaylistSync, SyncNotification } from '../../lib/playlistSync';
import { FAILURE_TEXT } from '../../lib/playlistImport';
import { resolveColor } from '../../lib/subjects';
import { SubjectDot } from '../ui/Bits';
import { Dialog } from '../ui/Dialog';
import { msg } from '../../lib/messages';


interface Props {
  notifications: SyncNotification[];
  sync: PlaylistSync;
  /** Some branch has a playlist to check (and this is not the demo). */
  enabled: boolean;
  checking: boolean;
  today: string;
  /** Name the camp in each notice (more than one camp). */
  showCamp: boolean;
  onAccept: (notice: SyncNotification) => void;
  onDismiss: (notice: SyncNotification) => void;
}

const SHOWN_VIDEOS = 3;

/** One branch's new playlist videos, with the choice to append them or let them go. */
function Notice({ notice, showCamp, onAccept, onDismiss }: { notice: SyncNotification; showCamp: boolean } & Pick<Props, 'onAccept' | 'onDismiss'>) {
  const { branch, videos } = notice;
  const color = resolveColor(branch.colorTag, branch.subject).solid;
  const more = videos.length - SHOWN_VIDEOS;
  return (
    <li className="rounded-[14px] border border-line bg-card p-4">
      <p className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold">
        <SubjectDot color={color} />
        <span className="truncate" style={{ color }}>
          {showCamp ? `${notice.campName} · ${branch.subject}` : branch.subject}
        </span>
      </p>
      <p className="mt-1.5 text-[14.5px] leading-snug text-ink">
        <span className="font-semibold break-words">{msg("“")}{branch.title || branch.subject}{msg("”")}</span> {msg(" listesine")}{msg(" ")}
        <span className="font-semibold">{videos.length} {msg(" yeni video")}</span> {msg(" eklendi")}{msg(" ")}
        <span className="tnum text-ink-2">{msg("(Toplam ")}{formatMinutes(notice.minutes)}{msg(")")}</span>{msg(".\n      ")}</p>
      <ul className="mt-2.5 space-y-1">
        {videos.slice(0, SHOWN_VIDEOS).map(video => (
          <li key={video.youtubeId} className="flex min-w-0 items-baseline gap-2 text-[13px]">
            <span className="min-w-0 flex-1 truncate text-ink-2">{video.title}</span>
            <span className="tnum shrink-0 text-ink-3">{formatClock(video.durationSeconds)}</span>
          </li>
        ))}
        {more > 0 && <li className="text-[12.5px] text-ink-3">{msg("+")}{more} {msg(" video daha")}</li>}
      </ul>
      <div className="mt-3.5 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onAccept(notice)}>
          <ListPlus aria-hidden="true" />
          {msg("\n          Planımın sonuna ekle\n        ")}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDismiss(notice)}>
          {msg("\n          Göz ardı et\n        ")}</button>
      </div>
    </li>
  );
}

/**
 * The bell in the navigation: new videos found in the branches' YouTube
 * playlists by the daily check, each waiting for "Planımın sonuna ekle" or
 * "Göz ardı et".
 */
export function NotificationBell({ notifications, sync, enabled, checking, today, showCamp, onAccept, onDismiss }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const count = notifications.reduce((acc, n) => acc + n.videos.length, 0);
  const failedToday = sync.lastAttempt === today && sync.lastFailure !== null ? FAILURE_TEXT[sync.lastFailure] : null;
  const label = count > 0 ? `Bildirimler: ${count} yeni video` : 'Bildirimler';

  let status: string;
  if (!enabled) status = 'Oynatma listesiyle eklenmiş branşın yok.';
  else if (checking) status = 'Oynatma listelerin kontrol ediliyor…';
  else if (sync.lastAttempt === today) status = 'Listelerin bugün kontrol edildi; bir sonraki kontrol yarın.';
  else if (sync.lastAttempt) status = `Son kontrol ${formatLongDate(sync.lastAttempt)}.`;
  else status = 'Listelerin günde bir kez kontrol edilir.';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn relative shrink-0"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-busy={checking || undefined}
      >
        <Bell aria-hidden="true" />
        {count > 0 && (
          <span className="bell-badge tnum" aria-hidden="true">
            {count > 99 ? msg("99+") : count}
          </span>
        )}
        {checking && count === 0 && <span className="bell-pulse" aria-hidden="true" />}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} placement="dropdown" anchor={buttonRef} width={400} title={msg("Bildirimler")} description={status}>
        {checking && notifications.length === 0 && (
          <p className="flex items-center gap-2 py-2 text-[13.5px] text-ink-2">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {msg("\n            YouTube’dan okunuyor…\n          ")}</p>
        )}
        {failedToday && (
          <p className="callout callout-warn mb-3 text-[13px] text-ink-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
            <span>
              <span className="font-semibold text-ink">{msg("Bugünkü kontrol tamamlanamadı: ")}{failedToday.title}{msg(".")}</span> {msg(" Yarın yeniden\n              denenecek.\n            ")}</span>
          </p>
        )}
        {notifications.length > 0 ? (
          <ul className="space-y-3">
            {notifications.map(notice => (
              <Notice key={notice.branch.id} notice={notice} showCamp={showCamp} onAccept={onAccept} onDismiss={onDismiss} />
            ))}
          </ul>
        ) : (
          !checking && (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="grid size-11 place-items-center rounded-[13px] bg-sunk text-ink-3" aria-hidden="true">
                {enabled ? <Bell className="size-5" /> : <BellOff className="size-5" />}
              </span>
              <p className="mt-3 font-semibold text-ink">{msg("Yeni video yok")}</p>
              <p className="mt-1 max-w-[19rem] text-[13px] text-ink-2">
                {enabled
                  ? msg("Oynatma listelerine yeni video eklendiğinde burada görürsün; plana sen onaylayınca eklenir.")
                  : msg("Bir branşı YouTube oynatma listesinden eklediğinde, listeye gelen yeni videoları burada görürsün.")}
              </p>
            </div>
          )
        )}
      </Dialog>
    </>
  );
}
