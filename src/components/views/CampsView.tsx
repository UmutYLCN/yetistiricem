import { useState } from 'react';
import { ChevronDown, CloudOff, Compass, ExternalLink, Gauge, Globe, ListVideo, Pause, Pencil, Play, Plus, RefreshCw, Trash2, TriangleAlert, Upload } from 'lucide-react';
import type { StudyCamp } from '../../types';
import type { CatalogEntry } from '../../lib/catalog';
import type { CampInfo, PlanIndex } from '../../lib/planView';
import { campProgress, weekdaysLabel } from '../../lib/planView';
import { isImportedCamp } from '../../lib/campShare';
import { isLegacyKind, linkStateOf, totalMinutesOf } from '../../lib/camps';
import { countCompletedVideos } from '../../lib/engine';
import { compactDayLabel, formatLongDate, formatMinutes, formatShortDate } from '../../lib/format';
import { PageHeader } from '../layout/PageHeader';
import { KindBadge, Meter } from '../ui/Bits';
import { Menu } from '../ui/Menu';
import type { MenuItem } from '../ui/Menu';
import { NoCampsYet } from './Welcome';
import { msg, translateTemplate } from '../../lib/messages';


interface Props {
  allCamps: StudyCamp[];
  activeCamp: StudyCamp | null;
  /** The active camp's branches. */
  camps: CampInfo[];
  index: PlanIndex;
  completedMap: Record<string, boolean>;
  today: string;
  isDemo: boolean;
  /**
   * The plan screens show several camps together. Choosing a camp here then
   * only picks the camp to manage below; the combined view stays.
   */
  showsAllCamps: boolean;
  onAddCamp: () => void;
  onStartDemo: () => void;
  onSelectCamp: (campId: string) => void;
  onEditTempo: () => void;
  onRenameCamp: (campId: string) => void;
  /** "Keşfet’te yayınla" (also updates a camp that is already live). */
  onPublishCamp: (campId: string) => void;
  onDeleteCamp: (campId: string) => void;
  /** Takes the camp off the plan screens, keeping all of it. */
  onPauseCamp: (campId: string) => void;
  /** Puts a paused camp back, its route laid out again from today. */
  onResumeCamp: (campId: string) => void;
  /** The student's live Keşfet entries by their camp id; null while unknown (signed out, demo, loading). */
  publications: ReadonlyMap<string, CatalogEntry> | null;
  onUnpublishCamp: (entry: CatalogEntry) => void;
  onViewPublication: (entry: CatalogEntry) => void;
  onAddBranches: () => void;
  onEditBranch: (campId: string) => void;
  onAddVideos: (campId: string) => void;
  onEditVideo: (campId: string, videoId: string) => void;
}

const LEGACY_TEXT: Record<'legacy-sample' | 'legacy-generated', { title: string; body: string }> = {
  'legacy-sample': {
    title: 'Bu branş önceki sürümün örnek verisinden oluşturuldu.',
    body: 'Video bağlantıları çalışmayan örnek adreslerdi, süreler rastgele üretilmişti ve gösterilen kanal adı yalnızca örnekti. İlerlemen korunuyor; gerçek videoları biliyorsan her göreve bağlantı ve süre ekleyebilir ya da branşı kaldırabilirsin.',
  },
  'legacy-generated': {
    title: 'Bu branş oynatma listesi okunmadan oluşturuldu.',
    body: 'Önceki sürüm listeyi okuyamadığı halde 45 dakikalık 20 “Özel Video” ekliyordu; video sayısı, adları ve süreleri gerçek değil. Görevler oynatma listesini açar. Görevleri tek tek düzenleyebilir ya da branşı kaldırıp gerçek videolarınla yeniden ekleyebilirsin.',
  },
};

function countLabel(count: number, unit: 'kamp' | 'branş' | 'görev' | 'video'): string {
  return count === 1
    ? msg(`1 ${unit}`)
    : translateTemplate(`{count} ${unit}`, { count });
}

