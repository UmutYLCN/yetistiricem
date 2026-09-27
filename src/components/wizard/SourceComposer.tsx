import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { SubjectPlaylist } from '../../types';
import { usePlaylistFetch } from '../../hooks/usePlaylistFetch';
import { useVideosFetch } from '../../hooks/useVideosFetch';
import { createBranch, videoFromDraft, withVideos, youtubeIdsOf } from '../../lib/camps';
import { pickColor } from '../../lib/campDraft';
import { guessBranchName } from '../../lib/studyCamp';
import { SUBJECTS } from '../../lib/subjects';
import type { DraftVideo } from '../../utils/youtubeParser';
import type { PlaylistInfo } from '../../utils/youtubePlaylist';
import { ManualTopics } from '../camps/ManualTopics';
import { EntryReview, PlaylistImport } from '../camps/PlaylistImport';
import type { SourceKind } from '../camps/SourcePicker';
import { SourcePicker } from '../camps/SourcePicker';
import { VideoLinksImport } from '../camps/VideoLinksImport';
import { FetchingStage } from './FetchingStage';

const NEW_BRANCH = '__new__';

interface Props {
  branches: SubjectPlaylist[];
  onChange: (branches: SubjectPlaylist[]) => void;
  /** YouTube ids already in the camp (outside this draft), to flag duplicates. */
  campYoutubeIds?: string[];
  /** Colour keys already used by the camp's other branches. */
  usedColors?: string[];
  /** A source became a branch (or was added to one): the caller shows the branch list. */
  onAdded?: (branch: SubjectPlaylist) => void;
}

/** A stage that fills the composer (reading YouTube, reviewing what came), with a way back. */
function Stage({ back, onBack, children }: { back: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="pop-in">
      <button type="button" className="btn btn-ghost btn-sm -ml-2 mb-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        {back}
      </button>
      {children}
    </div>
  );
}

/**
 * Adds sources to a list of draft branches: each YouTube playlist becomes its
 * own branch (it keeps the list's link, title and channel); pasted video
 * links go to a new branch or an existing one, with their details read from
 * YouTube; topics typed by hand become a branch of link-less videos.
 */
