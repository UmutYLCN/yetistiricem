import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, Clock, Download, ExternalLink, Gauge, Layers, LoaderCircle, TriangleAlert, Trash2 } from 'lucide-react';
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
import { AuthorBadge, AuthorCard } from './AuthorBadge';
import type { SaveToggle } from '../views/DiscoverView';
import { CoverImage, SaveButton } from './CampCover';
import { msg, translateTemplate } from '../../lib/messages';


interface Props {
  id: string;
  today: string;
  /** The signed-in student's id, to offer removing their own camp. */
  userId: string | null;
  onBack: () => void;
  onImport: (camp: SharedCamp) => void;
  onUnpublish: (entry: CatalogEntry) => void;
  /** Whether the student saved this camp; null without an account (the heart asks to sign in). */
  saved: boolean | null;
  onToggleSave: SaveToggle;
  onSignIn: () => void;
  onNotify: (message: string) => void;
}

const SHOWN_VIDEOS = 12;

type Loaded = { status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ready'; entry: CatalogEntry; camp: SharedCamp | null };

/** A published camp in full: who made it, its tempo and every branch's videos, and "Kendi planıma ekle". */
export function CampDetail({ id, today, userId, onBack, onImport, onUnpublish, saved, onToggleSave, onSignIn, onNotify }: Props) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  // Branches whose whole video list is shown (long lists start with the first few).
  const [showAll, setShowAll] = useState<Set<number>>(() => new Set());

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
      {msg("\n      Keşfet\n    ")}</button>
  );

  if (loaded.status !== 'ready') {
    return (
      <div className="mx-auto max-w-[920px]">
        {back}
        {loaded.status === 'loading' ? (
          <p className="flex items-center gap-2 py-10 text-[14px] text-ink-2">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {msg("\n            Kamp yükleniyor…\n          ")}</p>
        ) : (
          <div className="callout callout-warn">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-[14px] text-ink-2">
              {loaded.status === 'missing' ? msg("Bu kamp artık yayında değil; yayınlayan kişi kaldırmış olabilir.") : loaded.message}
            </p>
          </div>
        )}
      </div>
    );
  }

  const { entry } = loaded;
  const toggleSave = async () => {
    if (saved === null) {
      onSignIn();
      return;
    }
    const result = await onToggleSave(entry.id);
    if (!result.ok) {
      onNotify(result.error);
      return;
    }
    setLoaded(current =>
      current.status === 'ready'
        ? { ...current, entry: { ...current.entry, saveCount: Math.max(0, current.entry.saveCount + (result.saved ? 1 : -1)) } }
        : current
    );
  };
  const own = userId !== null && entry.authorId === userId;
  const schedule = camp?.schedule;
  const studyDays = schedule ? schedule.activeDays.filter(d => !schedule.restDays.includes(d) && !schedule.mockExamDays.includes(d)) : [];
  const published = publishedLabel(entry.createdAt, today);
  const subjects = camp ? camp.branches.map(b => b.subject) : entry.subjects;
  const totalMinutes = camp ? camp.branches.reduce((sum, b) => sum + b.videos.reduce((acc, v) => acc + v.minutes, 0), 0) : entry.totalMinutes;
  const tempo = schedule
    ? [
        { icon: Clock, label: `Günde ${formatMinutes(schedule.dailyStudyHours * 60)} çalışma` },
        { icon: CalendarDays, label: weekdaysLabel(studyDays) },
        { icon: Layers, label: schedule.mode === 'manual' ? 'Branşlar gün gün elle yerleşmiş' : `Günde en çok ${schedule.maxSubjectsPerDay} branş` },
        { icon: Gauge, label: `${formatSpeed(schedule.playbackSpeed)} izleme hızı` },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[920px]">
      {back}

      <header className="card overflow-hidden">
        <CoverImage seed={entry.id} subjects={subjects} cover={entry.cover} rows={4} className="aspect-[16/7] max-h-[300px] w-full">
          {own && <span className="cover-badge absolute top-4 left-4">{msg("Senin kampın")}</span>}
        </CoverImage>
        <div className="px-5 pt-5 pb-6 sm:px-7">
          <h1 className="font-display text-[28px] leading-tight break-words text-ink sm:text-[34px]">{entry.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-3">
            <AuthorBadge name={entry.author.name} avatar={entry.author.avatar} size="sm" />
            <span aria-hidden="true">{msg("·")}</span>
            <span>{published} {msg(" yayınlandı")}</span>
          </div>
          {entry.description && <p className="mt-4 max-w-[46rem] text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{entry.description}</p>}
          {entry.tags.length > 0 && (
            <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[14px] font-medium text-forest">
              {entry.tags.map(tag => (
                <span key={tag}>{msg("#")}{tag}</span>
              ))}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {entry.subjects.map(subject => (
              <span key={subject} className="chip">
                <SubjectDot color={resolveColor(undefined, subject).solid} className="size-1.5" />
                {subject}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:order-last">
          <section className="card p-5" aria-label={msg("Kendi planına ekle")}>
            {forecast ? (
              <>
                <p className="eyebrow">{msg("Bu tempoyla")}</p>
                <p className="font-display tnum mt-1.5 text-[30px] leading-none text-ink">{forecast.studyDays} {msg(" gün")}</p>
                <p className="mt-1.5 text-[13px] text-ink-2">{msg("Bugün başlarsan ")}{formatLongDate(forecast.end)} {msg(" biter.")}</p>
              </>
            ) : (
              <p className="text-[13.5px] text-ink-2">{msg("Bu kampın süresi hesaplanamadı.")}</p>
            )}
            <button type="button" className="btn btn-primary btn-lg mt-4 w-full" disabled={!camp} onClick={() => camp && onImport(camp)}>
              <Download aria-hidden="true" />
              {msg("\n              Kendi planıma ekle\n            ")}</button>
            <div className="mt-2">
              <SaveButton variant="button" saved={saved === true} count={entry.saveCount} name={entry.name} onToggle={() => void toggleSave()} />
            </div>
            <p className="mt-2 text-center text-[12px] text-ink-3">{msg("Eklersen kendi kopyan olur; kaydedersen Keşfet’te Favoriler’de durur.")}</p>

            <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-[12px] border border-line bg-field text-center">
              {[
                { label: 'Branş', value: String(entry.branchCount) },
                { label: 'Video', value: String(entry.videoCount) },
                { label: 'Süre', value: formatHours(entry.totalMinutes) },
              ].map(stat => (
                <div key={stat.label} className="min-w-0 px-2 py-3">
                  <dt className="text-[11.5px] text-ink-3">{stat.label}</dt>
                  <dd className="font-display tnum mt-0.5 truncate text-[17px] text-ink">{stat.value}</dd>
                </div>
              ))}
            </dl>

            {tempo.length > 0 && (
              <ul className="mt-4 space-y-2.5 text-[13px] text-ink-2">
                {tempo.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-sunk text-ink-3" aria-hidden="true">
                      <Icon className="size-3.5" />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            )}

            {own && (
              <button type="button" className="btn btn-danger-quiet btn-sm mt-5 w-full" onClick={() => onUnpublish(entry)}>
                <Trash2 aria-hidden="true" />
                {msg("\n                Yayından kaldır\n              ")}</button>
            )}
          </section>

          <AuthorCard author={entry.author} published={published} />
        </aside>

        <section aria-labelledby="detail-branches" className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="detail-branches" className="text-[16px] font-semibold text-ink">
              {msg("\n              Program\n            ")}</h2>
            <p className="tnum text-[13px] text-ink-3">
              {entry.branchCount} {msg(" branş · ")}{entry.videoCount} {msg(" video\n            ")}</p>
          </div>
          {!camp ? (
            <div className="callout callout-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
              <p className="text-[14px] text-ink-2">{msg("Bu kampın verisi okunamadı; kendi planına eklenemiyor.")}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {camp.branches.map((branch, i) => {
                const color = resolveColor(branch.color, branch.subject).solid;
                const minutes = branch.videos.reduce((acc, v) => acc + v.minutes, 0);
                const share = totalMinutes > 0 ? Math.max(2, Math.round((minutes / totalMinutes) * 100)) : 0;
                return (
                  <li key={`${branch.subject}-${i}`}>
                    <details className="card group overflow-hidden" open={camp.branches.length === 1}>
                      <summary className="flex cursor-pointer list-none items-center gap-3.5 px-4 py-4 sm:px-5">
                        <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: color }} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-display text-[17px] leading-tight break-words" style={{ color }}>
                              {branch.subject}
                            </span>
                            <span className="tnum text-[12.5px] text-ink-3">
                              {branch.videos.length} {msg(" video · ")}{formatHours(minutes)}
                            </span>
                          </span>
                          {branch.title && <span className="mt-0.5 block truncate text-[13px] text-ink-2">{branch.title}</span>}
                          <span className="mt-2.5 flex items-center gap-2.5">
                            <span className="h-1 flex-1 overflow-hidden rounded-full bg-sunk">
                              <span className="block h-full rounded-full" style={{ width: `${share}%`, background: color }} />
                            </span>
                            <span className="tnum w-10 shrink-0 text-right text-[11.5px] text-ink-3">{msg("%")}{share}</span>
                          </span>
                        </span>
                        <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <ol className="border-t border-line bg-field/60">
                        {(showAll.has(i) ? branch.videos : branch.videos.slice(0, SHOWN_VIDEOS)).map((video, n) => (
                          <li key={n} className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-[13.5px] first:border-t-0 sm:px-5">
                            <span className="tnum w-7 shrink-0 text-right text-[12px] text-ink-3">{n + 1}</span>
                            <span className="min-w-0 flex-1 break-words text-ink-2">{video.title || `Video ${n + 1}`}</span>
                            <span className="tnum shrink-0 text-[12.5px] text-ink-3">{formatMinutes(video.minutes)}</span>
                            {video.youtubeId ? (
                              <a
                                href={youtubeWatchUrl(video.youtubeId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="icon-btn -my-1.5 size-8 shrink-0"
                                aria-label={translateTemplate('{title} videosunu YouTube’da aç (yeni sekme)', { title: video.title || `${msg('Video')} ${n + 1}` })}
                              >
                                <ExternalLink aria-hidden="true" />
                              </a>
                            ) : (
                              <span className="size-8 shrink-0" aria-hidden="true" />
                            )}
                          </li>
                        ))}
                      </ol>
                      {branch.videos.length > SHOWN_VIDEOS && !showAll.has(i) && (
                        <div className="border-t border-line px-4 py-2 sm:px-5">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll(current => new Set(current).add(i))}>
                            <ChevronDown aria-hidden="true" />
                            {msg("\n                            Tümünü göster (")}{branch.videos.length} {msg(" video)\n                          ")}</button>
                        </div>
                      )}
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
