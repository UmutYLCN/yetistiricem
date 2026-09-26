import { useId, useState } from 'react';
import { Check, Info, ListVideo, Plus } from 'lucide-react';
import type { SubjectPlaylist } from '../../types';
import { DEMO_TEMPLATES, instantiateTemplate } from '../../data/demoTemplates';
import { usePlaylistFetch } from '../../hooks/usePlaylistFetch';
import { createBranch, videoFromDraft, withVideos, youtubeIdsOf } from '../../lib/camps';
import { pickColor } from '../../lib/campDraft';
import { formatHours } from '../../lib/format';
import { guessBranchName } from '../../lib/studyCamp';
import { resolveColor } from '../../lib/subjects';
import type { DraftVideo } from '../../utils/youtubeParser';
import type { PlaylistInfo } from '../../utils/youtubePlaylist';
import { PlaylistImport } from '../camps/PlaylistImport';
import { BulkVideoForm, SingleVideoForm } from '../camps/VideoForms';
import { SubjectDot } from '../ui/Bits';
import { EmptyState } from '../ui/EmptyState';

type SourceMode = 'playlist' | 'single' | 'bulk' | 'template';
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
 * own branch (it keeps the list's link, title and channel); single or pasted
 * videos go to a new branch or an existing one; a demo template becomes a
 * clearly labelled, link-free branch.
 */
export function SourceComposer({ branches, onChange, campYoutubeIds = [], usedColors = [] }: Props) {
  const uid = useId();
  const [mode, setMode] = useState<SourceMode>('playlist');
  const [target, setTarget] = useState<string>(NEW_BRANCH);
  const playlist = usePlaylistFetch();

  const youtubeIds = [...campYoutubeIds, ...branches.flatMap(youtubeIdsOf)];
  const colors = [...usedColors, ...branches.map(b => b.colorTag)];
  const targetBranch = branches.find(b => b.id === target);
  const manualBranches = branches.filter(b => b.source !== 'demo-template');

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

  const addVideos = (drafts: DraftVideo[]) => {
    if (drafts.length === 0) return;
    if (targetBranch) {
      append(targetBranch, drafts);
      return;
    }
    const branch = addBranch({ title: 'Kendi eklediğin videolar', subject: `Branş ${branches.length + 1}`, channelName: '', playlistUrl: '', videos: drafts });
    // Keep adding to the branch that was just made.
    setTarget(branch.id);
  };

  const openAsPlaylist = (link: string) => {
    playlist.setLink(link);
    void playlist.load(link);
    setMode('playlist');
  };

  const tabs: [SourceMode, string][] = [
    ['playlist', 'Oynatma listesi'],
    ['single', 'Tek video'],
    ['bulk', 'Liste yapıştır'],
    ['template', 'Demo şablon'],
  ];

  const nextNumber = (targetBranch?.videos.length ?? 0) + 1;

  return (
    <section className="rounded-[16px] border border-line bg-paper/70 p-3 sm:p-4" aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`} className="sr-only">
        Kaynak ekle
      </h3>
      <div>
        <div className="segmented grid w-full grid-cols-2 sm:inline-flex sm:w-auto" role="tablist" aria-label="Kaynak türü">
          {tabs.map(([value, label]) => (
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
      </div>

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${mode}`} className="mt-3.5">
        {(mode === 'single' || mode === 'bulk') && manualBranches.length > 0 && (
          <div className="mb-3.5 max-w-sm">
            <label className="field-label" htmlFor={`${uid}-target`}>
              Nereye eklensin?
            </label>
            <select id={`${uid}-target`} className="input" value={targetBranch ? target : NEW_BRANCH} onChange={e => setTarget(e.target.value)}>
              <option value={NEW_BRANCH}>Yeni branş</option>
              {manualBranches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.subject || 'Adsız branş'} ({b.videos.length} video)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Kept mounted so a fetched list survives switching tabs. */}
        <div hidden={mode !== 'playlist'}>
          <PlaylistImport
            fetcher={playlist}
            knownIds={youtubeIds}
            onImport={importPlaylist}
            clearAfterImport
            importLabel={count => `${count} videoyla branş olarak ekle`}
          />
        </div>
        {mode === 'single' && (
          <SingleVideoForm
            knownIds={youtubeIds}
            nextNumber={nextNumber}
            onAdd={draft => addVideos([draft])}
            onOpenPlaylist={openAsPlaylist}
            submitLabel={targetBranch ? `${targetBranch.subject || 'Branşa'} ekle` : 'Yeni branşa ekle'}
          />
        )}
        {mode === 'bulk' && <BulkVideoForm knownIds={youtubeIds} onAdd={addVideos} />}
        {mode === 'template' && (
          <TemplatePicker
            added={branches.filter(b => b.source === 'demo-template').map(b => b.title)}
            onAdd={template => onChange([...branches, { ...instantiateTemplate(template), colorTag: pickColor(template.subject, colors) }])}
          />
        )}
      </div>
    </section>
  );
}

function TemplatePicker({ added, onAdd }: { added: string[]; onAdd: (template: SubjectPlaylist) => void }) {
  return (
    <div>
      <div className="callout callout-warn mb-3">
        <Info className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
        <p className="text-[13px] text-ink-2">
          <span className="font-semibold text-ink">Bunlar gerçek bir kanalın listesi değil.</span> Şablonlar örnek bir TYT konu
          sırası ve sabit örnek süreler içerir; video bağlantısı yoktur. Planı denemek için ekleyip sonra her konuya kendi
          videonun bağlantısını ekleyebilirsin.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {DEMO_TEMPLATES.map(template => {
          const isAdded = added.includes(template.title);
          const color = resolveColor(template.colorTag, template.subject);
          return (
            <li key={template.id} className="flex items-center gap-3 rounded-[12px] border border-line bg-card px-3 py-2.5">
              <SubjectDot color={color.solid} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{template.subject}</span>
                <span className="tnum block text-[12px] text-ink-3">
                  {template.videos.length} konu · ~{formatHours(template.totalDurationMinutes)}
                </span>
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isAdded}
                onClick={() => onAdd(template)}
                aria-label={isAdded ? `${template.title} zaten ekli` : `${template.title} demo şablonunu branş olarak ekle`}
              >
                {isAdded ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                {isAdded ? 'Ekli' : 'Ekle'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Friendly empty state for the branch list. */
export function NoSourcesYet({ error, adding = false }: { error?: string; adding?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center overflow-hidden rounded-[14px] border border-dashed px-5 pt-10 pb-9 text-center ${error ? 'border-danger/70' : 'border-line-strong'}`}
    >
      <EmptyState
        size="sm"
        icon={<ListVideo aria-hidden="true" />}
        tone="forest"
        title={adding ? 'Henüz yeni branş yok' : 'Henüz branş yok'}
      >
        Yukarıya bir YouTube oynatma listesi bağlantısı yapıştır. Her liste, adı ve gerçek süreleriyle ayrı bir branş olur.
      </EmptyState>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
