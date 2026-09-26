import { useId, useState } from 'react';
import type { ClipboardEvent, FormEvent } from 'react';
import { CircleCheck, Download, ListVideo, LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import { useVideosFetch } from '../../hooks/useVideosFetch';
import { VIDEO_FAILURE_TEXT } from '../../lib/playlistImport';
import type { DraftVideo } from '../../utils/youtubeParser';
import { parseVideoLinks } from '../../utils/youtubeParser';
import { EntryReview, ReviewSkeleton } from './PlaylistImport';

interface Props {
  /** YouTube ids already in the branch or the draft list. */
  knownIds: string[];
  onImport: (drafts: DraftVideo[]) => void;
  /** Button text for the selected videos. */
  importLabel?: (count: number) => string;
  /** A playlist link was pasted: offer to read it as a list instead. */
  onOpenPlaylist?: (link: string) => void;
}

const defaultImportLabel = (count: number) => `${count} videoyu ekle`;

/**
 * Paste video links → titles, channels and durations come from YouTube →
 * review and select → add. Nothing is typed by hand.
 */
export function VideoLinksImport({ knownIds, onImport, importLabel = defaultImportLabel, onOpenPlaylist }: Props) {
  const uid = useId();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState<string[]>([]);
  const [playlistLink, setPlaylistLink] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const { state, load, reset } = useVideosFetch();
  const loading = state.status === 'loading';

  const read = (value: string) => {
    const links = parseVideoLinks(value);
    setUnreadable(links.unreadable);
    setPlaylistLink(links.playlists[0] ?? null);
    setImported(null);
    if (links.ids.length === 0) {
      reset();
      setProblem(
        links.playlists.length > 0
          ? 'Bu bir oynatma listesinin bağlantısı; içinde tek video bağlantısı yok.'
          : 'YouTube video bağlantısı bulunamadı. Örnek: https://youtu.be/…'
      );
      return;
    }
    setProblem(null);
    void load(links.ids);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    read(text);
  };

  // Pasting links into the empty field reads them right away.
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const area = event.currentTarget;
    const replacesAll = area.value === '' || (area.selectionStart === 0 && area.selectionEnd === area.value.length);
    const pasted = event.clipboardData.getData('text');
    if (!replacesAll || parseVideoLinks(pasted).ids.length === 0) return;
    event.preventDefault();
    setText(pasted.trim());
    read(pasted);
  };

  const handleImport = (drafts: DraftVideo[]) => {
    onImport(drafts);
    reset();
    setText('');
    setUnreadable([]);
    setPlaylistLink(null);
    setImported(drafts.length);
  };

  const found = state.status === 'loaded' ? state.entries.filter(entry => entry.kind === 'video').length : 0;

  return (
    <div>
      <form onSubmit={submit} noValidate>
        <label className="field-label" htmlFor={`${uid}-links`}>
          YouTube video bağlantıları
        </label>
        <textarea
          id={`${uid}-links`}
          className="input font-mono text-[13px]"
          rows={3}
          spellCheck={false}
          autoComplete="off"
          placeholder={'https://youtu.be/…\nhttps://www.youtube.com/watch?v=…'}
          value={text}
          onChange={e => {
            setText(e.target.value);
            setProblem(null);
            setImported(null);
          }}
          onPaste={handlePaste}
          aria-invalid={problem ? true : undefined}
          aria-describedby={`${uid}-links-${problem ? 'error' : 'hint'}`}
        />
        {problem ? (
          <p id={`${uid}-links-error`} className="field-error">
            {problem}
          </p>
        ) : (
          <p id={`${uid}-links-hint`} className="field-hint">
            Her satıra bir bağlantı. Başlık, kanal ve süre YouTube’dan gelir; eklemeden önce seçebilirsin.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="btn btn-secondary btn-sm" disabled={loading || !text.trim()}>
            {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            {loading ? 'Getiriliyor…' : 'Videoları getir'}
          </button>
          {playlistLink && onOpenPlaylist && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenPlaylist(playlistLink)}>
              <ListVideo aria-hidden="true" />
              Oynatma listesi olarak aç
            </button>
          )}
        </div>
      </form>

      <div role="status" aria-live="polite">
        {imported !== null && !loading && (
          <p className="pop-in mt-3 flex items-center gap-2 rounded-[10px] bg-forest-tint px-3.5 py-2.5 text-[13px] font-semibold text-forest-strong">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            {imported} video eklendi. Başka bağlantılar yapıştırabilirsin.
          </p>
        )}
        {loading && <ReviewSkeleton message="Videolar YouTube’dan okunuyor…" />}
      </div>
      {loading && (
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={reset}>
          Getirmeyi durdur
        </button>
      )}

      {unreadable.length > 0 && !loading && !problem && (
        <p className="mt-3 text-[12.5px] break-words text-warn">
          {unreadable.length === 1 ? 'Bir satırda' : `${unreadable.length} satırda`} video bağlantısı yok, atlandı: “
          {unreadable[0].length > 60 ? `${unreadable[0].slice(0, 60)}…` : unreadable[0]}”{unreadable.length > 1 && ' …'}
        </p>
      )}

      {state.status === 'failed' && (
        <div className="callout callout-warn mt-3" role="alert">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-[13px] text-ink-2">
            <p className="font-semibold text-ink">{VIDEO_FAILURE_TEXT[state.failure].title}</p>
            <p className="mt-0.5">{VIDEO_FAILURE_TEXT[state.failure].body}</p>
            {VIDEO_FAILURE_TEXT[state.failure].retry && (
              <button type="button" className="btn btn-secondary btn-sm mt-2.5" onClick={() => void load(state.ids)}>
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
          heading={found === 1 ? '1 video bulundu' : `${found} video bulundu`}
          meta="Başlıklar ve süreler YouTube’dan"
          entries={state.entries}
          knownIds={knownIds}
          onImport={handleImport}
          importLabel={importLabel}
        />
      )}
    </div>
  );
}
