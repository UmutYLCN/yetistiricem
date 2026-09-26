import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Link2, ListVideo, PencilLine, Play } from 'lucide-react';
import { resolveColor } from '../../lib/subjects';

export type SourceKind = 'playlist' | 'videos' | 'manual';

// Sketch colours: the subject palette (no data, only the look of a plan).
const INK = resolveColor('ink', '').solid;
const PLUM = resolveColor('plum', '').solid;
const CLAY = resolveColor('clay', '').solid;

const thumb = (color: string) => ({ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 35%, var(--color-field)))` });

function PlayDot({ className = '' }: { className?: string }) {
  return (
    <span className={`absolute top-1/2 left-1/2 grid size-5 -translate-1/2 place-items-center rounded-full bg-ink/90 text-on-fill ${className}`}>
      <Play className="size-2.5 translate-x-px fill-current" strokeWidth={0} />
    </span>
  );
}

/** A YouTube playlist: a stack of lists, the front one with its videos. */
function PlaylistArt() {
  return (
    <>
      <span className="absolute inset-x-[16%] top-[14%] h-[70%] rounded-[9px] border border-line-strong bg-card/60" />
      <span className="absolute inset-x-[12%] top-[20%] h-[70%] rounded-[9px] border border-line-strong bg-card/80" />
      <span className="absolute inset-x-[8%] top-[26%] flex h-[70%] flex-col justify-center gap-1.5 rounded-[9px] border border-line-strong bg-card px-2 shadow-[var(--shadow-pop)]">
        {[INK, PLUM, CLAY].map((color, i) => (
          <span key={color} className="flex items-center gap-1.5">
            <span className="h-3 w-5 shrink-0 rounded-[3px]" style={thumb(color)} />
            <span className="h-1 min-w-0 flex-1 rounded-full bg-line-strong" style={{ maxWidth: `${[62, 46, 54][i]}%` }} />
          </span>
        ))}
      </span>
      <span className="absolute top-[9%] left-[5%] grid size-6 place-items-center rounded-[7px] bg-forest text-on-fill shadow-[0_0_14px_-2px_var(--color-forest)]">
        <ListVideo className="size-3.5" />
      </span>
    </>
  );
}

/** Pasted video links: videos arriving with their durations. */
function VideosArt() {
  return (
    <>
      <span
        className="absolute top-[18%] left-[12%] h-[52%] w-[46%] -rotate-[7deg] rounded-[8px] border border-line-strong shadow-[var(--shadow-pop)] max-sm:hidden"
        style={thumb(PLUM)}
      >
        <PlayDot />
        <span className="tnum absolute right-1 bottom-1 rounded-[4px] bg-paper/85 px-1 text-[8.5px] leading-[13px] font-semibold text-ink">24:10</span>
      </span>
      <span
        className="absolute top-[26%] right-[10%] h-[56%] w-[50%] rotate-[5deg] rounded-[8px] border border-line-strong shadow-[var(--shadow-pop)] max-sm:top-[22%] max-sm:right-[18%] max-sm:w-[64%]"
        style={thumb(INK)}
      >
        <PlayDot />
        <span className="tnum absolute right-1 bottom-1 rounded-[4px] bg-paper/85 px-1 text-[8.5px] leading-[13px] font-semibold text-ink">41:05</span>
      </span>
      <span className="absolute top-[9%] left-[5%] grid size-6 place-items-center rounded-[7px] bg-forest text-on-fill shadow-[0_0_14px_-2px_var(--color-forest)]">
        <Link2 className="size-3.5" />
      </span>
    </>
  );
}

/** Topics typed by hand: a sheet of lines with durations and a pen. */
function ManualArt() {
  return (
    <>
      <span className="absolute inset-x-[14%] top-[14%] flex h-[74%] -rotate-2 flex-col justify-center gap-2 rounded-[9px] border border-line-strong bg-card px-2.5 shadow-[var(--shadow-pop)]">
        {[58, 44, 66].map((width, i) => (
          <span key={width} className="flex items-center gap-1.5">
            <span className={`size-2 shrink-0 rounded-[3px] ${i === 0 ? 'bg-forest' : 'border border-control'}`} />
            <span className="h-1 min-w-0 flex-1 rounded-full bg-line-strong" style={{ maxWidth: `${width}%` }} />
            <span className="tnum ml-auto shrink-0 rounded-full bg-sunk px-1 text-[8px] leading-3 font-semibold whitespace-nowrap text-ink-3 max-sm:hidden">
              {[40, 35, 50][i]} dk
            </span>
          </span>
        ))}
      </span>
      <span className="absolute right-[9%] bottom-[9%] grid size-6 place-items-center rounded-[7px] bg-accent text-on-fill shadow-[0_0_14px_-2px_var(--color-accent)]">
        <PencilLine className="size-3.5" />
      </span>
    </>
  );
}

const OPTIONS: { value: SourceKind; title: string; body: string; art: ReactNode }[] = [
  { value: 'playlist', title: 'Oynatma listesi', body: 'Bir YouTube listesinin videoları, sırasıyla.', art: <PlaylistArt /> },
  { value: 'videos', title: 'Videolar', body: 'Bağlantıları yapıştır; başlık ve süre kendiliğinden gelir.', art: <VideosArt /> },
  { value: 'manual', title: 'Elle ekle', body: 'YouTube dışındaki dersler için konu ve süre yaz.', art: <ManualArt /> },
];

/**
 * The ways to add videos as illustrated cards: a tab list whose panel
 * (`${idBase}-panel`) shows the chosen way. Arrow keys move between them.
 */
export function SourcePicker({ value, onChange, idBase, label }: { value: SourceKind; onChange: (kind: SourceKind) => void; idBase: string; label: string }) {
  const listRef = useRef<HTMLDivElement>(null);

  const move = (event: KeyboardEvent, index: number) => {
    const last = OPTIONS.length - 1;
    const target =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    onChange(OPTIONS[target].value);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[target]?.focus();
  };

  return (
    <div ref={listRef} role="tablist" aria-label={label} className="grid grid-cols-3 gap-2 sm:gap-3">
      {OPTIONS.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={`${idBase}-tab-${option.value}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={event => move(event, index)}
            className="source-card"
          >
            <span className="source-art" aria-hidden="true">
              {option.art}
            </span>
            <span className="px-1">
              <span className="block text-[14px] leading-tight font-semibold text-ink">{option.title}</span>
              <span className="mt-1 block text-[12.5px] leading-snug text-ink-3 max-sm:hidden">{option.body}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
