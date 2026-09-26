import { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { usePlaylistFetch } from '../../hooks/usePlaylistFetch';
import { formatMinutes } from '../../lib/format';
import type { DraftVideo } from '../../utils/youtubeParser';
import type { PlaylistInfo } from '../../utils/youtubePlaylist';
import { ManualTopics } from './ManualTopics';
import { PlaylistImport } from './PlaylistImport';
import type { SourceKind } from './SourcePicker';
import { SourcePicker } from './SourcePicker';
import { VideoLinksImport } from './VideoLinksImport';

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

/** Adds videos to a branch's draft list: from a YouTube playlist, pasted video links, or topics typed by hand. */
export function VideoEntry({ drafts, onChange, existingIds, offset, error, onPlaylistImported }: Props) {
  const [mode, setMode] = useState<SourceKind>('playlist');
  const playlist = usePlaylistFetch();
  const uid = useId();

  const knownIds = [...existingIds, ...drafts.flatMap(d => (d.youtubeId ? [d.youtubeId] : []))];
  const total = drafts.reduce((a, d) => a + d.durationMinutes, 0);
  const add = (videos: DraftVideo[]) => onChange([...drafts, ...videos]);

  const openAsPlaylist = (link: string) => {
    playlist.setLink(link);
    void playlist.load(link);
    setMode('playlist');
  };

  return (
    <div>
      <SourcePicker value={mode} onChange={setMode} idBase={uid} label="Video ekleme yöntemi" />

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${mode}`} className="mt-3 rounded-[12px] border border-line bg-paper/60 p-3.5 sm:p-4">
        {/* Each way stays mounted, so a fetched list or typed topics survive switching. */}
        <div hidden={mode !== 'playlist'}>
          <PlaylistImport
            fetcher={playlist}
            knownIds={knownIds}
            onImport={(videos, info) => {
              add(videos);
              onPlaylistImported?.(info);
            }}
          />
        </div>
        <div hidden={mode !== 'videos'}>
          <VideoLinksImport knownIds={knownIds} onImport={add} onOpenPlaylist={openAsPlaylist} />
        </div>
        <div hidden={mode !== 'manual'}>
          <ManualTopics onAdd={add} />
        </div>
      </div>

      {drafts.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold text-ink">Eklenecek videolar</p>
            <p className="tnum text-[12.5px] text-ink-3">
              {drafts.length} video · {formatMinutes(total)}
            </p>
          </div>
          <ol className="max-h-[260px] overflow-y-auto rounded-[10px] border border-line">
            {drafts.map((draft, i) => (
              <li key={draft.youtubeId || `topic-${i}`} className="flex items-center gap-3 border-t border-line px-3 py-2 first:border-t-0">
                <span className="tnum w-6 shrink-0 text-right text-[12px] text-ink-3">{offset + i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[14px] ${draft.title ? 'text-ink' : 'text-ink-3 italic'}`}>
                    {draft.title || `Video ${offset + i + 1}`}
                  </span>
                  <span className="block truncate text-[12px] text-ink-3">
                    {draft.youtubeId ? (
                      <>
                        {draft.channelName && `${draft.channelName} · `}youtu.be/{draft.youtubeId}
                      </>
                    ) : (
                      'Elle eklenen konu · bağlantısız'
                    )}
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
        </div>
      ) : (
        error && (
          <p className="field-error mt-3" role="alert">
            {error}
          </p>
        )
      )}
    </div>
  );
}