export function SourceComposer({ branches, onChange, campYoutubeIds = [], usedColors = [], onAdded }: Props) {
  const uid = useId();
  const [mode, setMode] = useState<SourceKind>('playlist');
  const [target, setTarget] = useState<string>(NEW_BRANCH);
  const playlist = usePlaylistFetch();
  const videoFetch = useVideosFetch();
  // Remounts the links field after an import, so it starts empty.
  const [linksKey, setLinksKey] = useState(0);

  const youtubeIds = [...campYoutubeIds, ...branches.flatMap(youtubeIdsOf)];
  const colors = [...usedColors, ...branches.map(b => b.colorTag)];
  const targetBranch = branches.find(b => b.id === target);
  const targets = branches.filter(b => b.source !== 'demo-template');

  const addBranch = (input: { title: string; subject: string; channelName: string; playlistUrl: string; videos: DraftVideo[] }) => {
    const branch = createBranch({ ...input, colorTag: pickColor(input.subject, colors) });
    onChange([...branches, branch]);
    onAdded?.(branch);
    return branch;
  };

  const append = (branch: SubjectPlaylist, drafts: DraftVideo[]) => {
    const added = drafts.map((draft, i) => videoFromDraft(draft, branch.id, branch.videos.length + i + 1));
    const next = withVideos(branch, [...branch.videos, ...added]);
    onChange(branches.map(b => (b.id === branch.id ? next : b)));
    onAdded?.(next);
  };

  // A branch keeps one source link, so every playlist becomes its own branch
  // (appending a second list would lose its link). Merge by hand if needed.
  const importPlaylist = (drafts: DraftVideo[], info: PlaylistInfo) => {
    addBranch({
      title: info.title.trim() || 'Adsız liste',
      subject: guessBranchName(info.title),
      channelName: info.channelTitle.trim(),
      playlistUrl: info.url,
      videos: drafts,
    });
  };

  // Loose videos: named after the subject their first title mentions, if any.
  const addVideos = (drafts: DraftVideo[]) => {
    if (drafts.length === 0) return;
    if (targetBranch) {
      append(targetBranch, drafts);
      return;
    }
    const subject = guessBranchName(drafts[0].title);
    const channels = new Set(drafts.map(d => d.channelName ?? ''));
    addBranch({
      title: 'Kendi eklediğin videolar',
      subject: SUBJECTS.includes(subject) ? subject : `Branş ${branches.length + 1}`,
      channelName: channels.size === 1 ? [...channels][0] : '',
      playlistUrl: '',
      videos: drafts,
    });
  };

  const addTopics = (drafts: DraftVideo[], name: string) =>
    addBranch({ title: 'Elle eklenen konular', subject: name, channelName: '', playlistUrl: '', videos: drafts });

  const openAsPlaylist = (link: string) => {
    playlist.setLink(link);
    void playlist.load(link);
    setMode('playlist');
  };

  // Reading YouTube and reviewing what came fill the composer as stages of their own.
  const pState = playlist.state;
  const vState = videoFetch.state;
  let stage: ReactNode = null;
  if (mode === 'playlist' && pState.status === 'loading') {
    stage = (
      <FetchingStage
        title="Liste YouTube’dan okunuyor…"
        detail="Videoların adları, sırası ve gerçek süreleri geliyor. Uzun listelerde birkaç saniye sürebilir."
        onCancel={playlist.cancel}
      />
    );
  } else if (mode === 'playlist' && pState.status === 'loaded') {
    const info = pState.data.playlist;
    stage = (
      <Stage back="Başka liste seç" onBack={playlist.reset}>
        <EntryReview
          key={pState.version}
          stage
          heading={info.title || 'Adı olmayan liste'}
          meta={
            <>
              {info.channelTitle && <>{info.channelTitle} · </>}
              {pState.data.entries.length} video
            </>
          }
          link={{ href: info.url, label: 'Listeyi YouTube’da aç (yeni sekme)' }}
          entries={pState.data.entries}
          truncated={pState.data.truncated}
          knownIds={youtubeIds}
          onImport={drafts => {
            importPlaylist(drafts, info);
            playlist.reset();
          }}
          importLabel={count => `${count} videoyla branş olarak ekle`}
        />
      </Stage>
    );
  } else if (mode === 'videos' && vState.status === 'loading') {
    stage = (
      <FetchingStage
        title="Videolar YouTube’dan okunuyor…"
        detail="Başlıklar, kanallar ve gerçek süreler geliyor."
        onCancel={videoFetch.reset}
      />
    );
  } else if (mode === 'videos' && vState.status === 'loaded') {
    const found = vState.entries.filter(entry => entry.kind === 'video').length;
    stage = (
      <Stage back="Başka bağlantılar gir" onBack={videoFetch.reset}>
        <EntryReview
          key={vState.version}
          stage
          heading={found === 1 ? '1 video bulundu' : `${found} video bulundu`}
          meta="Başlıklar ve süreler YouTube’dan"
          entries={vState.entries}
          knownIds={youtubeIds}
          onImport={drafts => {
            addVideos(drafts);
            videoFetch.reset();
            setLinksKey(k => k + 1);
          }}
          importLabel={count =>
            targetBranch ? `${count} videoyu “${targetBranch.subject || 'branşa'}” içine ekle` : `${count} videoyla branş olarak ekle`
          }
        />
      </Stage>
    );
  }

  return (
    <section aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`} className="sr-only">
        Kaynak ekle
      </h3>
      {stage}
      <div hidden={stage !== null}>
        <SourcePicker value={mode} onChange={setMode} idBase={uid} label="Kaynak türü" />

        <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${mode}`} className="mt-3 rounded-[16px] border border-line bg-paper/70 p-3.5 sm:p-4">
          {/* Each way stays mounted, so a typed link or topics survive switching. */}
          <div hidden={mode !== 'playlist'}>
            <PlaylistImport fetcher={playlist} knownIds={youtubeIds} onImport={importPlaylist} clearAfterImport showResults={false} />
          </div>
          <div hidden={mode !== 'videos'}>
            {targets.length > 0 && (
              <div className="mb-3.5 max-w-sm">
                <label className="field-label" htmlFor={`${uid}-target`}>
                  Nereye eklensin?
                </label>
                <select id={`${uid}-target`} className="input" value={targetBranch ? target : NEW_BRANCH} onChange={e => setTarget(e.target.value)}>
                  <option value={NEW_BRANCH}>Yeni branş</option>
                  {targets.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.subject || 'Adsız branş'} ({b.videos.length} video)
                    </option>
                  ))}
                </select>
              </div>
            )}
            <VideoLinksImport key={linksKey} knownIds={youtubeIds} onImport={addVideos} onOpenPlaylist={openAsPlaylist} fetcher={videoFetch} showResults={false} />
          </div>
          <div hidden={mode !== 'manual'}>
            <ManualTopics askName onAdd={addTopics} submitLabel={count => `${count} konuyla branş olarak ekle`} />
          </div>
        </div>
      </div>
    </section>
  );
}
