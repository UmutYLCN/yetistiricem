import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CircleCheck, Plus } from 'lucide-react';
import type { SubjectPlaylist } from '../../types';
import type { SourceErrors } from '../../lib/campDraft';
import { sharedBranchNames } from '../../lib/campDraft';
import { totalMinutesOf } from '../../lib/camps';
import { formatMinutes } from '../../lib/format';
import { useConfirm } from '../ui/ConfirmDialog';
import { BranchCard } from './BranchCard';
import { SourceComposer } from './SourceComposer';
import { msg } from '../../lib/messages';


interface Props {
  branches: SubjectPlaylist[];
  onChange: (branches: SubjectPlaylist[]) => void;
  errors: SourceErrors;
  showErrors: boolean;
  /** YouTube ids already in the camp (when adding to an existing camp). */
  campYoutubeIds?: string[];
  usedColors?: string[];
  /** Adding to an existing camp: the list holds only the new branches. */
  adding?: boolean;
}

/**
 * Two views: adding a source (choose, read YouTube, review), and the branch
 * list with a big "add another branch" tile. Each added source lands on the
 * list, highlighted, so nothing new hides below the fold and it is clear that
 * a camp can hold many branches.
 */
export function BranchSources({ branches, onChange, errors, showErrors, campYoutubeIds, usedColors, adding = false }: Props) {
  const confirm = useConfirm();
  const shared = sharedBranchNames(branches);
  const [view, setView] = useState<'compose' | 'list'>(() => (branches.length > 0 ? 'list' : 'compose'));
  const [fresh, setFresh] = useState<{ id: string; name: string; videos: number } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  // A view change starts at the top of the dialog body.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    topRef.current?.closest('.dialog-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view, fresh]);

  const show = (next: 'compose' | 'list') => {
    moved.current = true;
    setView(next);
    if (next === 'compose') setFresh(null);
  };

  const remove = async (branch: SubjectPlaylist) => {
    if (branch.videos.length > 0) {
      const ok = await confirm({
        title: 'Branş kaldırılsın mı?',
        body: (
          <p>
            <span className="font-semibold text-ink">{branch.subject || 'Bu branş'}</span> {msg(" ve ")}{branch.videos.length} {msg(" videosu taslaktan\n            çıkar. Listeyi yeniden ekleyerek geri getirebilirsin.\n          ")}</p>
        ),
        confirmLabel: 'Branşı kaldır',
        tone: 'danger',
      });
      if (!ok) return;
    }
    const rest = branches.filter(b => b.id !== branch.id);
    onChange(rest);
    if (rest.length === 0) show('compose');
  };
  const videos = branches.reduce((acc, b) => acc + b.videos.length, 0);
  const minutes = branches.reduce((acc, b) => acc + totalMinutesOf(b.videos), 0);

  if (view === 'compose' || branches.length === 0) {
    return (
      <div ref={topRef} className="space-y-4">
        {branches.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm -ml-2" onClick={() => show('list')}>
            <ArrowLeft aria-hidden="true" />
            {msg("\n            Branşlarına dön (")}{branches.length}{msg(")\n          ")}</button>
        )}
        <SourceComposer
          branches={branches}
          onChange={onChange}
          campYoutubeIds={campYoutubeIds}
          usedColors={usedColors}
          onAdded={branch => {
            moved.current = true;
            setFresh({ id: branch.id, name: branch.subject, videos: branch.videos.length });
            setView('list');
          }}
        />
        {branches.length === 0 && showErrors && errors.empty && (
          <p className="field-error" role="alert">
            {errors.empty}
          </p>
        )}
      </div>
    );
  }

  return (
    <section ref={topRef} aria-labelledby="branch-list-title" className="space-y-3">
      {fresh && (
        <p className="pop-in flex items-center gap-2.5 rounded-[12px] bg-forest-tint px-4 py-3 text-[13.5px] text-ink-2" role="status">
          <CircleCheck className="size-5 shrink-0 text-forest" aria-hidden="true" />
          <span className="min-w-0">
            <span className="font-semibold text-ink">{msg("“")}{fresh.name || 'Yeni branş'}{msg("” eklendi")}</span> {msg(" · ")}{fresh.videos} {msg(" video. İstersen başka bir branş\n            daha ekle ya da Devam ile ilerle.\n          ")}</span>
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 id="branch-list-title" className="text-[15px] font-semibold text-ink">
          {adding ? msg("Eklenecek branşlar") : msg("Branşların")}
        </h3>
        <p className="tnum text-[12.5px] text-ink-3">
          {branches.length} {msg(" branş · ")}{videos} {msg(" video · ")}{formatMinutes(minutes)}
        </p>
      </div>
      <p className="text-[12.5px] text-ink-3">{msg("Adına dokunarak branşı yeniden adlandır; ok ile videolarını ve rengini gör.")}</p>
      <ul className="space-y-2">
        {branches.map(branch => (
          <BranchCard
            key={branch.id}
            branch={branch}
            fresh={fresh?.id === branch.id}
            error={showErrors ? errors.branches[branch.id] : undefined}
            sharedName={shared.has(branch.subject.trim().toLocaleLowerCase('tr-TR'))}
            onChange={next => onChange(branches.map(b => (b.id === next.id ? next : b)))}
            onRemove={() => void remove(branch)}
          />
        ))}
      </ul>
      <button type="button" className="add-branch-tile group" onClick={() => show('compose')}>
        <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-sunk text-ink-2 transition-colors group-hover:bg-forest group-hover:text-on-fill">
          <Plus className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-ink">{msg("Başka branş ekle")}</span>
          <span className="block text-[13px] text-ink-2">
            {msg("\n            Bir kamp birçok branş tutar: Matematik, Fizik, Türkçe… Her oynatma listesi ya da konu listesi ayrı bir branş olur.\n          ")}</span>
        </span>
      </button>
    </section>
  );
}
