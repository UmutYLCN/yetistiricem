import { useId } from 'react';
import { ExternalLink, Flame, Link2, Play, TriangleAlert } from 'lucide-react';
import type { DailyPlanItem } from '../../types';
import { linkStateOf } from '../../lib/camps';
import { formatMinutes } from '../../lib/format';
import { criticalLabel, isCriticallyPostponed } from '../../lib/postpone';
import type { CampInfo } from '../../lib/planView';
import { SubjectDot } from '../ui/Bits';
import { msg } from '../../lib/messages';


interface Props {
  item: DailyPlanItem;
  camp: CampInfo | undefined;
  oversized: boolean;
  onToggle: (item: DailyPlanItem, done: boolean) => void;
  onEditLink?: (item: DailyPlanItem) => void;
  /** Plays the video in focus mode; without it "İzle" opens YouTube. */
  onFocus?: (item: DailyPlanItem) => void;
  compact?: boolean;
  /** Extra context shown before the title, e.g. the day in "next up" lists. */
  showCamp?: boolean;
  /** Listed under its camp's heading: the label shows the branch only (the camp name is for screen readers). */
  campName?: string;
}

export function TaskItem({ item, camp, oversized, onToggle, onEditLink, onFocus, compact = false, showCamp = true, campName }: Props) {
  const checkId = useId();
  const metaId = useId();
  const color = camp?.color.solid ?? 'var(--color-ink-3)';
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
        {showCamp &&
          (campName ? (
            // Under the camp's heading: the branch only, wrapping under the dot on narrow screens.
            <p className="mb-0.5 flex min-w-0 items-start gap-1.5 text-[12px] font-semibold">
              <SubjectDot color={color} className="mt-[5px]" />
              <span className="min-w-0 break-words" style={{ color }}>
                <span className="sr-only">{campName} {msg(" · ")}</span>
                {item.subject}
              </span>
            </p>
          ) : (
            <p className="mb-0.5 flex min-w-0 items-center gap-1.5 text-[12px] font-semibold" style={{ color }}>
              <SubjectDot color={color} />
              <span className="shrink-0">{item.subject}</span>
              {camp && <span className="truncate font-medium text-ink-3">{msg("· ")}{camp.camp.title}</span>}
            </p>
          ))}
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
            {formatMinutes(item.durationMinutes)} {msg(" video\n            ")}{differs && <> {msg(" · ~")}{formatMinutes(study)} {msg(" çalışma")}</>}
          </span>
          {item.completed && <span className="font-semibold text-forest">{msg("Tamamlandı")}</span>}
          {oversized && (
            <span className="chip chip-warn" title={msg("Bu video günlük çalışma süresinden uzun; tek başına bir güne yerleştirildi.")}>
              <TriangleAlert aria-hidden="true" />
              {msg("\n              Günlük süreden uzun\n            ")}</span>
          )}
          {isCriticallyPostponed(item) && (
            <span className="chip chip-danger" title={msg("Bu görev defalarca ileri taşındı. Bugün ilk iş olarak ele almayı dene.")}>
              <Flame aria-hidden="true" />
              {criticalLabel(item.postponeCount ?? 0)}
            </span>
          )}
        </p>
      </div>
      <div className="shrink-0 self-center">
        {linkState === 'video' && onFocus && (
          <button
            type="button"
            className={`btn btn-secondary btn-sm ${compact ? 'px-2.5' : ''}`}
            onClick={() => onFocus(item)}
            aria-label={`${item.title} videosunu odak modunda izle`}
            aria-haspopup="dialog"
          >
            <Play aria-hidden="true" />
            <span className={compact ? 'max-sm:hidden' : ''}>{msg("Odaklan")}</span>
          </button>
        )}
        {linkState === 'video' && !onFocus && (
          <a
            href={item.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`btn btn-secondary btn-sm ${compact ? 'px-2.5' : ''}`}
            aria-label={`${item.title} videosunu YouTube’da aç (yeni sekme)`}
          >
            <Play aria-hidden="true" />
            <span className={compact ? 'max-sm:hidden' : ''}>{msg("İzle")}</span>
          </a>
        )}
        {linkState === 'playlist-only' && (
          <a
            href={item.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            aria-label={`${item.title}: bu videonun bağlantısı yok, oynatma listesini aç (yeni sekme)`}
            title={msg("Bu videonun kendi bağlantısı yok; oynatma listesi açılır.")}
          >
            <ExternalLink aria-hidden="true" />
            <span className="max-sm:hidden">{msg("Listeyi aç")}</span>
          </a>
        )}
        {(linkState === 'none' || linkState === 'sample') &&
          (onEditLink ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-ink-3"
              onClick={() => onEditLink(item)}
              aria-label={`${item.title} için video bağlantısı ekle`}
              title={linkState === 'sample' ? msg("Eski örnek bağlantı çalışmıyor; gerçek bağlantıyı ekleyebilirsin.") : undefined}
            >
              <Link2 aria-hidden="true" />
              <span className="max-sm:hidden">{msg("Bağlantı ekle")}</span>
            </button>
          ) : (
            <span className="text-[12px] text-ink-3">{msg("Bağlantı yok")}</span>
          ))}
      </div>
    </li>
  );
}
