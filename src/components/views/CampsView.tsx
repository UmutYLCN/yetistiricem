import { useState } from 'react';
import { ArrowRightLeft, ChevronDown, ExternalLink, Gauge, ListVideo, Pencil, Play, Plus, Trash2, TriangleAlert } from 'lucide-react';
import type { StudyCamp } from '../../types';
import type { CampInfo, PlanIndex } from '../../lib/planView';
import { campProgress, tempoSummary } from '../../lib/planView';
import { isLegacyKind, linkStateOf, totalMinutesOf } from '../../lib/camps';
import { countCompletedVideos } from '../../lib/engine';
import { compactDayLabel, formatLongDate, formatMinutes, formatShortDate } from '../../lib/format';
import { PageHeader } from '../layout/PageHeader';
import { KindBadge, Meter } from '../ui/Bits';
import { NoCampsYet } from './Welcome';

interface Props {
  allCamps: StudyCamp[];
  activeCamp: StudyCamp | null;
  /** The active camp's branches. */
  camps: CampInfo[];
  index: PlanIndex;
  completedMap: Record<string, boolean>;
  today: string;
  isDemo: boolean;
  onAddCamp: () => void;
  onStartDemo: () => void;
  onSelectCamp: (campId: string) => void;
  onEditTempo: () => void;
  onRenameCamp: (campId: string) => void;
  onDeleteCamp: (campId: string) => void;
  onAddBranches: () => void;
  onEditBranch: (campId: string) => void;
  onAddVideos: (campId: string) => void;
  onEditVideo: (campId: string, videoId: string) => void;
  onRemoveBranch: (campId: string) => void;
}

const LEGACY_TEXT: Record<'legacy-sample' | 'legacy-generated', { title: string; body: string }> = {
  'legacy-sample': {
    title: 'Bu branş önceki sürümün örnek verisinden oluşturuldu.',
    body: 'Video bağlantıları çalışmayan örnek adreslerdi, süreler rastgele üretilmişti ve gösterilen kanal adı yalnızca örnekti. İlerlemen korunuyor; gerçek videoları biliyorsan her göreve bağlantı ve süre ekleyebilir ya da branşı kaldırabilirsin.',
  },
  'legacy-generated': {
    title: 'Bu branş oynatma listesi okunmadan oluşturuldu.',
    body: 'Önceki sürüm listeyi okuyamadığı halde 45 dakikalık 20 “Özel Video” ekliyordu; video sayısı, adları ve süreleri gerçek değil. Görevler oynatma listesini açar. Gerçek videoları tek tek düzenleyebilir ya da branşı kaldırıp videolarınla yeniden ekleyebilirsin.',
  },
};

