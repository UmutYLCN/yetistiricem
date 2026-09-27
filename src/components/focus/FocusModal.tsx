import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import confetti from 'canvas-confetti';
import { ArrowRight, Check, CircleCheck, ExternalLink, LoaderCircle, Play, TriangleAlert, Undo2 } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import type { FocusSession } from '../../lib/focus';
import { formatClock, formatMinutes, formatSpeed } from '../../lib/format';
import type { CampInfo } from '../../lib/planView';
import type { YTPlayer } from '../../lib/youtubePlayer';
import { PLAYER_STATE, loadYouTubeApi, playerErrorMessage } from '../../lib/youtubePlayer';
import { SubjectDot } from '../ui/Bits';
import { Dialog } from '../ui/Dialog';

/** The task playing in focus mode. */
export interface FocusTarget {
  item: DailyPlanItem;
  date: string;
  videoId: string;
  info: CampInfo | undefined;
  /** "Tüm Kamplar": the task's camp. */
  campName?: string;
  /** The camp's planned playback speed; the player starts at it when YouTube offers it. */
  speed: number;
}

interface Props {
  /** Null when closed. */
  target: FocusTarget | null;
  /** The next open task of the day that can play here. */
  next: DailyPlanItem | null;
  /** Seconds spent on this video in earlier focus sessions. */
  pastSeconds: number;
  today: string;
  onComplete: (item: DailyPlanItem) => void;
  onUndoComplete: (item: DailyPlanItem) => void;
  onSession: (session: FocusSession) => void;
  onNext: () => void;
  onClose: () => void;
}

/** Brand colours for the confetti, read from the role tokens. */
function tokenColors(): string[] {
  const style = getComputedStyle(document.documentElement);
  return ['--color-forest', '--color-accent', '--color-forest-strong', '--color-ink']
    .map(name => style.getPropertyValue(name).trim())
    .filter(Boolean);
}

interface PlayerView {
  status: 'loading' | 'ready' | 'error';
  error: number | 'api' | null;
  state: number;
  rate: number;
  pauses: number;
  watched: number;
  current: number;
  duration: number;
}

interface PlayerProps {
  /** YouTube id to play. */
  videoId: string;
  /** The task's own `Video.id`, which the session is recorded under. */
  taskVideoId: string;
  videoUrl: string;
  speed: number;
  today: string;
  /** The task was finished in this session: the player pauses and the result covers it. */
  done: boolean;
  doneOverlay: ReactNode;
  pastSeconds: number;
  onEnded: () => void;
  onSession: (session: FocusSession) => void;
}

/**
 * One video in the YouTube IFrame player, with the metrics of this session:
 * real time spent playing, pauses and playback rate. Pausing and the end of
 * the video cover YouTube's suggestions with the app's own panel. The session
 * is handed to `onSession` when the player goes away.
 */