function plansOverviewSubtitle(camps: StudyCamp[], showCombined: boolean): string | undefined {
  if (camps.length === 0) return undefined;
  const count = countLabel(camps.length, 'kamp');
  if (!showCombined) return translateTemplate('{count} · her birinin kendi branşları ve temposu var', { count });
  return camps.some(camp => camp.pausedAt)
    ? translateTemplate('{count} · her birinin kendi branşları ve temposu var · Rotam ve İlerleme duraklatılmayanları birlikte gösteriyor', { count })
    : translateTemplate('{count} · her birinin kendi branşları ve temposu var · Rotam ve İlerleme hepsini birlikte gösteriyor', { count });
}

function localizedTempoSummary(schedule: StudyCamp['schedule']): string {
  const hours = formatMinutes(schedule.dailyStudyHours * 60);
  const studyDays = msg(weekdaysLabel(schedule.activeDays.filter(day => !schedule.restDays.includes(day) && !schedule.mockExamDays.includes(day))));
  const mockDays = msg(weekdaysLabel(schedule.mockExamDays));
  const mock = schedule.mockExamDays.length > 0 ? translateTemplate(' · deneme {days}', { days: mockDays }) : '';
  if (schedule.mode === 'manual') {
    return translateTemplate('Elle yerleşim · günde {hours} · {days}{mock}', { hours, days: studyDays, mock });
  }
  return translateTemplate('Otomatik · günde {hours}, {subjects} · {days}{mock}', {
    hours,
    subjects: countLabel(schedule.maxSubjectsPerDay, 'branş'),
    days: studyDays,
    mock,
  });
}

function activeCampSubtitle(camp: StudyCamp, branchCount: number, taskCount: number, today: string): string {
  const startsLater = camp.schedule.startDate > today;
  return translateTemplate(
    startsLater
      ? '{branches} · {tasks} · plan {date} tarihinde başlıyor'
      : '{branches} · {tasks} · plan {date} tarihinde başladı',
    {
      branches: countLabel(branchCount, 'branş'),
      tasks: countLabel(taskCount, 'görev'),
      date: formatLongDate(camp.schedule.startDate),
    },
  );
}

