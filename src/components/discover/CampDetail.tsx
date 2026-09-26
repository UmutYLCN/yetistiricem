import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Download, ExternalLink, LoaderCircle, TriangleAlert, Trash2 } from 'lucide-react';
import type { SharedCamp } from '../../lib/campShare';
import { campFromShare } from '../../lib/campShare';
import type { CatalogEntry } from '../../lib/catalog';
import { publishedLabel } from '../../lib/catalog';
import { getPublishedCamp } from '../../lib/catalogApi';
import { buildCampSchedule, planEndDate } from '../../lib/engine';
import { formatHours, formatLongDate, formatMinutes, formatSpeed } from '../../lib/format';
import { weekdaysLabel } from '../../lib/planView';
import { resolveColor } from '../../lib/subjects';
import { youtubeWatchUrl } from '../../utils/youtubeParser';
import { SubjectDot } from '../ui/Bits';
import { AuthorBadge } from './AuthorBadge';

interface Props {
  id: string;
  today: string;
  /** The signed-in student's id, to offer removing their own camp. */
  userId: string | null;
  onBack: () => void;
  onImport: (camp: SharedCamp) => void;
  onUnpublish: (entry: CatalogEntry) => void;
}

type Loaded = { status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ready'; entry: CatalogEntry; camp: SharedCamp | null };

/** A published camp in full: who made it, its tempo and every branch's videos, and "Kendi planıma ekle". */
export function CampDetail({ id, today, userId, onBack, onImport, onUnpublish }: Props) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void getPublishedCamp(id).then(result => {
      if (cancelled) return;
      if (!result.ok) setLoaded({ status: 'error', message: result.error });
      else if (!result.data) setLoaded({ status: 'missing' });
      else setLoaded({ status: 'ready', ...result.data });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const camp = loaded.status === 'ready' ? loaded.camp : null;
  // How long the camp takes with its own tempo, starting today (the imported camp is laid out the same way).
  const forecast = useMemo(() => {
    if (!camp) return null;
    const { plans } = buildCampSchedule(campFromShare(camp, today), { today });
    const end = planEndDate(plans);
    return end ? { end, studyDays: plans.filter(p => p.items.length > 0).length } : null;
  }, [camp, today]);

  const back = (
    <button type="button" className="btn btn-ghost btn-sm -ml-2 mb-4" onClick={onBack}>
      <ArrowLeft aria-hidden="true" />
      Keşfet
    </button>
  );

  if (loaded.status !== 'ready') {
    return (
      <div className="mx-auto max-w-[920px]">
        {back}
        {loaded.status === 'loading' ? (
          <p className="flex items-center gap-2 py-10 text-[14px] text-ink-2">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Kamp yükleniyor…
          </p>
        ) : (
          <div className="callout callout-warn">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-[14px] text-ink-2">
              {loaded.status === 'missing' ? 'Bu kamp artık yayında değil; yayınlayan kişi kaldırmış olabilir.' : loaded.message}
            </p>
          </div>
        )}
      </div>
    );
  }

  const { entry } = loaded;
  const own = userId !== null && entry.authorId === userId;
  const schedule = camp?.schedule;
  const studyDays = schedule ? schedule.activeDays.filter(d => !schedule.restDays.includes(d) && !schedule.mockExamDays.includes(d)) : [];
  const tiles = [
    { label: 'Branş', value: String(entry.branchCount) },
    { label: 'Video', value: String(entry.videoCount) },
    { label: 'Toplam süre', value: formatHours(entry.totalMinutes) },
    {
      label: 'Bu tempoyla',
      value: forecast ? `${forecast.studyDays} gün` : '—',
      note: forecast ? `bugün başlarsan ${formatLongDate(forecast.end)}` : undefined,
    },
  ];

  return (
    <div className="mx-auto max-w-[920px]">
      {back}
      <header className="mb-6">
        <h1 className="font-display text-[28px] leading-tight break-words text-ink sm:text-[32px]">{entry.name}</h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px] text-ink-2">
          <AuthorBadge name={entry.authorName} />
          <span className="text-ink-3">{publishedLabel(entry.createdAt, today)} yayınlandı</span>
          {own && <span className="chip chip-forest">Senin kampın</span>}
        </div>
        {entry.description && <p className="mt-4 max-w-[46rem] text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{entry.description}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={!camp} onClick={() => camp && onImport(camp)}>
            <Download aria-hidden="true" />
            Kendi planıma ekle
          </button>
          {own && (
            <button type="button" className="btn btn-danger-quiet" onClick={() => onUnpublish(entry)}>
              <Trash2 aria-hidden="true" />
              Yayından kaldır
            </button>
          )}
        </div>
      </header>

      {!camp ? (
        <div className="callout callout-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <p className="text-[14px] text-ink-2">Bu kampın verisi okunamadı; kendi planına eklenemiyor.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map(tile => (
              <div key={tile.label} className="card min-w-0 p-4">
                <p className="eyebrow">{tile.label}</p>
                <p className="font-display tnum mt-2 text-[24px] leading-none text-ink">{tile.value}</p>
                {tile.note && <p className="mt-1.5 text-[12px] text-ink-3">{tile.note}</p>}
              </div>
            ))}
          </div>
          {schedule && (
            <p className="tnum mt-3 text-[13px] text-ink-3">
              Tempo: günde {formatMinutes(schedule.dailyStudyHours * 60)} · {weekdaysLabel(studyDays)} ·{' '}
              {schedule.mode === 'manual' ? 'elle yerleşim' : `günde en çok ${schedule.maxSubjectsPerDay} branş`} · {formatSpeed(schedule.playbackSpeed)}{' '}
              izleme. Ekledikten sonra Kamplar’dan değiştirebilirsin.
            </p>
          )}

          <section className="mt-6" aria-labelledby="detail-branches">
            <h2 id="detail-branches" className="mb-3 text-[15px] font-semibold text-ink">
              Branşlar ve videolar
            </h2>
            <ul className="space-y-2.5">
              {camp.branches.map((branch, i) => {
                const color = resolveColor(branch.color, branch.subject).solid;
                const minutes = branch.videos.reduce((acc, v) => acc + v.minutes, 0);
                return (
                  <li key={`${branch.subject}-${i}`}>
                    <details className="card group" open={camp.branches.length === 1}>
                      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3.5 sm:px-5">
                        <SubjectDot color={color} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-ink">{branch.subject}</span>
                          {branch.title && <span className="block truncate text-[12.5px] text-ink-3">{branch.title}</span>}
                        </span>
                        <span className="tnum shrink-0 text-[13px] text-ink-2">
                          {branch.videos.length} video · {formatHours(minutes)}
                        </span>
                        <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <ol className="border-t border-line px-4 py-2 sm:px-5">
                        {branch.videos.map((video, n) => (
                          <li key={n} className="flex items-baseline gap-3 border-t border-line py-2 text-[13.5px] first:border-t-0">
                            <span className="tnum w-7 shrink-0 text-right text-ink-3">{n + 1}.</span>
                            <span className="min-w-0 flex-1 break-words text-ink-2">{video.title || `Video ${n + 1}`}</span>
                            <span className="tnum shrink-0 text-ink-3">{formatMinutes(video.minutes)}</span>
                            {video.youtubeId ? (
                              <a
                                href={youtubeWatchUrl(video.youtubeId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="icon-btn -my-2 size-8 shrink-0"
                                aria-label={`${video.title || `Video ${n + 1}`} videosunu YouTube’da aç (yeni sekme)`}
                              >
                                <ExternalLink aria-hidden="true" />
                              </a>
                            ) : (
                              <span className="size-8 shrink-0" aria-hidden="true" />
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
