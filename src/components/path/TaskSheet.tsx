import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Check, CircleCheck, ExternalLink, Link2, NotebookPen, Play, TriangleAlert, Undo2 } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import { linkStateOf } from '../../lib/camps';
import type { PathStop, StopState } from '../../lib/dayPath';
import { formatClock, formatMinutes } from '../../lib/format';
import type { CampInfo } from '../../lib/planView';
import { KindBadge, SubjectDot } from '../ui/Bits';
import { Dialog } from '../ui/Dialog';

interface Props {
  /** The open stop; null when the sheet is closed. */
  stop: PathStop | null;
  /** Place of the stop on the day's path (0-based), and how many stops there are. */
  index: number;
  total: number;
  info: CampInfo | undefined;
  /** "Tüm Kamplar": the task's camp. */
  campName?: string;
  oversized: boolean;
  onToggle: (item: DailyPlanItem, done: boolean) => void;
  onEditLink: (item: DailyPlanItem) => void;
  onClose: () => void;
}

const STATE_LABEL: Record<StopState, { text: string; className: string }> = {
  done: { text: 'Tamamlandı', className: 'text-forest' },
  next: { text: 'Sıradaki', className: 'text-ink' },
  open: { text: 'Planlandı', className: 'text-ink' },
  missed: { text: 'Yetişmedi', className: 'text-danger' },
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words text-ink">{children}</dd>
    </div>
  );
}