export function CampsView({
  allCamps,
  activeCamp,
  camps,
  index,
  completedMap,
  today,
  isDemo,
  showsAllCamps,
  onAddCamp,
  onStartDemo,
  onSelectCamp,
  onEditTempo,
  onRenameCamp,
  onPublishCamp,
  onDeleteCamp,
  onPauseCamp,
  onResumeCamp,
  publications,
  onUnpublishCamp,
  onViewPublication,
  onAddBranches,
  onEditBranch,
  onAddVideos,
  onEditVideo,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-[920px]">
      <PageHeader
        title={msg("Kamplar")}
        subtitle={plansOverviewSubtitle(allCamps, showsAllCamps)}
        actions={
          allCamps.length > 0 && (
            <button type="button" className={`btn ${isDemo ? 'btn-primary' : 'btn-secondary'}`} onClick={onAddCamp}>
              <Plus aria-hidden="true" />
              {isDemo ? msg("Kendi planını kur") : msg("Yeni kamp")}
            </button>
          )
        }
      />

      {allCamps.length === 0 || !activeCamp ? (
        <NoCampsYet view="camps" onAddCamp={onAddCamp} onStartDemo={onStartDemo} />
      ) : (
        <>
          <ul className="mb-8 grid gap-3 sm:grid-cols-2" aria-label={msg("Kampların")}>
            {allCamps.map(camp => {
              const active = camp.id === activeCamp.id;
              const total = camp.branches.reduce((acc, b) => acc + b.videos.length, 0);
              const done = countCompletedVideos(camp.branches, completedMap);
              const hasVideos = total > 0;
              const imported = isImportedCamp(camp);
              const published = publications?.get(camp.id) ?? null;
              const paused = Boolean(camp.pausedAt);
              const menu: MenuItem[] = [
                { label: 'Adını değiştir', icon: <Pencil aria-hidden="true" />, onSelect: () => onRenameCamp(camp.id) },
                paused
                  ? { label: 'Devam et', icon: <Play aria-hidden="true" />, onSelect: () => onResumeCamp(camp.id) }
                  : { label: 'Kampı duraklat', icon: <Pause aria-hidden="true" />, onSelect: () => onPauseCamp(camp.id) },
                ...(published
                  ? [
                      { label: 'Keşfet’te gör', icon: <Compass aria-hidden="true" />, onSelect: () => onViewPublication(published) },
                      { label: 'Yayını güncelle', icon: <RefreshCw aria-hidden="true" />, onSelect: () => onPublishCamp(camp.id) },
                      { label: 'Yayından kaldır', icon: <CloudOff aria-hidden="true" />, onSelect: () => onUnpublishCamp(published) },
                    ]
                  : // Someone else's camp (added from Keşfet or a link) is not published again under this name.
                    imported
                    ? []
                    : [{ label: 'Keşfet’te yayınla', icon: <Upload aria-hidden="true" />, onSelect: () => onPublishCamp(camp.id) }]),
                { label: 'Kampı sil', icon: <Trash2 aria-hidden="true" />, tone: 'danger', separated: true, onSelect: () => onDeleteCamp(camp.id) },
              ];
              const origin = published ? null : camp.origin === 'kesfet' ? 'Keşfet’ten eklendi' : camp.origin === 'link' ? 'Paylaşım linkinden eklendi' : null;
              return (
                <li
                  key={camp.id}
                  className={`card relative flex flex-col p-4 transition-colors sm:p-5 ${active ? 'ring-2 ring-forest/60' : 'hover:border-line-strong hover:bg-sunk/40'}`}
                >
                  <div className="flex items-start gap-2">
                    <h2 className="font-display min-w-0 flex-1 text-[20px] leading-tight break-words text-ink">
                      {active ? (
                        camp.name
                      ) : (
                        // The whole card opens the camp; the buttons inside sit above this.
                        <button
                          type="button"
                          className="text-left after:absolute after:inset-0 after:rounded-[14px] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-forest"
                          onClick={() => onSelectCamp(camp.id)}
                          aria-label={translateTemplate(showsAllCamps ? '{name}: bu kampı yönet' : '{name}: bu kampa geç', { name: camp.name })}
                        >
                          {camp.name}
                        </button>
                      )}
                    </h2>
                    {paused && <span className="chip mt-0.5 shrink-0">{msg("Duraklatıldı")}</span>}
                    {active && <span className="chip chip-forest mt-0.5 shrink-0">{showsAllCamps ? msg("Seçili") : msg("Açık kamp")}</span>}
                    <Menu label={translateTemplate('{name}: kamp seçenekleri', { name: camp.name })} items={menu} className="relative z-10 -mt-1.5 -mr-2 shrink-0" />
                  </div>
                  <p className="tnum mt-1 text-[12.5px] text-ink-3">
                    {translateTemplate('{branches} · {videos} · başlangıç {date}', {
                      branches: countLabel(camp.branches.length, 'branş'),
                      videos: countLabel(total, 'video'),
                      date: formatShortDate(camp.schedule.startDate),
                    })}
                    {camp.schedule.targetEndDate && ` ${translateTemplate('· hedef {date}', { date: formatShortDate(camp.schedule.targetEndDate) })}`}
                  </p>
                  <p className="mt-1.5 text-[13px] text-ink-2">{localizedTempoSummary(camp.schedule)}</p>
                  {!paused && showsAllCamps && !hasVideos && (
                    <p className="mt-1.5 text-[12.5px] text-ink-3">{msg("Henüz video yok; branş eklenince planına katılır.")}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1">
                      <Meter value={done} max={total} label={translateTemplate('{subject} ilerlemesi', { subject: camp.name })} />
                    </div>
                    <span className="tnum text-[12.5px] font-semibold text-ink-2">
                      {done}{msg("/")}{total}
                    </span>
                  </div>
                  {camp.pausedAt && (
                    <div className="relative z-10 mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[10px] bg-sunk px-3 py-2.5">
                      <p className="min-w-0 flex-1 text-[12.5px] text-ink-2">
                        {formatShortDate(camp.pausedAt)} {msg(" tarihinden beri duraklatıldı; Rotam’da görünmüyor.\n                      ")}</p>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onResumeCamp(camp.id)}>
                        <Play aria-hidden="true" />
                        {msg("\n                        Devam et\n                      ")}</button>
                    </div>
                  )}
                  {(published || origin) && (
                    <p className="mt-3 text-[12.5px] text-ink-3">
                      {published ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-forest">
                          <Globe className="size-3.5" aria-hidden="true" />
                          {msg("\n                          Keşfet’te yayında\n                        ")}</span>
                      ) : (
                        msg(origin ?? '')
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <PageHeader
            eyebrow={`${msg(showsAllCamps ? 'Seçili kamp' : 'Açık kamp')}${activeCamp.pausedAt ? ` · ${msg('Duraklatıldı')}` : ''}`}
            title={translateTemplate('{name} branşları', { name: activeCamp.name })}
            subtitle={activeCampSubtitle(activeCamp, camps.length, index.items.length, today)}
            actions={
              <>
                <button type="button" className="btn btn-secondary" onClick={onEditTempo}>
                  <Gauge aria-hidden="true" />
                  {msg("\n                  Tempoyu düzenle\n                ")}</button>
                <button type="button" className="btn btn-primary" onClick={onAddBranches}>
                  <Plus aria-hidden="true" />
                  {msg("\n                  Branş ekle\n                ")}</button>
              </>
            }
          />
          {camps.length === 0 && (
            <div className="card px-6 py-10 text-center">
              <p className="font-display text-[19px] text-ink">{msg("Bu kampta branş yok")}</p>
              <p className="mt-1 text-[14px] text-ink-2">{msg("Bir oynatma listesi ekleyerek başla; her liste bir branş olur.")}</p>
            </div>
          )}
        <div className="space-y-4">
          {camps.map(info => {
            const { camp, kind, color, channel } = info;
            const progress = campProgress(camp.id, index);
            const isOpen = expanded.has(camp.id);
            const listId = `camp-videos-${camp.id}`;
            return (
              <article key={camp.id} className="card overflow-hidden" aria-labelledby={`camp-title-${camp.id}`}>
                <div className="flex gap-4 px-5 pt-5 pb-4">
                  <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: color.solid }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 id={`camp-title-${camp.id}`} className="font-display min-w-0 text-[21px] leading-tight break-words" style={{ color: color.solid }}>
                        {camp.subject}
                      </h3>
                      <KindBadge kind={kind} />
                    </div>
                    <p className="tnum mt-1 text-[13px] text-ink-2">
                      <span className="font-semibold text-ink">{camp.title}</span>
                      {channel && <> {msg(" · ")}{channel}</>} {msg(" · ")}{camp.videos.length} {msg(" video · ")}{formatMinutes(totalMinutesOf(camp.videos))}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1">
                        <Meter value={progress.done} max={progress.total} label={`${camp.subject} ilerlemesi`} color={color.solid} />
                      </div>
                      <span className="tnum text-[13px] font-semibold text-ink-2">
                        {progress.done}{msg("/")}{progress.total}
                      </span>
                    </div>
                    <p className="tnum mt-2 text-[12.5px] text-ink-3">
                      {progress.nextDate
                        ? `Sıradaki: ${compactDayLabel(progress.nextDate, today)} · Bitiş: ${progress.finishDate ? formatShortDate(progress.finishDate) : '—'} · ${formatMinutes(progress.remainingMinutes)} kaldı`
                        : progress.total > 0
                          ? msg("Tüm videolar tamamlandı.")
                          : msg("Bu branşta video yok.")}
                    </p>
                  </div>
                </div>

                {isLegacyKind(kind) && (
                  <div className="mx-5 mb-4 callout callout-warn">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
                    <div className="text-[13px] text-ink-2">
                      <p className="font-semibold text-ink">{LEGACY_TEXT[kind as 'legacy-sample' | 'legacy-generated'].title}</p>
                      <p className="mt-0.5">{LEGACY_TEXT[kind as 'legacy-sample' | 'legacy-generated'].body}</p>
                    </div>
                  </div>
                )}
                {kind === 'demo-template' && (
                  <p className="mx-5 mb-4 rounded-[10px] border border-dashed border-line-strong px-3 py-2 text-[12.5px] text-ink-2">
                    {msg("\n                    Demo şablon: örnek konu sırası ve sabit örnek süreler; video bağlantısı yok. Konulara kendi videolarının\n                    bağlantısını ekleyebilirsin.\n                  ")}</p>
                )}

                <div className="flex flex-wrap items-center gap-1.5 border-t border-line bg-paper/50 px-3 py-2 sm:px-4">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => toggle(camp.id)}
                    aria-expanded={isOpen}
                    aria-controls={listId}
                  >
                    <ListVideo aria-hidden="true" />
                    {msg("\n                    Videolar\n                    ")}<ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAddVideos(camp.id)}>
                    <Plus aria-hidden="true" />
                    {msg("\n                    Video ekle\n                  ")}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEditBranch(camp.id)}>
                    <Pencil aria-hidden="true" />
                    {msg("\n                    Düzenle\n                  ")}</button>
                </div>

                {isOpen && (
                  <ol id={listId} className="border-t border-line" aria-label={translateTemplate('{subject} videoları', { subject: camp.subject })}>
                    {camp.videos.length === 0 && <li className="px-5 py-4 text-[13px] text-ink-3">{msg("Video yok.")}</li>}
                    {camp.videos.map((video, i) => {
                      const done = completedMap[video.id] === true;
                      const link = linkStateOf(video.videoUrl, kind);
                      return (
                        <li key={video.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0 sm:px-5">
                          <span className="tnum w-6 shrink-0 text-right text-[12px] text-ink-3">{i + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[14px] leading-snug break-words ${done ? 'text-ink-3 line-through' : 'text-ink'}`}>
                              {video.title}
                            </span>
                            <span className="tnum block text-[12px] text-ink-3">
                              {formatMinutes(video.durationMinutes)}
                              {video.channelName && video.channelName !== camp.channelName && ` · ${video.channelName}`}
                              {done && <span className="font-semibold text-forest"> {msg(" · Tamamlandı")}</span>}
                              {link === 'sample' && <span className="text-warn"> {msg(" · bağlantı çalışmıyor")}</span>}
                              {link === 'none' && msg(" · bağlantı yok")}
                            </span>
                          </span>
                          {link === 'video' && (
                            <a
                              href={video.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="icon-btn size-9"
                              aria-label={translateTemplate('{title} videosunu YouTube’da aç (yeni sekme)', { title: video.title })}
                            >
                              <Play aria-hidden="true" />
                            </a>
                          )}
                          {link === 'playlist-only' && (
                            <a
                              href={video.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="icon-btn size-9"
                              aria-label={translateTemplate('{title}: oynatma listesini aç (yeni sekme)', { title: video.title })}
                            >
                              <ExternalLink aria-hidden="true" />
                            </a>
                          )}
                          <button
                            type="button"
                            className="icon-btn size-9"
                            onClick={() => onEditVideo(camp.id, video.id)}
                            aria-label={translateTemplate('{title} videosunu düzenle', { title: video.title })}
                          >
                            <Pencil aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </article>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
