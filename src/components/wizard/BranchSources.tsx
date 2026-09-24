import type { SubjectPlaylist } from '../../types';
import type { SourceErrors } from '../../lib/campDraft';
import { sharedBranchNames } from '../../lib/campDraft';
import { totalMinutesOf } from '../../lib/camps';
import { formatMinutes } from '../../lib/format';
import { useConfirm } from '../ui/ConfirmDialog';
import { BranchCard } from './BranchCard';
import { NoSourcesYet, SourceComposer } from './SourceComposer';

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

/** Source composer on top, the resulting branch cards below. */
export function BranchSources({ branches, onChange, errors, showErrors, campYoutubeIds, usedColors, adding = false }: Props) {
  const confirm = useConfirm();
  const shared = sharedBranchNames(branches);

  const remove = async (branch: SubjectPlaylist) => {
    if (branch.videos.length > 0) {
      const ok = await confirm({
        title: 'Branş kaldırılsın mı?',
        body: (
          <p>
            <span className="font-semibold text-ink">{branch.subject || 'Bu branş'}</span> ve {branch.videos.length} videosu taslaktan
            çıkar. Listeyi yeniden ekleyerek geri getirebilirsin.
          </p>
        ),
        confirmLabel: 'Branşı kaldır',
        tone: 'danger',
      });
      if (!ok) return;
    }
    onChange(branches.filter(b => b.id !== branch.id));
  };
  const videos = branches.reduce((acc, b) => acc + b.videos.length, 0);
  const minutes = branches.reduce((acc, b) => acc + totalMinutesOf(b.videos), 0);

  return (
    <div className="space-y-5">
      <SourceComposer branches={branches} onChange={onChange} campYoutubeIds={campYoutubeIds} usedColors={usedColors} />
      <section aria-labelledby="branch-list-title">
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 id="branch-list-title" className="text-[15px] font-semibold text-ink">
            {adding ? 'Eklenecek branşlar' : 'Branşların'}
          </h3>
          {branches.length > 0 && (
            <p className="tnum text-[12.5px] text-ink-3">
              {branches.length} branş · {videos} video · {formatMinutes(minutes)}
            </p>
          )}
        </div>
        {branches.length === 0 ? (
          <NoSourcesYet error={showErrors ? errors.empty : undefined} adding={adding} />
        ) : (
          <>
            <p className="mb-2.5 text-[12.5px] text-ink-3">Adına dokunarak branşı yeniden adlandır; ok ile videolarını ve rengini gör.</p>
            <ul className="space-y-2">
              {branches.map(branch => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  error={showErrors ? errors.branches[branch.id] : undefined}
                  sharedName={shared.has(branch.subject.trim().toLocaleLowerCase('tr-TR'))}
                  onChange={next => onChange(branches.map(b => (b.id === next.id ? next : b)))}
                  onRemove={() => void remove(branch)}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
