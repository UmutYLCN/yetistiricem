import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ListPlus, Plus } from 'lucide-react';
import { focusFirstInvalid } from '../../lib/dom';
import type { BulkLine, DraftVideo } from '../../utils/youtubeParser';
import { inspectPlaylistLink, parseBulkVideos, parseDurationInput, validateVideoUrl } from '../../utils/youtubeParser';

const BULK_EXAMPLE = `https://www.youtube.com/watch?v=… | Temel Kavramlar | 42
https://youtu.be/… | Sayı Basamakları | 38:20
https://youtu.be/… 1 sa 5 dk`;

interface SingleProps {
  /** YouTube ids already in the list, to catch duplicates. */
  knownIds: string[];
  /** Placeholder number for the title ("Video N"). */
  nextNumber: number;
  onAdd: (draft: DraftVideo) => void;
  /** The pasted link is a playlist: offer to import it instead. */
  onOpenPlaylist?: (link: string) => void;
  submitLabel?: string;
}

/** One video: link, optional title, duration. */
export function SingleVideoForm({ knownIds, nextNumber, onAdd, onOpenPlaylist, submitLabel = 'Listeye ekle' }: SingleProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [tried, setTried] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const urlCheck = validateVideoUrl(url);
  const duplicate = urlCheck.ok && knownIds.includes(urlCheck.value.id);
  const durationCheck = parseDurationInput(duration);
  const urlError = !tried ? null : !urlCheck.ok ? urlCheck.error : duplicate ? 'Bu video listede zaten var.' : null;
  const urlIsPlaylist = !urlCheck.ok && inspectPlaylistLink(url).ok;
  const durationError = tried && !durationCheck.ok ? durationCheck.error : null;

  const addSingle = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (!urlCheck.ok || duplicate || !durationCheck.ok) {
      focusFirstInvalid(event.currentTarget as HTMLFormElement);
      return;
    }
    onAdd({ youtubeId: urlCheck.value.id, url: urlCheck.value.url, title: title.trim(), durationMinutes: durationCheck.value });
    setUrl('');
    setTitle('');
    setDuration('');
    setTried(false);
    urlRef.current?.focus();
  };

  return (
    <form onSubmit={addSingle} noValidate className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor={`${uid}-url`}>
          YouTube video bağlantısı
        </label>
        <input
          ref={urlRef}
          id={`${uid}-url`}
          className="input"
          inputMode="url"
          autoComplete="off"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={e => setUrl(e.target.value)}
          aria-invalid={urlError ? true : undefined}
          aria-describedby={urlError ? `${uid}-url-error` : undefined}
        />
        {urlError && (
          <p id={`${uid}-url-error`} className="field-error">
            {urlError}
          </p>
        )}
        {urlError && urlIsPlaylist && onOpenPlaylist && (
          <button
            type="button"
            className="btn btn-secondary btn-sm mt-2"
            onClick={() => {
              onOpenPlaylist(url.trim());
              setUrl('');
              setTried(false);
            }}
          >
            <ListPlus aria-hidden="true" />
            Listeyi içe aktar
          </button>
        )}
      </div>
      <div className="min-w-0">
        <label className="field-label" htmlFor={`${uid}-title`}>
          Başlık <span className="font-normal text-ink-3">(isteğe bağlı)</span>
        </label>
        <input
          id={`${uid}-title`}
          className="input"
          maxLength={200}
          placeholder={`Video ${nextNumber}`}
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>
      <div className="min-w-0">
        <label className="field-label" htmlFor={`${uid}-duration`}>
          Süre
        </label>
        <input
          id={`${uid}-duration`}
          className="input tnum"
          placeholder="42 veya 38:20"
          value={duration}
          onChange={e => setDuration(e.target.value)}
          aria-invalid={durationError ? true : undefined}
          aria-describedby={`${uid}-duration-${durationError ? 'error' : 'hint'}`}
        />
        {durationError ? (
          <p id={`${uid}-duration-error`} className="field-error">
            {durationError}
          </p>
        ) : (
          <p id={`${uid}-duration-hint`} className="field-hint">
            Dakika ya da dk:sn
          </p>
        )}
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-secondary btn-sm">
          <Plus aria-hidden="true" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

interface BulkProps {
  knownIds: string[];
  onAdd: (drafts: DraftVideo[]) => void;
}

/** Several videos pasted one per line: `link | title | duration`. */
export function BulkVideoForm({ knownIds, onAdd }: BulkProps) {
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState<{ added: number; errors: Extract<BulkLine, { ok: false }>[] } | null>(null);
  const uid = useId();

  const addBulk = () => {
    const lines = parseBulkVideos(bulkText, knownIds);
    const valid = lines.filter((l): l is Extract<BulkLine, { ok: true }> => l.ok);
    const errors = lines.filter((l): l is Extract<BulkLine, { ok: false }> => !l.ok);
    if (valid.length > 0) onAdd(valid.map(l => l.video));
    setBulkText(errors.map(e => e.raw).join('\n'));
    setBulkResult({ added: valid.length, errors });
  };

  return (
    <div>
      <label className="field-label" htmlFor={`${uid}-bulk`}>
        Her satıra bir video
      </label>
      <textarea
        id={`${uid}-bulk`}
        className="input font-mono text-[13px]"
        rows={5}
        spellCheck={false}
        placeholder={BULK_EXAMPLE}
        value={bulkText}
        onChange={e => {
          setBulkText(e.target.value);
          setBulkResult(null);
        }}
        aria-describedby={`${uid}-bulk-hint`}
      />
      <p id={`${uid}-bulk-hint`} className="field-hint">
        Biçim: <code className="rounded bg-sunk px-1">bağlantı | başlık | süre</code>. Başlık isteğe bağlı; süre dakika (42), dk:sn
        (38:20) ya da “1 sa 5 dk” olabilir. Bir oynatma listesinin tamamı için “Oynatma listesi” sekmesini kullan.
      </p>
      <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={addBulk} disabled={!bulkText.trim()}>
        <ListPlus aria-hidden="true" />
        Satırları kontrol et ve ekle
      </button>
      {bulkResult && (
        <div className="mt-3 text-[13px]" role="status">
          <p className="font-semibold text-ink">
            {bulkResult.added > 0 ? `${bulkResult.added} video eklendi.` : 'Hiç video eklenmedi.'}
            {bulkResult.errors.length > 0 && ` ${bulkResult.errors.length} satır düzeltilmeli (kutuda bırakıldı):`}
          </p>
          {bulkResult.errors.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {bulkResult.errors.map(e => (
                <li key={`${e.line}-${e.raw}`} className="text-danger">
                  <span className="font-semibold break-all">“{e.raw.length > 48 ? `${e.raw.slice(0, 48)}…` : e.raw}”</span> {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
