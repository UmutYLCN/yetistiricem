import { useState } from 'react';
import { ChevronDown, ExternalLink, ListVideo, Pencil, Play, Plus, Trash2, TriangleAlert } from 'lucide-react';
import type { CampInfo, PlanIndex } from '../../lib/planView';
import { campProgress } from '../../lib/planView';
import { isLegacyKind, linkStateOf, totalMinutesOf } from '../../lib/camps';
import { compactDayLabel, formatMinutes, formatShortDate } from '../../lib/format';
import { PageHeader } from '../layout/PageHeader';
import { KindBadge, Meter } from '../ui/Bits';
import { NoCampsYet } from './Welcome';

interface Props {
  camps: CampInfo[];
  index: PlanIndex;
  completedMap: Record<string, boolean>;
  today: string;
  isDemo: boolean;
  onAddCamp: () => void;
  onStartDemo: () => void;
  onEditCamp: (campId: string) => void;
  onAddVideos: (campId: string) => void;
  onEditVideo: (campId: string, videoId: string) => void;
  onRemoveCamp: (campId: string) => void;
}

const LEGACY_TEXT: Record<'legacy-sample' | 'legacy-generated', { title: string; body: string }> = {
  'legacy-sample': {
    title: 'Bu kamp önceki sürümün örnek verisinden oluşturuldu.',
    body: 'Video bağlantıları çalışmayan örnek adreslerdi, süreler rastgele üretilmişti ve gösterilen kanal adı yalnızca örnekti. İlerlemen korunuyor; gerçek videoları biliyorsan her göreve bağlantı ve süre ekleyebilir ya da kampı kaldırabilirsin.',
  },
  'legacy-generated': {
    title: 'Bu kamp oynatma listesi okunmadan oluşturuldu.',
    body: 'Önceki sürüm listeyi okuyamadığı halde 45 dakikalık 20 “Özel Video” ekliyordu; video sayısı, adları ve süreleri gerçek değil. Görevler oynatma listesini açar. Gerçek videoları tek tek düzenleyebilir ya da kampı kaldırıp videolarınla yeniden oluşturabilirsin.',
  },
};

export function CampsView({
  camps,
  index,
  completedMap,
  today,
  isDemo,
  onAddCamp,
  onStartDemo,
  onEditCamp,
  onAddVideos,
  onEditVideo,
  onRemoveCamp,
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
        subtitle={camps.length > 0 ? `${camps.length} kamp · ${index.items.length} görev` : undefined}
        actions={
          camps.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={onAddCamp}>
              <Plus aria-hidden="true" />
              {isDemo ? 'Kendi planını kur' : 'Kamp ekle'}
            </button>
          )
        }
      />

      {camps.length === 0 ? (
        <NoCampsYet onAddCamp={onAddCamp} onStartDemo={onStartDemo} />
      ) : (
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
                      <h2 id={`camp-title-${camp.id}`} className="font-display min-w-0 text-[21px] leading-tight break-words text-ink">
                        {camp.title}
                      </h2>
                      <KindBadge kind={kind} />
                    </div>
                    <p className="tnum mt-1 text-[13px] text-ink-2">
                      <span className="font-semibold" style={{ color: color.solid }}>
                        {camp.subject}
                      </span>
                      {channel && <> · {channel}</>} · {camp.videos.length} video · {formatMinutes(totalMinutesOf(camp.videos))}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1">
                        <Meter value={progress.done} max={progress.total} label={`${camp.title} ilerlemesi`} color={color.solid} />
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
                          : 'Bu kampta video yok.'}
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
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEditCamp(camp.id)}>
                    <Pencil aria-hidden="true" />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm ml-auto text-danger hover:bg-danger-soft"
                    onClick={() => onRemoveCamp(camp.id)}
                  >
                    <Trash2 aria-hidden="true" />
                    Kaldır
                  </button>
                </div>

                {isOpen && (
                  <ol id={listId} className="border-t border-line" aria-label={`${camp.title} videoları`}>
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
      )}
    </div>
  );
}
