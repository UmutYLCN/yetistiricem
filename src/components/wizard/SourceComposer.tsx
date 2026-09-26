import { useId, useState } from 'react';
import type { SubjectPlaylist } from '../../types';
import { usePlaylistFetch } from '../../hooks/usePlaylistFetch';
import { createBranch, videoFromDraft, withVideos, youtubeIdsOf } from '../../lib/camps';
import { pickColor } from '../../lib/campDraft';
import { guessBranchName } from '../../lib/studyCamp';
import { SUBJECTS } from '../../lib/subjects';
import type { DraftVideo } from '../../utils/youtubeParser';
import type { PlaylistInfo } from '../../utils/youtubePlaylist';
import { ManualTopics } from '../camps/ManualTopics';
import { PlaylistImport } from '../camps/PlaylistImport';
import type { SourceKind } from '../camps/SourcePicker';
import { SourcePicker } from '../camps/SourcePicker';
import { VideoLinksImport } from '../camps/VideoLinksImport';

const NEW_BRANCH = '__new__';

interface Props {
  branches: SubjectPlaylist[];
  onChange: (branches: SubjectPlaylist[]) => void;
  /** YouTube ids already in the camp (outside this draft), to flag duplicates. */
  campYoutubeIds?: string[];
  /** Colour keys already used by the camp's other branches. */
  usedColors?: string[];
}

/**
 * Adds sources to a list of draft branches: each YouTube playlist becomes its
 * own branch (it keeps the list's link, title and channel); pasted video
 * links go to a new branch or an existing one, with their details read from
 * YouTube; topics typed by hand become a branch of link-less videos.
 */
export function SourceComposer({ branches, onChange, campYoutubeIds = [], usedColors = [] }: Props) {
  const uid = useId();
  const [mode, setMode] = useState<SourceKind>('playlist');
  const [target, setTarget] = useState<string>(NEW_BRANCH);
  const playlist = usePlaylistFetch();

  const youtubeIds = [...campYoutubeIds, ...branches.flatMap(youtubeIdsOf)];
  const colors = [...usedColors, ...branches.map(b => b.colorTag)];
  const targetBranch = branches.find(b => b.id === target);
  const targets = branches.filter(b => b.source !== 'demo-template');

  const addBranch = (input: { title: string; subject: string; channelName: string; playlistUrl: string; videos: DraftVideo[] }) => {
    const branch = createBranch({ ...input, colorTag: pickColor(input.subject, colors) });
    onChange([...branches, branch]);
    return branch;
  };

  const append = (branch: SubjectPlaylist, drafts: DraftVideo[]) => {
    const added = drafts.map((draft, i) => videoFromDraft(draft, branch.id, branch.videos.length + i + 1));
    onChange(branches.map(b => (b.id === branch.id ? withVideos(b, [...b.videos, ...added]) : b)));
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
    const branch = addBranch({
      title: 'Kendi eklediğin videolar',
      subject: SUBJECTS.includes(subject) ? subject : `Branş ${branches.length + 1}`,
      channelName: channels.size === 1 ? [...channels][0] : '',
      playlistUrl: '',
      videos: drafts,
    });
    // Keep adding to the branch that was just made.
    setTarget(branch.id);
  };

  const addTopics = (drafts: DraftVideo[], name: string) =>
    addBranch({ title: 'Elle eklenen konular', subject: name, channelName: '', playlistUrl: '', videos: drafts });

  const openAsPlaylist = (link: string) => {
    playlist.setLink(link);
    void playlist.load(link);
    setMode('playlist');
  };

  return (
    <section aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`} className="sr-only">
        Kaynak ekle
      </h3>
      <SourcePicker value={mode} onChange={setMode} idBase={uid} label="Kaynak türü" />

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${mode}`} className="mt-3 rounded-[16px] border border-line bg-paper/70 p-3.5 sm:p-4">
        {/* Each way stays mounted, so a fetched list or typed topics survive switching. */}
        <div hidden={mode !== 'playlist'}>
          <PlaylistImport
            fetcher={playlist}
            knownIds={youtubeIds}
            onImport={importPlaylist}
            clearAfterImport
            importLabel={count => `${count} videoyla branş olarak ekle`}
          />
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
          <VideoLinksImport
            knownIds={youtubeIds}
            onImport={addVideos}
            onOpenPlaylist={openAsPlaylist}
            importLabel={count => (targetBranch ? `${count} videoyu “${targetBranch.subject || 'branşa'}” içine ekle` : `${count} videoyla branş olarak ekle`)}
          />
        </div>
        <div hidden={mode !== 'manual'}>
          <ManualTopics askName onAdd={addTopics} submitLabel={count => `${count} konuyla branş olarak ekle`} />
        </div>
      </div>
    </section>
  );
}
