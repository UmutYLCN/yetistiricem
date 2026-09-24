import { useId, useState } from 'react';
import { Check, ChevronDown, ExternalLink, Trash2, X } from 'lucide-react';
import type { SubjectPlaylist } from '../../types';
import { withVideos } from '../../lib/camps';
import { formatMinutes } from '../../lib/format';
import { MAX_BRANCH_NAME } from '../../lib/studyCamp';
import { PALETTE, SUBJECTS, resolveColor } from '../../lib/subjects';

interface Props {
  branch: SubjectPlaylist;
  error?: string;
  /** Another branch has the same name. */
  sharedName?: boolean;
  onChange: (branch: SubjectPlaylist) => void;
  onRemove: () => void;
}

/**
 * One source list as an editable branch: rename it, pick its colour, check or
 * trim its videos. Compact when closed; everything stays touch-sized.
 */
export function BranchCard({ branch, error, sharedName, onChange, onRemove }: Props) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const color = resolveColor(branch.colorTag, branch.subject);
  const minutes = branch.videos.reduce((acc, v) => acc + v.durationMinutes, 0);
  const isDemo = branch.source === 'demo-template';

  return (
    <li className={`overflow-hidden rounded-[14px] border bg-card ${error ? 'border-danger/60' : 'border-line'}`}>
      <div className="flex items-start gap-3 p-3 sm:p-3.5">
        <span className="mt-1 w-1.5 shrink-0 self-stretch rounded-full" style={{ background: color.solid }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <label htmlFor={`${uid}-name`} className="sr-only">
            Branş adı
          </label>
          <input
            id={`${uid}-name`}
            className="branch-name-input"
            value={branch.subject}
            maxLength={MAX_BRANCH_NAME}
            list={`${uid}-subjects`}
            onChange={e => onChange({ ...branch, subject: e.target.value })}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${uid}-meta${error ? ` ${uid}-error` : ''}`}
            style={{ color: color.solid }}
          />
          <datalist id={`${uid}-subjects`}>
            {SUBJECTS.map(s => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <p id={`${uid}-meta`} className="tnum mt-0.5 truncate text-[12.5px] text-ink-3">
            <span className="text-ink-2">{branch.title}</span>
            {branch.channelName && !isDemo && <> · {branch.channelName}</>} · {branch.videos.length} video · {formatMinutes(minutes)}
          </p>
          {isDemo && <span className="chip chip-demo mt-1.5">Demo şablon · bağlantısız</span>}
          {sharedName && !error && (
            <p className="mt-1 text-[12px] text-ink-3">Aynı adda başka branş var; otomatik dağıtımda ikisi tek branş sayılır.</p>
          )}
          {error && (
            <p id={`${uid}-error`} className="field-error">
              {error}
            </p>
          )}
        </div>
        <div className="-mr-1 flex shrink-0 items-center">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-controls={`${uid}-panel`}
            aria-label={`${branch.subject || 'Branş'}: ${open ? 'ayrıntıları kapat' : 'videoları ve rengi düzenle'}`}
          >
            <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn hover:text-danger" onClick={onRemove} aria-label={`${branch.subject || 'Branş'} branşını kaldır`}>
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && (
        <div id={`${uid}-panel`} className="space-y-4 border-t border-line bg-paper/50 px-3 py-3.5 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <label className="field-label" htmlFor={`${uid}-title`}>
                Kaynak adı
              </label>
              <input
                id={`${uid}-title`}
                className="input"
                maxLength={120}
                value={branch.title}
                onChange={e => onChange({ ...branch, title: e.target.value })}
              />
            </div>
            <fieldset>
              <legend className="field-label">Renk</legend>
              <div className="flex flex-wrap gap-1">
                {PALETTE.map(option => {
                  const selected = option.key === color.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => onChange({ ...branch, colorTag: option.key })}
                      aria-pressed={selected}
                      aria-label={option.label}
                      title={option.label}
                      className="flex size-8 items-center justify-center rounded-full"
                      style={{
                        background: option.solid,
                        boxShadow: selected ? `0 0 0 2px var(--color-card), 0 0 0 4px ${option.solid}` : undefined,
                      }}
                    >
                      {selected && <Check className="size-4 text-white" strokeWidth={3} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold text-ink">Videolar, sırasıyla</p>
              {branch.playlistUrl && (
                <a
                  href={branch.playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-forest hover:underline"
                >
                  YouTube’da aç
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">(yeni sekme)</span>
                </a>
              )}
            </div>
            <ol className="max-h-[280px] overflow-y-auto overscroll-contain rounded-[10px] border border-line bg-card" aria-label={`${branch.subject} videoları`}>
              {branch.videos.map((video, i) => (
                <li key={video.id} className="flex items-center gap-2.5 border-t border-line py-1.5 pr-1.5 pl-3 first:border-t-0">
                  <span className="tnum w-6 shrink-0 text-right text-[12px] text-ink-3">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink" title={video.title}>
                    {video.title}
                  </span>
                  <span className="tnum shrink-0 text-[12.5px] text-ink-3">{formatMinutes(video.durationMinutes)}</span>
                  <button
                    type="button"
                    className="icon-btn size-9"
                    onClick={() => onChange(withVideos(branch, branch.videos.filter(v => v.id !== video.id)))}
                    aria-label={`${video.title} videosunu branştan çıkar`}
                  >
                    <X aria-hidden="true" />
                  </button>
                </li>
              ))}
              {branch.videos.length === 0 && <li className="px-3 py-4 text-center text-[13px] text-ink-3">Video kalmadı.</li>}
            </ol>
          </div>
        </div>
      )}
    </li>
  );
}
