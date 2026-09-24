import { useId } from 'react';
import { ExternalLink, Link2, Play, TriangleAlert } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import { linkStateOf } from '../../lib/camps';
import { formatMinutes } from '../../lib/format';
import type { CampInfo } from '../../lib/planView';
import { SubjectDot } from '../ui/Bits';

interface Props {
  item: DailyPlanItem;
  camp: CampInfo | undefined;
  oversized: boolean;
  onToggle: (item: DailyPlanItem, done: boolean) => void;
  onEditLink?: (item: DailyPlanItem) => void;
  compact?: boolean;
  /** Extra context shown before the title, e.g. the day in "next up" lists. */
  showCamp?: boolean;
}

export function TaskItem({ item, camp, oversized, onToggle, onEditLink, compact = false, showCamp = true }: Props) {
  const checkId = useId();
  const metaId = useId();
  const color = camp?.color.solid ?? '#5c6970';
  const linkState = linkStateOf(item.videoUrl, camp?.kind ?? 'manual');
  const study = item.effectiveMinutes;
  const differs = Math.abs(study - item.durationMinutes) >= 1;

  return (
    <li
      className={`flex items-start gap-3 border-t border-line first:border-t-0 ${compact ? 'px-3 py-2.5' : 'px-4 py-3.5 sm:px-5'} ${
        item.completed ? 'bg-forest-tint' : ''
      }`}
    >
      <input
        id={checkId}
        type="checkbox"
        className="check mt-[1px]"
        checked={item.completed}
        onChange={event => onToggle(item, event.target.checked)}
        aria-describedby={metaId}
      />
      <div className="min-w-0 flex-1">
        {showCamp && (
          <p className="mb-0.5 flex min-w-0 items-center gap-1.5 text-[12px] font-semibold" style={{ color }}>
            <SubjectDot color={color} />
            <span className="shrink-0">{item.subject}</span>
            {camp && <span className="truncate font-medium text-ink-3">· {camp.camp.title}</span>}
          </p>
        )}
        <label
          htmlFor={checkId}
          className={`block cursor-pointer leading-snug break-words ${compact ? 'text-[14px]' : 'text-[15px]'} font-medium ${
            item.completed ? 'text-ink-3 line-through decoration-ink-3/60' : 'text-ink'
          }`}
        >
          {item.title}
        </label>
        <p id={metaId} className="tnum mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
          <span>
            {formatMinutes(item.durationMinutes)} video
            {differs && <> · ~{formatMinutes(study)} çalışma</>}
          </span>
          {item.completed && <span className="font-semibold text-forest">Tamamlandı</span>}
          {oversized && (
            <span className="chip chip-warn" title="Bu video günlük çalışma süresinden uzun; tek başına bir güne yerleştirildi.">
              <TriangleAlert aria-hidden="true" />
              Günlük süreden uzun
            </span>
          )}
        </p>
      </div>
      <div className="shrink-0 self-center">
        {linkState === 'video' && (
          <a
            href={item.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`btn btn-secondary btn-sm ${compact ? 'px-2.5' : ''}`}
            aria-label={`${item.title} videosunu YouTube’da aç (yeni sekme)`}
          >
            <Play aria-hidden="true" />
            <span className={compact ? 'max-sm:hidden' : ''}>İzle</span>
          </a>
        )}
        {linkState === 'playlist-only' && (
          <a
            href={item.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            aria-label={`${item.title}: bu videonun bağlantısı yok, oynatma listesini aç (yeni sekme)`}
            title="Bu videonun kendi bağlantısı yok; oynatma listesi açılır."
          >
            <ExternalLink aria-hidden="true" />
            <span className="max-sm:hidden">Listeyi aç</span>
          </a>
        )}
        {(linkState === 'none' || linkState === 'sample') &&
          (onEditLink ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-ink-3"
              onClick={() => onEditLink(item)}
              aria-label={`${item.title} için video bağlantısı ekle`}
              title={linkState === 'sample' ? 'Eski örnek bağlantı çalışmıyor; gerçek bağlantıyı ekleyebilirsin.' : undefined}
            >
              <Link2 aria-hidden="true" />
              <span className="max-sm:hidden">Bağlantı ekle</span>
            </button>
          ) : (
            <span className="text-[12px] text-ink-3">Bağlantı yok</span>
          ))}
      </div>
    </li>
  );
}
