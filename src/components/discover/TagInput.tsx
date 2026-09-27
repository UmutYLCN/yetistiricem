import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { MAX_TAGS, normalizeTag } from '../../lib/catalog';

/**
 * Interest tags as "#chips": type a word and press Enter (or space / comma);
 * Backspace in the empty field takes the last one back. Suggestions add with a
 * click. At most five, stored the way `normalizeTag` writes them.
 */
export function TagInput({ tags, onChange, suggestions, hideLabel = false }: { tags: string[]; onChange: (tags: string[]) => void; suggestions: readonly string[]; hideLabel?: boolean }) {
  const uid = useId();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const full = tags.length >= MAX_TAGS;

  const add = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!raw.replace(/^#+/, '').trim()) return;
    if (!tag) {
      setError('Etiket en az 2 harf olmalı; yalnızca harf, rakam ve _ kullanılır.');
      return;
    }
    if (full) {
      setError(`En fazla ${MAX_TAGS} etiket ekleyebilirsin.`);
      return;
    }
    setError(null);
    setDraft('');
    if (!tags.includes(tag)) onChange([...tags, tag]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const offered = suggestions.filter(s => !tags.includes(s)).slice(0, 10);

  return (
    <div>
      <label htmlFor={`${uid}-tag`} className={hideLabel ? 'visually-hidden' : 'field-label'}>
        İlgi etiketleri
      </label>
      <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-[10px] border border-line-strong bg-field px-2 py-1.5 focus-within:border-forest focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-forest)_22%,transparent)]">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-forest-soft py-1 pr-1 pl-2.5 text-[13px] font-medium text-forest-strong">
            #{tag}
            <button type="button" className="grid size-5 place-items-center rounded-full hover:bg-forest/20" onClick={() => onChange(tags.filter(t => t !== tag))} aria-label={`#${tag} etiketini çıkar`}>
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={`${uid}-tag`}
          className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-[15px] text-ink outline-none placeholder:text-ink-3"
          value={draft}
          placeholder={full ? 'Etiketler tamam' : tags.length === 0 ? '#yks, #matematik, #yazılım…' : 'Bir etiket daha'}
          disabled={full}
          maxLength={30}
          onChange={event => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          aria-describedby={`${uid}-hint`}
          data-autofocus
        />
      </div>
      {error ? (
        <p id={`${uid}-hint`} className="field-error" role="alert">
          {error}
        </p>
      ) : (
        <p id={`${uid}-hint`} className="field-hint">
          Kampını arayanlar seni bu etiketlerle bulur. Yazıp Enter’a bas; en fazla {MAX_TAGS} tane ({tags.length}/{MAX_TAGS}).
        </p>
      )}
      {offered.length > 0 && !full && (
        <div className="mt-4">
          <p className="text-[12.5px] font-medium text-ink-3">Öneriler</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {offered.map(tag => (
              <button key={tag} type="button" className="filter-chip inline-flex items-center gap-1" onClick={() => add(tag)}>
                <Plus className="size-3.5" aria-hidden="true" />#{tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
