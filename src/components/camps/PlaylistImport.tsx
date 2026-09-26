import { useId, useState } from 'react';
import type { ClipboardEvent, FormEvent, ReactNode } from 'react';
import { CircleCheck, Download, ExternalLink, ListPlus, ListVideo, LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import type { PlaylistFetch } from '../../hooks/usePlaylistFetch';
import { formatClock, formatMinutes } from '../../lib/format';
import type { ReviewRow } from '../../lib/playlistImport';
import {
  FAILURE_TEXT,
  LINK_PROBLEM_TEXT,
  initialSelection,
  isSelectable,
  reviewPlaylist,
  rowLabel,
  selectedDrafts,
  skippedSummary,
} from '../../lib/playlistImport';
import type { DraftVideo } from '../../utils/youtubeParser';
import { inspectPlaylistLink } from '../../utils/youtubeParser';
import type { PlaylistEntry, PlaylistInfo } from '../../utils/youtubePlaylist';

interface Props {
  fetcher: PlaylistFetch;
  /** YouTube ids already in the branch or the draft list. */
  knownIds: string[];
  onImport: (drafts: DraftVideo[], playlist: PlaylistInfo) => void;
  /** Button text for the selected videos. */
  importLabel?: (count: number) => string;
  /** Empty the field after an import (for adding several lists in a row). */
  clearAfterImport?: boolean;
}

const defaultImportLabel = (count: number) => `Seçilen ${count} videoyu ekle`;

/** Paste a playlist link → fetch → review and select → add to the draft list. */
export function PlaylistImport({ fetcher, knownIds, onImport, importLabel = defaultImportLabel, clearAfterImport = false }: Props) {
  const { link, setLink, state, load, cancel, reset } = fetcher;
  const uid = useId();
  const loading = state.status === 'loading';
  const problem = state.status === 'invalid' ? LINK_PROBLEM_TEXT[state.problem] : null;
  const [imported, setImported] = useState<{ title: string; count: number } | null>(null);

  const handleImport = (drafts: DraftVideo[], playlist: PlaylistInfo) => {
    onImport(drafts, playlist);
    if (!clearAfterImport) return;
    reset();
    setImported({ title: playlist.title || 'Liste', count: drafts.length });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void load(link);
  };

  // Pasting a playlist link into the empty field fetches it right away.
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const replacesAll = input.value === '' || (input.selectionStart === 0 && input.selectionEnd === input.value.length);
    const pasted = event.clipboardData.getData('text').trim();
    if (!replacesAll || !inspectPlaylistLink(pasted).ok) return;
    event.preventDefault();
    setLink(pasted);
    void load(pasted);
  };

  return (
    <div>
      <form onSubmit={submit} noValidate>
        <label className="field-label" htmlFor={`${uid}-link`}>
          YouTube oynatma listesi bağlantısı
        </label>
        <div className="flex gap-2 max-sm:flex-col">
          <input
            id={`${uid}-link`}
            className="input"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://www.youtube.com/playlist?list=…"
            value={link}
            onChange={e => {
              setLink(e.target.value);
              setImported(null);
            }}
            onPaste={handlePaste}
            aria-invalid={problem ? true : undefined}
            aria-describedby={`${uid}-link-${problem ? 'error' : 'hint'}`}
            data-autofocus
          />
          <button type="submit" className="btn btn-secondary shrink-0" disabled={loading}>
            {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            {loading ? 'Getiriliyor…' : 'Listeyi getir'}
          </button>
        </div>
        {problem ? (
          <p id={`${uid}-link-error`} className="field-error">
            {problem}
          </p>
        ) : (
          <p id={`${uid}-link-hint`} className="field-hint">
            Yapıştırınca videolar adları ve gerçek süreleriyle gelir; eklemeden önce seçebilirsin. Herkese açık ve liste dışı
            listeler okunur, gizli listeler okunamaz.
          </p>
        )}
      </form>

      <div role="status" aria-live="polite">
        {imported && !loading && (
          <p className="pop-in mt-3 flex items-center gap-2 rounded-[10px] bg-forest-tint px-3.5 py-2.5 text-[13px] font-semibold text-forest-strong">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              “{imported.title}” eklendi ({imported.count} video). Başka bir liste yapıştırabilirsin.
            </span>
          </p>
        )}
        {loading && <ReviewSkeleton message="Liste YouTube’dan okunuyor… Uzun listelerde birkaç saniye sürebilir." />}
      </div>
      {loading && (
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={cancel}>
          Getirmeyi durdur
        </button>
      )}

      {state.status === 'failed' && (
        <div className="callout callout-warn mt-3" role="alert">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-[13px] text-ink-2">
            <p className="font-semibold text-ink">{FAILURE_TEXT[state.failure].title}</p>
            <p className="mt-0.5">{FAILURE_TEXT[state.failure].body}</p>
            {FAILURE_TEXT[state.failure].retry && (
              <button type="button" className="btn btn-secondary btn-sm mt-2.5" onClick={() => void load(link)}>
                <RotateCcw aria-hidden="true" />
                Tekrar dene
              </button>
            )}
          </div>
        </div>
      )}

      {state.status === 'loaded' && (
        <EntryReview
          key={state.version}
          heading={state.data.playlist.title || 'Adı olmayan liste'}
          meta={
            <>
              {state.data.playlist.channelTitle && <>{state.data.playlist.channelTitle} · </>}
              {state.data.entries.length} video
            </>
          }
          link={{ href: state.data.playlist.url, label: 'Listeyi YouTube’da aç (yeni sekme)' }}
          entries={state.data.entries}
          truncated={state.data.truncated}
          knownIds={knownIds}
          onImport={drafts => handleImport(drafts, state.data.playlist)}
          importLabel={importLabel}
        />
      )}
    </div>
  );
}

/** What stands in for the review while YouTube is being read: the shape of the list on its way. */
export function ReviewSkeleton({ message }: { message: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-[12px] border border-line bg-card">
      <div className="flex items-center gap-3 border-b border-line px-3.5 py-3 text-[13px] text-ink-2">
        <LoaderCircle className="size-4 shrink-0 animate-spin text-forest" aria-hidden="true" />
        <span className="flex-1">{message}</span>
      </div>
      <div aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-line px-3.5 py-2.5 first:border-t-0">
            <span className="skeleton size-[22px] shrink-0 rounded-[7px]" />
            <span className="skeleton h-9 w-16 shrink-0 rounded-[6px] max-[400px]:hidden" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="skeleton block h-2.5 rounded-full" style={{ width: `${[78, 62, 70, 54][i]}%` }} />
              <span className="skeleton block h-2 w-2/5 rounded-full" />
            </span>
            <span className="skeleton h-2.5 w-9 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Videos read from YouTube, to review and select before adding: what can be
 * added, what is skipped and why. Used for a playlist and for pasted links.
 */
export function EntryReview({
  heading,
  meta,
  link,
  entries,
  truncated = false,
  knownIds,
  onImport,
  importLabel,
}: {
  heading: string;
  meta: ReactNode;
  /** Where the source opens on YouTube. */
  link?: { href: string; label: string };
  entries: PlaylistEntry[];
  truncated?: boolean;
  knownIds: string[];
  onImport: (drafts: DraftVideo[]) => void;
  importLabel: (count: number) => string;
}) {
  const uid = useId();
  const rows = reviewPlaylist(entries, knownIds);
  const [selected, setSelected] = useState<Set<number>>(() => initialSelection(rows));
  const [lastImport, setLastImport] = useState<number | null>(null);

  const selectable = rows.filter(isSelectable);
  const chosen = selectedDrafts(rows, selected);
  const chosenMinutes = chosen.reduce((acc, d) => acc + d.durationMinutes, 0);
  const skipped = skippedSummary(rows);

  const toggle = (index: number, on: boolean) =>
    setSelected(current => {
      const next = new Set(current);
      if (on) next.add(index);
      else next.delete(index);
      return next;
    });

  const importSelected = () => {
    if (chosen.length === 0) return;
    onImport(chosen);
    setSelected(new Set());
    setLastImport(chosen.length);
  };

  return (
    <section className="mt-4 overflow-hidden rounded-[12px] border border-line bg-card" aria-labelledby={`${uid}-title`}>
      <header className="flex items-start gap-3 border-b border-line px-3.5 py-3">
        <ListVideo className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 id={`${uid}-title`} className="text-[14.5px] leading-snug font-semibold break-words text-ink">
            {heading}
          </h4>
          <p className="tnum text-[12.5px] text-ink-3">{meta}</p>
        </div>
        {link && (
          <a href={link.href} target="_blank" rel="noopener noreferrer" className="icon-btn -my-1 -mr-1.5 size-9" aria-label={link.label}>
            <ExternalLink aria-hidden="true" />
          </a>
        )}
      </header>

      {truncated && (
        <p className="border-b border-line bg-warn-soft px-3.5 py-2 text-[12.5px] text-warn">
          Liste YouTube’un sınırından uzun; yalnızca ilk {entries.length} kayıt okunabildi.
        </p>
      )}

      {entries.length === 0 ? (
        <p className="px-3.5 py-5 text-center text-[13px] text-ink-2">Okunacak video yok.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 pt-2.5 pb-2">
            <p className="tnum mr-auto text-[13px] text-ink-2">
              <span className="font-semibold text-ink">
                {chosen.length}/{selectable.length} video seçili
              </span>
              {chosen.length > 0 && ` · ${formatMinutes(chosenMinutes)}`}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelected(new Set(selectable.map(r => r.index)))}
                disabled={selectable.length === 0 || chosen.length === selectable.length}
              >
                Tümünü seç
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelected(new Set())}
                disabled={chosen.length === 0}
              >
                Seçimi kaldır
              </button>
            </div>
          </div>
          {skipped && <p className="px-3.5 pb-2 text-[12.5px] text-ink-3">{skipped}</p>}
          <ol className="max-h-[340px] overflow-y-auto overscroll-contain border-t border-line" aria-label={`${heading}: videolar`}>
            {rows.map(row => (
              <ReviewItem key={row.index} row={row} checked={selected.has(row.index)} onToggle={toggle} />
            ))}
          </ol>
        </>
      )}

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-paper/50 px-3.5 py-3">
        <button type="button" className="btn btn-secondary btn-sm" onClick={importSelected} disabled={chosen.length === 0}>
          <ListPlus aria-hidden="true" />
          {chosen.length > 0 ? importLabel(chosen.length) : 'Eklemek için video seç'}
        </button>
        <p role="status" className="text-[12.5px] text-forest">
          {lastImport !== null && (
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <CircleCheck className="size-4" aria-hidden="true" />
              {lastImport} video, sırasıyla aşağıya eklendi.
            </span>
          )}
        </p>
      </footer>
    </section>
  );
}

function ReviewItem({ row, checked, onToggle }: { row: ReviewRow; checked: boolean; onToggle: (index: number, on: boolean) => void }) {
  const uid = useId();
  const selectable = isSelectable(row);
  const label = rowLabel(row);
  const video = row.entry.kind === 'video' ? row.entry : null;
  const title = video ? video.title || `Video ${row.index + 1}` : 'Kullanılamayan video';

  return (
    // The first rows arrive one after another; the rest with the last of them.
    <li className="review-row border-t border-line first:border-t-0" style={{ ['--row' as string]: Math.min(row.index, 16) }}>
      <label
        className={`flex items-center gap-3 px-3.5 py-2 ${selectable ? 'cursor-pointer hover:bg-paper/70' : 'cursor-not-allowed bg-paper/40'}`}
      >
        <input
          type="checkbox"
          className="check"
          checked={selectable && checked}
          disabled={!selectable}
          onChange={e => onToggle(row.index, e.target.checked)}
          aria-describedby={label ? `${uid}-note` : undefined}
        />
        <span className="tnum w-6 shrink-0 text-right text-[12px] text-ink-3">{row.index + 1}</span>
        {video ? (
          <img
            src={video.thumbnailUrl}
            alt=""
            width={64}
            height={36}
            loading="lazy"
            referrerPolicy="no-referrer"
            className={`h-9 w-16 shrink-0 rounded-[6px] bg-sunk object-cover max-[400px]:hidden ${selectable ? '' : 'opacity-60'}`}
          />
        ) : (
          <span className="h-9 w-16 shrink-0 rounded-[6px] bg-sunk max-[400px]:hidden" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span
            className={`line-clamp-2 text-[14px] leading-snug break-words ${selectable ? 'text-ink' : 'text-ink-3'}`}
            title={title}
          >
            {title}
          </span>
          <span className="block text-[12px] text-ink-3">
            {video?.channelTitle && <span className="break-words">{video.channelTitle}</span>}
            {label && (
              <>
                {video?.channelTitle && <span className="max-sm:hidden"> · </span>}
                <span
                  id={`${uid}-note`}
                  className={`font-medium max-sm:block ${row.status === 'in-list' || row.status === 'repeat' ? 'text-ink-2' : 'text-warn'}`}
                >
                  {label}
                </span>
              </>
            )}
          </span>
        </span>
        <span className="tnum shrink-0 text-[13px] text-ink-2">{video ? formatClock(video.durationSeconds) : '—'}</span>
      </label>
    </li>
  );
}
