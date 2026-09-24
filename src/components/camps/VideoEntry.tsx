import { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { usePlaylistFetch } from '../../hooks/usePlaylistFetch';
import { formatMinutes } from '../../lib/format';
import type { DraftVideo } from '../../utils/youtubeParser';
import type { PlaylistInfo } from '../../utils/youtubePlaylist';
import { PlaylistImport } from './PlaylistImport';
import { BulkVideoForm, SingleVideoForm } from './VideoForms';

interface Props {
  drafts: DraftVideo[];
  onChange: (drafts: DraftVideo[]) => void;
  /** YouTube ids already in the branch, to catch duplicates. */
  existingIds: string[];
  /** Number of videos already in the branch, for "Video N" placeholders. */
  offset: number;
  error?: string;
  /** After videos were imported from a playlist. */
  onPlaylistImported?: (playlist: PlaylistInfo) => void;
}

type EntryMode = 'playlist' | 'single' | 'bulk';

/** Adds videos to a branch's draft list: from a YouTube playlist, one at a time, or a pasted list. */
export function VideoEntry({ drafts, onChange, existingIds, offset, error, onPlaylistImported }: Props) {
  const [mode, setMode] = useState<EntryMode>('playlist');
  const playlist = usePlaylistFetch();
  const uid = useId();

  const knownIds = [...existingIds, ...drafts.map(d => d.youtubeId)];
  const total = drafts.reduce((a, d) => a + d.durationMinutes, 0);

  const openAsPlaylist = (link: string) => {
    playlist.setLink(link);
    void playlist.load(link);
    setMode('playlist');
  };

  return (
    <div>
      <div className="segmented" role="tablist" aria-label="Video ekleme yöntemi">
        {(
          [
            ['playlist', 'Oynatma listesi'],
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
        {/* Kept mounted so a fetched list survives switching tabs. */}
        <div hidden={mode !== 'playlist'}>
          <PlaylistImport
            fetcher={playlist}
            knownIds={knownIds}
            onImport={(videos, info) => {
              onChange([...drafts, ...videos]);
              onPlaylistImported?.(info);
            }}
          />
        </div>
        {mode === 'single' && (
          <SingleVideoForm
            knownIds={knownIds}
            nextNumber={offset + drafts.length + 1}
            onAdd={draft => onChange([...drafts, draft])}
            onOpenPlaylist={openAsPlaylist}
          />
        )}
        {mode === 'bulk' && <BulkVideoForm knownIds={knownIds} onAdd={added => onChange([...drafts, ...added])} />}
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
                  <span className="block truncate text-[12px] text-ink-3">
                    {draft.channelName && `${draft.channelName} · `}youtu.be/{draft.youtubeId}
                  </span>
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
