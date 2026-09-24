import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ListPlus, Plus, Trash2 } from 'lucide-react';
import { focusFirstInvalid } from '../../lib/dom';
import { formatMinutes } from '../../lib/format';
import type { BulkLine, DraftVideo } from '../../utils/youtubeParser';
import { parseBulkVideos, parseDurationInput, validateVideoUrl } from '../../utils/youtubeParser';

interface Props {
  drafts: DraftVideo[];
  onChange: (drafts: DraftVideo[]) => void;
  /** YouTube ids already in the camp, to catch duplicates. */
  existingIds: string[];
  /** Number of videos already in the camp, for "Video N" placeholders. */
  offset: number;
  error?: string;
}

const BULK_EXAMPLE = `https://www.youtube.com/watch?v=… | Temel Kavramlar | 42
https://youtu.be/… | Sayı Basamakları | 38:20
https://youtu.be/… 1 sa 5 dk`;

/** Adds videos to a draft list: one at a time or a pasted list. */
export function VideoEntry({ drafts, onChange, existingIds, offset, error }: Props) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [tried, setTried] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState<{ added: number; errors: Extract<BulkLine, { ok: false }>[] } | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const knownIds = [...existingIds, ...drafts.map(d => d.youtubeId)];
  const urlCheck = validateVideoUrl(url);
  const duplicate = urlCheck.ok && knownIds.includes(urlCheck.value.id);
  const durationCheck = parseDurationInput(duration);
  const urlError = !tried ? null : !urlCheck.ok ? urlCheck.error : duplicate ? 'Bu video listede zaten var.' : null;
  const durationError = tried && !durationCheck.ok ? durationCheck.error : null;

  const addSingle = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (!urlCheck.ok || duplicate || !durationCheck.ok) {
      focusFirstInvalid(event.currentTarget as HTMLFormElement);
      return;
    }
    onChange([
      ...drafts,
      { youtubeId: urlCheck.value.id, url: urlCheck.value.url, title: title.trim(), durationMinutes: durationCheck.value },
    ]);
    setUrl('');
    setTitle('');
    setDuration('');
    setTried(false);
    urlRef.current?.focus();
  };

  const addBulk = () => {
    const lines = parseBulkVideos(bulkText, knownIds);
    const valid = lines.filter((l): l is Extract<BulkLine, { ok: true }> => l.ok);
    const errors = lines.filter((l): l is Extract<BulkLine, { ok: false }> => !l.ok);
    if (valid.length > 0) onChange([...drafts, ...valid.map(l => l.video)]);
    setBulkText(errors.map(e => e.raw).join('\n'));
    setBulkResult({ added: valid.length, errors });
  };

  const total = drafts.reduce((a, d) => a + d.durationMinutes, 0);

  return (
    <div>
      <div className="segmented" role="tablist" aria-label="Video ekleme yöntemi">
        {(
          [
            ['single', 'Tek tek'],
            ['bulk', 'Liste yapıştır'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`${uid}-tab-${value}`}
            aria-selected={mode === value}
            aria-controls={`${uid}-panel`}
            onClick={() => setMode(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${mode}`} className="mt-3 rounded-[12px] border border-line bg-paper/60 p-3.5 sm:p-4">
        {mode === 'single' ? (
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
            </div>
            <div className="min-w-0">
              <label className="field-label" htmlFor={`${uid}-title`}>
                Başlık <span className="font-normal text-ink-3">(isteğe bağlı)</span>
              </label>
              <input
                id={`${uid}-title`}
                className="input"
                maxLength={200}
                placeholder={`Video ${offset + drafts.length + 1}`}
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
                Listeye ekle
              </button>
            </div>
          </form>
        ) : (
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
              Biçim: <code className="rounded bg-sunk px-1">bağlantı | başlık | süre</code>. Başlık isteğe bağlı; süre dakika
              (42), dk:sn (38:20) ya da “1 sa 5 dk” olabilir. Oynatma listesi bağlantısı okunamaz, videoları tek tek yapıştır.
            </p>
            <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={addBulk} disabled={!bulkText.trim()}>
              <ListPlus aria-hidden="true" />
              Satırları kontrol et ve ekle
            </button>
            {bulkResult && (
              <div className="mt-3 text-[13px]" role="status">
                <p className="font-semibold text-ink">
                  {bulkResult.added > 0 ? `${bulkResult.added} video listeye eklendi.` : 'Hiç video eklenmedi.'}
                  {bulkResult.errors.length > 0 && ` ${bulkResult.errors.length} satır düzeltilmeli (kutuda bırakıldı):`}
                </p>
                {bulkResult.errors.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {bulkResult.errors.map(e => (
                      <li key={`${e.line}-${e.raw}`} className="text-danger">
                        <span className="font-semibold break-all">“{e.raw.length > 48 ? `${e.raw.slice(0, 48)}…` : e.raw}”</span>{' '}
                        {e.error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-semibold text-ink">Eklenecek videolar</p>
          <p className="tnum text-[12.5px] text-ink-3">
            {drafts.length} video{drafts.length > 0 && ` · ${formatMinutes(total)}`}
          </p>
        </div>
        {drafts.length === 0 ? (
          <p className={`rounded-[10px] border border-dashed px-3 py-4 text-center text-[13px] ${error ? 'border-danger text-danger' : 'border-line-strong text-ink-3'}`}>
            {error ?? 'Henüz video yok. Yukarıdan ekle.'}
          </p>
        ) : (
          <ol className="max-h-[260px] overflow-y-auto rounded-[10px] border border-line">
            {drafts.map((draft, i) => (
              <li key={draft.youtubeId} className="flex items-center gap-3 border-t border-line px-3 py-2 first:border-t-0">
                <span className="tnum w-6 shrink-0 text-right text-[12px] text-ink-3">{offset + i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[14px] ${draft.title ? 'text-ink' : 'text-ink-3 italic'}`}>
                    {draft.title || `Video ${offset + i + 1}`}
                  </span>
                  <span className="block truncate text-[12px] text-ink-3">youtu.be/{draft.youtubeId}</span>
                </span>
                <span className="tnum shrink-0 text-[13px] text-ink-2">{formatMinutes(draft.durationMinutes)}</span>
                <button
                  type="button"
                  className="icon-btn size-8"
                  onClick={() => onChange(drafts.filter((_, j) => j !== i))}
                  aria-label={`${draft.title || `Video ${offset + i + 1}`} videosunu listeden çıkar`}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
