import { useId, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { CircleCheck, CornerDownLeft, ListPlus, X } from 'lucide-react';
import { formatMinutes } from '../../lib/format';
import { MAX_BRANCH_NAME } from '../../lib/studyCamp';
import { SUBJECTS } from '../../lib/subjects';
import { parseTopicLines } from '../../lib/topicList';
import type { DraftVideo } from '../../utils/youtubeParser';
import { parseDurationInput } from '../../utils/youtubeParser';

interface Topic {
  key: number;
  title: string;
  duration: string;
}

interface Props {
  /** Adding a new branch (the camp wizard): ask for its name. */
  askName?: boolean;
  onAdd: (drafts: DraftVideo[], name: string) => void;
  /** Button text for the topics to add. */
  submitLabel?: (count: number) => string;
}

const MAX_TITLE = 200;
const defaultSubmitLabel = (count: number) => `${count} konuyu ekle`;

function minutesOf(topic: Pick<Topic, 'duration'>): number | null {
  const parsed = parseDurationInput(topic.duration);
  return parsed.ok ? parsed.value : null;
}

const isComplete = (topic: Pick<Topic, 'title' | 'duration'>) => topic.title.trim() !== '' && minutesOf(topic) !== null;

/**
 * Lessons from outside YouTube, typed as topics with a duration: one row per
 * topic, Enter adds the next, several pasted lines become several topics.
 * They become videos without a link (one can be added from the plan later).
 */
export function ManualTopics({ askName = false, onAdd, submitLabel = defaultSubmitLabel }: Props) {
  const uid = useId();
  const [name, setName] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [next, setNext] = useState({ title: '', duration: '' });
  const [nextTried, setNextTried] = useState(false);
  const [tried, setTried] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const keyRef = useRef(0);
  const titleRef = useRef<HTMLInputElement>(null);

  const make = (title: string, duration: string): Topic => ({ key: keyRef.current++, title, duration });
  const nextFilled = next.title.trim() !== '' || next.duration.trim() !== '';
  // A filled-in last row counts too, so nothing typed is lost.
  const all = nextFilled ? [...topics, { key: -1, ...next }] : topics;
  const incomplete = all.filter(topic => !isComplete(topic)).length;
  const total = topics.reduce((acc, topic) => acc + (minutesOf(topic) ?? 0), 0);
  const nextDuration = parseDurationInput(next.duration);
  const nextTitleError = nextTried && !next.title.trim() ? 'Konunun adını yaz.' : null;
  const nextDurationError = nextTried && !nextDuration.ok ? nextDuration.error : null;
  const nameError = askName && tried && !name.trim() ? 'Branşa bir ad ver.' : null;
  const listError = !tried ? null : all.length === 0 ? 'En az bir konu ekle.' : incomplete > 0 ? `${incomplete} konunun adı ya da süresi eksik.` : null;

  const addNext = () => {
    setAdded(null);
    if (!isComplete(next)) {
      setNextTried(true);
      return;
    }
    setTopics(list => [...list, make(next.title.trim(), next.duration.trim())]);
    setNext({ title: '', duration: '' });
    setNextTried(false);
    titleRef.current?.focus();
  };

  const onNextKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addNext();
  };

  // Several pasted lines become several topics at once.
  const onNextPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text').trim();
    if (!/\r?\n/.test(text)) return;
    event.preventDefault();
    setTopics(list => [...list, ...parseTopicLines(text).map(line => make(line.title, line.duration))]);
    setAdded(null);
  };

  const update = (key: number, patch: Partial<Topic>) => setTopics(list => list.map(t => (t.key === key ? { ...t, ...patch } : t)));

  const submit = () => {
    setTried(true);
    // The row being typed is part of what is added: show what it still lacks.
    if (nextFilled && !isComplete(next)) setNextTried(true);
    if ((askName && !name.trim()) || all.length === 0 || incomplete > 0) return;
    onAdd(
      all.map(topic => ({ youtubeId: '', url: '', title: topic.title.trim().slice(0, MAX_TITLE), durationMinutes: minutesOf(topic) ?? 0 })),
      name.trim()
    );
    setAdded(all.length);
    setTopics([]);
    setNext({ title: '', duration: '' });
    setName('');
    setTried(false);
    setNextTried(false);
  };

  const invalidTitle = (topic: Topic) => tried && !topic.title.trim();
  const invalidDuration = (topic: Topic) => tried && minutesOf(topic) === null;

  return (
    <div className="space-y-4">
      {askName && (
        <div className="max-w-sm">
          <label className="field-label" htmlFor={`${uid}-name`}>
            Branş adı
          </label>
          <input
            id={`${uid}-name`}
            className="input"
            maxLength={MAX_BRANCH_NAME}
            list={`${uid}-subjects`}
            placeholder="ör. Kimya"
            value={name}
            onChange={e => {
              setName(e.target.value);
              setAdded(null);
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={`${uid}-name-${nameError ? 'error' : 'hint'}`}
          />
          <datalist id={`${uid}-subjects`}>
            {SUBJECTS.map(subject => (
              <option key={subject} value={subject} />
            ))}
          </datalist>
          {nameError ? (
            <p id={`${uid}-name-error`} className="field-error">
              {nameError}
            </p>
          ) : (
            <p id={`${uid}-name-hint`} className="field-hint">
              Planda bu adla görünür.
            </p>
          )}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-semibold text-ink" id={`${uid}-topics`}>
            Konular
          </p>
          {topics.length > 0 && (
            <p className="tnum text-[12.5px] text-ink-3">
              {topics.length} konu · {formatMinutes(total)}
            </p>
          )}
        </div>
        <ol aria-labelledby={`${uid}-topics`} className="overflow-hidden rounded-[12px] border border-line bg-card">
          {topics.map((topic, i) => (
            <li key={topic.key} className="pop-in flex items-start gap-2 border-b border-line px-2.5 py-2">
              <span className="tnum w-5 shrink-0 pt-2.5 text-right text-[12px] text-ink-3 sm:w-6">{i + 1}</span>
              <input
                className="input min-h-[38px] min-w-0 flex-1 py-1.5 text-[14px]"
                maxLength={MAX_TITLE}
                value={topic.title}
                onChange={e => update(topic.key, { title: e.target.value })}
                aria-label={`${i + 1}. konunun adı`}
                aria-invalid={invalidTitle(topic) ? true : undefined}
              />
              <input
                className="input tnum min-h-[38px] w-[4.75rem] shrink-0 py-1.5 text-[14px] sm:w-24"
                value={topic.duration}
                placeholder="Süre"
                onChange={e => update(topic.key, { duration: e.target.value })}
                aria-label={`${i + 1}. konunun süresi`}
                aria-invalid={invalidDuration(topic) ? true : undefined}
              />
              <button
                type="button"
                className="icon-btn size-[38px] shrink-0 max-sm:w-8"
                onClick={() => setTopics(list => list.filter(t => t.key !== topic.key))}
                aria-label={`${i + 1}. konuyu kaldır`}
              >
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
          <li className="flex items-start gap-2 bg-paper/50 px-2.5 py-2">
            <span className="w-5 shrink-0 pt-2.5 text-right text-[12px] text-ink-3 sm:w-6" aria-hidden="true">
              {topics.length + 1}
            </span>
            <div className="min-w-0 flex-1">
              <input
                ref={titleRef}
                className="input min-h-[38px] py-1.5 text-[14px]"
                maxLength={MAX_TITLE}
                placeholder={topics.length === 0 ? 'Konu adı, ör. Atom ve Periyodik Sistem' : 'Sonraki konu'}
                value={next.title}
                onChange={e => setNext(n => ({ ...n, title: e.target.value }))}
                onKeyDown={onNextKey}
                onPaste={onNextPaste}
                aria-label="Yeni konunun adı"
                aria-invalid={nextTitleError ? true : undefined}
                aria-describedby={nextTitleError ? `${uid}-next-title-error` : `${uid}-hint`}
              />
              {nextTitleError && (
                <p id={`${uid}-next-title-error`} className="field-error">
                  {nextTitleError}
                </p>
              )}
            </div>
            <div className="w-[4.75rem] shrink-0 sm:w-24">
              <input
                className="input tnum min-h-[38px] py-1.5 text-[14px]"
                placeholder="45 dk"
                value={next.duration}
                onChange={e => setNext(n => ({ ...n, duration: e.target.value }))}
                onKeyDown={onNextKey}
                aria-label="Yeni konunun süresi"
                aria-invalid={nextDurationError ? true : undefined}
                aria-describedby={nextDurationError ? `${uid}-next-duration-error` : `${uid}-hint`}
              />
            </div>
            <button type="button" className="icon-btn size-[38px] shrink-0 text-forest max-sm:w-8" onClick={addNext} aria-label="Konuyu listeye ekle">
              <CornerDownLeft aria-hidden="true" />
            </button>
          </li>
        </ol>
        {nextDurationError ? (
          <p id={`${uid}-next-duration-error`} className="field-error">
            {nextDurationError}
          </p>
        ) : (
          <p id={`${uid}-hint`} className="field-hint">
            Enter ile sonraki konuya geç. Süre 45, 38:20 ya da “1 sa 5 dk” olabilir; birden çok satırı birden yapıştırabilirsin. Video
            bağlantısını sonra plandan ekleyebilirsin.
          </p>
        )}
        {listError && (
          <p className="field-error" role="alert">
            {listError}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={submit} disabled={all.length === 0}>
          <ListPlus aria-hidden="true" />
          {all.length > 0 ? submitLabel(all.length) : 'Eklemek için konu yaz'}
        </button>
        <p role="status" className="text-[12.5px] font-semibold text-forest">
          {added !== null && (
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck className="size-4" aria-hidden="true" />
              {added} konu eklendi.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
