import { useEffect, useId, useRef, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { MAX_NOTE_LENGTH } from '../../lib/persistence';

interface Props {
  date: string;
  value: string;
  onSave: (date: string, text: string) => void;
  isDemo: boolean;
}

/**
 * Free-text note for one day. Saves while typing (debounced), on blur, and
 * when the day changes. Mount it with `key={date}`.
 */
export function DayNote({ date, value, onSave, isDemo }: Props) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(false);
  const id = useId();
  const unsaved = useRef<string | null>(null);

  useEffect(() => {
    if (text === value) return;
    unsaved.current = text;
    const timer = window.setTimeout(() => {
      unsaved.current = null;
      onSave(date, text);
      setSaved(true);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [text, value, date, onSave]);

  // Flush an edit still waiting for the debounce when the day changes.
  useEffect(
    () => () => {
      if (unsaved.current !== null) onSave(date, unsaved.current);
    },
    [date, onSave]
  );

  const flush = () => {
    if (text === value) return;
    unsaved.current = null;
    onSave(date, text);
    setSaved(true);
  };

  const status = text !== value ? 'Kaydediliyor…' : saved ? (isDemo ? 'Demoda tutuldu, kaydedilmez' : 'Kaydedildi') : '';

  return (
    <section className="card p-4 sm:p-5" aria-labelledby={`${id}-label`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label id={`${id}-label`} htmlFor={id} className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <NotebookPen className="size-4 text-ink-3" aria-hidden="true" />
          Gün notu
        </label>
        <span className="text-[12px] text-ink-3" aria-live="polite">
          {status}
        </span>
      </div>
      <textarea
        id={id}
        className="input"
        rows={3}
        maxLength={MAX_NOTE_LENGTH}
        value={text}
        placeholder="Tekrar edilecek konu, çözülecek soru sayısı, aklına gelen bir soru…"
        onChange={event => {
          setText(event.target.value);
          setSaved(false);
        }}
        onBlur={flush}
      />
      {text.length > MAX_NOTE_LENGTH * 0.9 && (
        <p className="field-hint tnum">
          {text.length} / {MAX_NOTE_LENGTH}
        </p>
      )}
    </section>
  );
}