function FocusPlayer({ videoId, taskVideoId, videoUrl, speed, today, done, doneOverlay, pastSeconds, onEnded, onSession }: PlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const metrics = useRef({ watchedMs: 0, playingSince: null as number | null, pauses: 0, rate: 1, ended: false, lastState: -1, quietPause: false });
  const callbacks = useRef({ onEnded, onSession });
  // Read once when the player starts: a new day or speed never restarts the video.
  const start = useRef({ speed, today, taskVideoId });
  const [view, setView] = useState<PlayerView>({
    status: 'loading',
    error: null,
    state: PLAYER_STATE.UNSTARTED,
    rate: 1,
    pauses: 0,
    watched: 0,
    current: 0,
    duration: 0,
  });

  useEffect(() => {
    callbacks.current = { onEnded, onSession };
  });

  useEffect(() => {
    const m = metrics.current;
    const { speed: planned, today: day, taskVideoId: sessionId } = start.current;
    let cancelled = false;
    const stopClock = () => {
      if (m.playingSince === null) return;
      m.watchedMs += performance.now() - m.playingSince;
      m.playingSince = null;
    };
    const watchedNow = () => (m.watchedMs + (m.playingSince === null ? 0 : performance.now() - m.playingSince)) / 1000;

    loadYouTubeApi()
      .then(YT => {
        if (cancelled || !hostRef.current) return;
        // The API swaps this element for its iframe, so React never owns it.
        const mount = document.createElement('div');
        hostRef.current.replaceChildren(mount);
        playerRef.current = new YT.Player(mount, {
          host: 'https://www.youtube-nocookie.com',
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, rel: 0, playsinline: 1, iv_load_policy: 3, modestbranding: 1, origin: window.location.origin },
          events: {
            onReady: ({ target }) => {
              if (planned !== 1 && target.getAvailablePlaybackRates().includes(planned)) target.setPlaybackRate(planned);
              m.rate = target.getPlaybackRate();
              setView(v => ({ ...v, status: 'ready', rate: m.rate, duration: target.getDuration() }));
              target.playVideo();
            },
            onStateChange: ({ data }) => {
              if (data === PLAYER_STATE.PLAYING) {
                if (m.playingSince === null) m.playingSince = performance.now();
              } else {
                stopClock();
              }
              if (data === PLAYER_STATE.PAUSED && m.lastState === PLAYER_STATE.PLAYING) {
                if (m.quietPause) m.quietPause = false;
                else m.pauses++;
              }
              m.lastState = data;
              if (data === PLAYER_STATE.ENDED && !m.ended) {
                m.ended = true;
                callbacks.current.onEnded();
              }
              setView(v => ({ ...v, state: data, pauses: m.pauses, watched: watchedNow() }));
            },
            onPlaybackRateChange: ({ data }) => {
              m.rate = data;
              setView(v => ({ ...v, rate: data }));
            },
            onError: ({ data }) => {
              stopClock();
              setView(v => ({ ...v, status: 'error', error: data }));
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setView(v => ({ ...v, status: 'error', error: 'api' }));
      });

    const tick = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;
      setView(v => ({ ...v, watched: watchedNow(), current: player.getCurrentTime(), duration: player.getDuration() || v.duration }));
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      stopClock();
      const watchedSeconds = Math.round(m.watchedMs / 1000);
      if (watchedSeconds > 0 || m.ended) {
        callbacks.current.onSession({ videoId: sessionId, date: day, watchedSeconds, pauses: m.pauses, rate: m.rate, ended: m.ended });
      }
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  // Finished by hand ("İzledim"): stop the video without counting a pause.
  useEffect(() => {
    if (!done || metrics.current.lastState !== PLAYER_STATE.PLAYING) return;
    metrics.current.quietPause = true;
    playerRef.current?.pauseVideo();
  }, [done]);

  const failure = view.status === 'error' && view.error !== null ? playerErrorMessage(view.error) : null;
  const paused = view.status === 'ready' && view.state === PLAYER_STATE.PAUSED && !done;
  const progress = view.duration > 0 ? Math.min(1, view.current / view.duration) : 0;

  return (
    <div className="focus-stage">
      <div className="focus-frame">
        <div ref={hostRef} className="focus-player" />

        {view.status === 'loading' && (
          <div className="focus-cover">
            <LoaderCircle className="size-7 animate-spin text-ink-3" aria-hidden="true" />
            <p className="mt-3 text-[14px] text-ink-2">Oynatıcı hazırlanıyor…</p>
          </div>
        )}

        {failure && (
          <div className="focus-cover" role="alert">
            <span className="grid size-12 place-items-center rounded-[14px] bg-warn-soft text-warn" aria-hidden="true">
              <TriangleAlert className="size-6" />
            </span>
            <p className="mt-4 text-[17px] font-semibold text-ink">{failure.title}</p>
            <p className="mt-1.5 max-w-[26rem] text-[14px] text-ink-2">{failure.body}</p>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-5">
              YouTube’da aç
              <ExternalLink aria-hidden="true" />
            </a>
          </div>
        )}

        {paused && (
          // Leaves the control bar free and hides the suggestions YouTube shows on pause.
          <div className="focus-cover focus-cover-paused">
            <button type="button" className="focus-resume" onClick={() => playerRef.current?.playVideo()}>
              <Play fill="currentColor" aria-hidden="true" />
              <span className="visually-hidden">Devam et</span>
            </button>
            <p className="mt-3 text-[14px] font-semibold text-ink">Duraklatıldı</p>
            <p className="mt-0.5 text-[13px] text-ink-2">Notunu al, hazır olunca devam et. Öneriler gizlendi.</p>
          </div>
        )}

        {done && <div className="focus-cover focus-cover-done">{doneOverlay}</div>}
      </div>

      {!failure && (
        <>
          <div className="focus-meter" aria-hidden="true">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <dl className="focus-stats tnum">
            <div>
              <dt>Odak süresi</dt>
              <dd>{formatClock(view.watched)}</dd>
            </div>
            <div>
              <dt>Hız</dt>
              <dd>{formatSpeed(view.rate)}</dd>
            </div>
            <div>
              <dt>Duraklatma</dt>
              <dd>{view.pauses}</dd>
            </div>
            <div>
              <dt>Video</dt>
              <dd>
                {formatClock(view.current)}
                <span className="text-ink-3"> / {view.duration > 0 ? formatClock(view.duration) : '—'}</span>
              </dd>
            </div>
          </dl>
        </>
      )}
      {pastSeconds >= 60 && (
        <p className="mt-2 text-center text-[12.5px] text-ink-3">
          Bu videoya önceki odak oturumlarında {formatMinutes(pastSeconds / 60)} ayırdın.
        </p>
      )}
    </div>
  );
}

/**
 * Focus mode: the task's video full screen inside the app, away from
 * YouTube's feed. When the video ends the task is ticked off, confetti
 * falls, and the next task of the day is one click away.
 */
export function FocusModal({ target, next, pastSeconds, today, onComplete, onUndoComplete, onSession, onNext, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<{ canvas: HTMLCanvasElement; fire: confetti.CreateTypes } | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [done, setDone] = useState(false);
  // Each task starts unfinished (the dialog stays open across "Sıradaki göreve geç").
  const [shownId, setShownId] = useState(target?.item.id ?? null);
  if ((target?.item.id ?? null) !== shownId) {
    setShownId(target?.item.id ?? null);
    setDone(false);
  }

  useEffect(() => {
    if (done) nextRef.current?.focus();
  }, [done]);

  const celebrate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (confettiRef.current?.canvas !== canvas) {
      confettiRef.current = { canvas, fire: confetti.create(canvas, { resize: true, disableForReducedMotion: true }) };
    }
    void confettiRef.current.fire({ particleCount: 110, spread: 75, startVelocity: 38, origin: { y: 0.7 }, colors: tokenColors() });
  };

  const finish = () => {
    if (!target || done) return;
    if (!target.item.completed) onComplete(target.item);
    setDone(true);
    celebrate();
  };

  const item = target?.item;
  const color = target?.info?.color.solid ?? 'var(--color-ink-3)';
  const alreadyDone = item?.completed && !done;

  const doneOverlay = item && (
    <>
      <span className="focus-done-mark" aria-hidden="true">
        <Check strokeWidth={3} />
      </span>
      <p className="font-display mt-4 text-[26px] text-ink max-sm:mt-2 max-sm:text-[20px]">Harika iş!</p>
      <p className="mt-1 text-[14px] text-ink-2">
        {item.completed ? '“İzledim” olarak işaretlendi.' : 'İşaret geri alındı.'}{' '}
        {item.completed && (
          <button type="button" className="inline-flex items-center gap-1 font-semibold text-ink-2 underline" onClick={() => onUndoComplete(item)}>
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

  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      placement="full"
      title={item?.title ?? ''}
      eyebrow={
        item && (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="text-accent-strong">Yetişir Focus</span>
            <span aria-hidden="true">·</span>
            <SubjectDot color={color} />
            <span className="truncate" style={{ color }}>
              {target?.campName ? `${target.campName} · ${item.subject}` : item.subject}
            </span>
          </span>
        )
      }
      footer={
        item && (
          <>
            <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mr-auto max-sm:px-2.5">
              <ExternalLink aria-hidden="true" />
              <span className="max-sm:hidden">YouTube’da aç</span>
              <span className="visually-hidden sm:hidden">YouTube’da aç</span>
            </a>
            {done ? (
              next ? (
                <button ref={nextRef} type="button" className="btn btn-primary btn-lg focus-next" onClick={onNext}>
                  Harika iş! Sıradaki göreve geç
                  <ArrowRight aria-hidden="true" />
                </button>
              ) : (
                <button ref={nextRef} type="button" className="btn btn-primary btn-lg" onClick={onClose}>
                  Kapat
                </button>
              )
            ) : alreadyDone ? (
              <>
                <p className="flex items-center gap-1.5 text-[14px] font-semibold text-forest">
                  <CircleCheck className="size-4" aria-hidden="true" />
                  Tamamlandı
                </p>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Kapat
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={finish}>
                <Check strokeWidth={2.75} aria-hidden="true" />
                İzledim
              </button>
            )}
          </>
        )
      }
    >
      <canvas ref={canvasRef} className="focus-confetti" aria-hidden="true" />
      {target && (
        <FocusPlayer
          key={target.videoId}
          videoId={target.videoId}
          taskVideoId={target.item.videoId}
          videoUrl={target.item.videoUrl}
          speed={target.speed}
          today={today}
          done={done}
          doneOverlay={doneOverlay}
          pastSeconds={pastSeconds}
          onEnded={finish}
          onSession={onSession}
        />
      )}
    </Dialog>
  );
}