export function CampsView({
  allCamps,
  activeCamp,
  camps,
  index,
  completedMap,
  today,
  isDemo,
  onAddCamp,
  onStartDemo,
  onSelectCamp,
  onEditTempo,
  onRenameCamp,
  onDeleteCamp,
  onAddBranches,
  onEditBranch,
  onAddVideos,
  onEditVideo,
  onRemoveBranch,
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
        title="Kamplar"
        subtitle={allCamps.length > 0 ? `${allCamps.length} kamp · her birinin kendi branşları ve temposu var` : undefined}
        actions={
          allCamps.length > 0 && (
            <button type="button" className={`btn ${isDemo ? 'btn-primary' : 'btn-secondary'}`} onClick={onAddCamp}>
              <Plus aria-hidden="true" />
              {isDemo ? 'Kendi planını kur' : 'Yeni kamp'}
            </button>
          )
        }
      />

      {allCamps.length === 0 || !activeCamp ? (
        <NoCampsYet onAddCamp={onAddCamp} onStartDemo={onStartDemo} />
      ) : (
        <>
          <ul className="mb-8 grid gap-3 sm:grid-cols-2" aria-label="Kampların">
            {allCamps.map(camp => {
              const active = camp.id === activeCamp.id;
              const total = camp.branches.reduce((acc, b) => acc + b.videos.length, 0);
              const done = countCompletedVideos(camp.branches, completedMap);
              return (
                <li key={camp.id} className={`card flex flex-col p-4 sm:p-5 ${active ? 'ring-2 ring-forest/60' : ''}`}>
                  <div className="flex items-start gap-2">
                    <h2 className="font-display min-w-0 flex-1 text-[20px] leading-tight break-words text-ink">{camp.name}</h2>
                    {active && <span className="chip chip-forest shrink-0">Açık kamp</span>}
                  </div>
                  <p className="tnum mt-1 text-[12.5px] text-ink-3">
                    {camp.branches.length} branş · {total} video · başlangıç {formatShortDate(camp.schedule.startDate)}
                    {camp.schedule.targetEndDate && ` · hedef ${formatShortDate(camp.schedule.targetEndDate)}`}
                  </p>
                  <p className="mt-1.5 text-[13px] text-ink-2">{tempoSummary(camp.schedule)}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1">
                      <Meter value={done} max={total} label={`${camp.name} ilerlemesi`} />
                    </div>
                    <span className="tnum text-[12.5px] font-semibold text-ink-2">
                      {done}/{total}
                    </span>
                  </div>
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    {!active && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelectCamp(camp.id)}>
                        <ArrowRightLeft aria-hidden="true" />
                        Bu kampa geç
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRenameCamp(camp.id)}>
                      <Pencil aria-hidden="true" />
                      Adını değiştir
                    </button>
                    <button
                      type="button"
                      className="icon-btn ml-auto size-9 hover:text-danger"
                      onClick={() => onDeleteCamp(camp.id)}
                      aria-label={`Kampı sil: ${camp.name}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <PageHeader
            eyebrow="Açık kamp"
            title={`${activeCamp.name} branşları`}
            subtitle={`${camps.length} branş · ${index.items.length} görev · plan ${formatLongDate(activeCamp.schedule.startDate)} tarihinde ${activeCamp.schedule.startDate > today ? 'başlıyor' : 'başladı'}`}
            actions={
              <>
                <button type="button" className="btn btn-secondary" onClick={onEditTempo}>
                  <Gauge aria-hidden="true" />
                  Tempoyu düzenle
                </button>
                <button type="button" className="btn btn-primary" onClick={onAddBranches}>
                  <Plus aria-hidden="true" />
                  Branş ekle
                </button>
              </>
            }
          />
          {camps.length === 0 && (
            <div className="card px-6 py-10 text-center">
              <p className="font-display text-[19px] text-ink">Bu kampta branş yok</p>
              <p className="mt-1 text-[14px] text-ink-2">Bir oynatma listesi ekleyerek başla; her liste bir branş olur.</p>
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
                      {channel && <> · {channel}</>} · {camp.videos.length} video · {formatMinutes(totalMinutesOf(camp.videos))}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1">
                        <Meter value={progress.done} max={progress.total} label={`${camp.subject} ilerlemesi`} color={color.solid} />
                      </div>
                      <span className="tnum text-[13px] font-semibold text-ink-2">
                        {progress.done}/{progress.total}
                      </span>
                    </div>
                    <p className="tnum mt-2 text-[12.5px] text-ink-3">
                      {progress.nextDate
                        ? `Sıradaki: ${compactDayLabel(progress.nextDate, today)} · Bitiş: ${progress.finishDate ? formatShortDate(progress.finishDate) : '—'} · ${formatMinutes(progress.remainingMinutes)} kaldı`
                        : progress.total > 0
                          ? 'Tüm videolar tamamlandı.'
                          : 'Bu branşta video yok.'}
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
                    Demo şablon: örnek konu sırası ve sabit örnek süreler; video bağlantısı yok. Konulara kendi videolarının
                    bağlantısını ekleyebilirsin.
                  </p>
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
                    Videolar
                    <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAddVideos(camp.id)}>
                    <Plus aria-hidden="true" />
                    Video ekle
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEditBranch(camp.id)}>
                    <Pencil aria-hidden="true" />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm ml-auto text-danger hover:bg-danger-soft"
                    onClick={() => onRemoveBranch(camp.id)}
                  >
                    <Trash2 aria-hidden="true" />
                    Kaldır
                  </button>
                </div>

                {isOpen && (
                  <ol id={listId} className="border-t border-line" aria-label={`${camp.subject} videoları`}>
                    {camp.videos.length === 0 && <li className="px-5 py-4 text-[13px] text-ink-3">Video yok.</li>}
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
                              {done && <span className="font-semibold text-forest"> · Tamamlandı</span>}
                              {link === 'sample' && <span className="text-warn"> · bağlantı çalışmıyor</span>}
                              {link === 'none' && ' · bağlantı yok'}
                            </span>
                          </span>
                          {link === 'video' && (
                            <a
                              href={video.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="icon-btn size-9"
                              aria-label={`${video.title} videosunu YouTube’da aç (yeni sekme)`}
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
                              aria-label={`${video.title}: oynatma listesini aç (yeni sekme)`}
                            >
                              <ExternalLink aria-hidden="true" />
                            </a>
                          )}
                          <button
                            type="button"
                            className="icon-btn size-9"
                            onClick={() => onEditVideo(camp.id, video.id)}
                            aria-label={`${video.title} videosunu düzenle`}
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