/** What the sheet shows of one task: the video (or topic), what to open, and its details. */
function TaskDetails({
  stop,
  info,
  campName,
  oversized,
  onEditLink,
}: Pick<Props, 'info' | 'campName' | 'oversized' | 'onEditLink'> & { stop: PathStop }) {
  const { item, state } = stop;
  const [brokenThumbnail, setBrokenThumbnail] = useState(false);
  const video = info?.camp.videos.find(v => v.id === item.videoId);
  const order = info && video ? info.camp.videos.indexOf(video) : -1;
  const linkState = linkStateOf(item.videoUrl, info?.kind ?? 'manual');
  const thumbnail = linkState === 'video' && !brokenThumbnail ? video?.thumbnailUrl : '';
  const color = info?.color.solid ?? 'var(--color-ink-3)';
  const channel = info?.kind === 'manual' ? video?.channelName?.trim() || info.channel : null;
  const length = linkState === 'video' ? formatClock(item.durationMinutes * 60) : formatMinutes(item.durationMinutes);
  const differs = Math.abs(item.effectiveMinutes - item.durationMinutes) >= 1;
  const art = (
    <span
      className="sheet-art"
      style={{ ['--branch' as string]: color, ['--branch-soft' as string]: info?.color.soft ?? 'var(--color-sunk)' } as CSSProperties}
    >
      {linkState !== 'video' && <NotebookPen strokeWidth={1.75} />}
    </span>
  );

  return (
    <>
      {linkState === 'video' ? (
        // The picture repeats the "YouTube’da izle" link below for the pointer; screen readers get the link once.
        <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="sheet-media" tabIndex={-1} aria-hidden="true">
          {thumbnail ? <img src={thumbnail} alt="" referrerPolicy="no-referrer" onError={() => setBrokenThumbnail(true)} /> : art}
          <span className="sheet-play">
            <Play fill="currentColor" />
          </span>
          <span className="sheet-duration tnum">{length}</span>
        </a>
      ) : (
        <div className="sheet-media" aria-hidden="true">
          {art}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {linkState === 'video' && (
          <a
            href={item.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary flex-1"
            aria-label={`${item.title} videosunu YouTube’da izle (yeni sekme)`}
          >
            <Play aria-hidden="true" />
            YouTube’da izle
            <ExternalLink className="text-ink-3" aria-hidden="true" />
          </a>
        )}
        {linkState === 'playlist-only' && (
          <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary flex-1">
            <ExternalLink aria-hidden="true" />
            Oynatma listesini aç
          </a>
        )}
        {(linkState === 'none' || linkState === 'sample') && (
          <button type="button" className="btn btn-secondary flex-1" onClick={() => onEditLink(item)}>
            <Link2 aria-hidden="true" />
            Video bağlantısı ekle
          </button>
        )}
      </div>

      {linkState === 'sample' && (
        <p className="callout callout-warn mt-4 text-[13.5px] text-ink-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <span>Bu görevin bağlantısı eski sürümün örnek verisi ve çalışmıyor. Gerçek videoyu biliyorsan ekleyebilirsin.</span>
        </p>
      )}

      <dl className="mt-6 space-y-3 border-t border-line pt-5 text-[14px]">
        <Fact label="Durum">
          <span className={STATE_LABEL[state].className}>{STATE_LABEL[state].text}</span>
        </Fact>
        <Fact label={linkState === 'video' ? 'Video süresi' : 'Süre'}>
          <span className="tnum">{length}</span>
        </Fact>
        {differs && (
          <Fact label="Çalışma">
            <span className="tnum">~{formatMinutes(item.effectiveMinutes)}</span>
            <span className="block text-[12.5px] font-normal text-ink-3">izleme hızın ve tekrar payınla</span>
          </Fact>
        )}
        <Fact label="Branş">
          <span className="inline-flex items-center gap-1.5">
            <SubjectDot color={color} />
            {item.subject}
          </span>
          {info && order >= 0 && (
            <span className="tnum block text-[12.5px] font-normal text-ink-3">
              {order + 1}. video · toplam {info.camp.videos.length}
            </span>
          )}
        </Fact>
        {campName && <Fact label="Kamp">{campName}</Fact>}
        {channel && <Fact label="Kanal">{channel}</Fact>}
        {info?.kind === 'manual' && info.camp.title && <Fact label="Kaynak">{info.camp.title}</Fact>}
        {info && info.kind !== 'manual' && (
          <Fact label="Kaynak">
            <KindBadge kind={info.kind} />
          </Fact>
        )}
      </dl>

      {oversized && (
        <p className="callout callout-warn mt-5 text-[13.5px] text-ink-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <span>Bu video günlük çalışma süresinden uzun; tek başına bir güne yerleştirildi.</span>
        </p>
      )}
    </>
  );
}

/**
 * One stop of the day's path, opened from the path: the task, where to watch
 * it and, at the bottom, "İzledim" to tick it off.
 */
export function TaskSheet({ stop, index, total, info, campName, oversized, onToggle, onEditLink, onClose }: Props) {
  const item = stop?.item;
  const color = info?.color.solid ?? 'var(--color-ink-3)';
  return (
    <Dialog
      open={stop !== null}
      onClose={onClose}
      placement="side"
      width={440}
      title={item?.title ?? ''}
      eyebrow={
        item && (
          <span className="flex min-w-0 items-center gap-1.5">
            <SubjectDot color={color} />
            <span className="truncate" style={{ color }}>
              {item.subject}
            </span>
            <span className="tnum shrink-0">
              · Görev {index + 1}/{total}
            </span>
          </span>
        )
      }
      footer={
        item &&
        (item.completed ? (
          <div className="flex w-full items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-forest">
              <CircleCheck className="size-5" aria-hidden="true" />
              İzledin
            </p>
            <button type="button" className="btn btn-secondary" onClick={() => onToggle(item, false)}>
              <Undo2 aria-hidden="true" />
              Geri al
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-lg w-full"
            onClick={() => {
              onToggle(item, true);
              onClose();
            }}
          >
            <Check strokeWidth={2.75} aria-hidden="true" />
            İzledim
          </button>
        ))
      }
    >
      {stop && (
        <TaskDetails key={stop.item.id} stop={stop} info={info} campName={campName} oversized={oversized} onEditLink={onEditLink} />
      )}
    </Dialog>
  );
}
