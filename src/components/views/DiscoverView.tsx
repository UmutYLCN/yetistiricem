import { useCallback, useEffect, useId, useState } from 'react';
import { Compass, LoaderCircle, LogIn, RefreshCw, Search, TriangleAlert, Upload } from 'lucide-react';
import type { CatalogEntry } from '../../lib/catalog';
import { publishedLabel, searchCatalog } from '../../lib/catalog';
import { listPublishedCamps } from '../../lib/catalogApi';
import { formatHours } from '../../lib/format';
import { resolveColor } from '../../lib/subjects';
import type { AccountState } from '../../hooks/useAccount';
import { AuthorBadge } from '../discover/AuthorBadge';
import { PageHeader } from '../layout/PageHeader';
import { EmptyState } from '../ui/EmptyState';

interface Props {
  account: AccountState;
  today: string;
  /** Changes when the list should load again (after publishing or removing). */
  version: number;
  onOpen: (id: string) => void;
  onSignIn: () => void;
  onOpenCamps: () => void;
}

type ListState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; entries: CatalogEntry[] };

const SHOWN_SUBJECTS = 4;

function EntryCard({ entry, today, own, onOpen }: { entry: CatalogEntry; today: string; own: boolean; onOpen: (id: string) => void }) {
  const more = entry.subjects.length - SHOWN_SUBJECTS;
  return (
    <li>
      <button type="button" className="catalog-card" onClick={() => onOpen(entry.id)}>
        <span className="flex items-start gap-2">
          <span className="font-display min-w-0 flex-1 text-[17px] leading-snug break-words text-ink">{entry.name}</span>
          {own && <span className="chip chip-forest shrink-0">Senin</span>}
        </span>
        <span className="mt-2 flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
          <AuthorBadge name={entry.authorName} size="sm" />
          <span className="shrink-0 text-ink-3">· {publishedLabel(entry.createdAt, today)}</span>
        </span>
        {entry.description && <span className="mt-2.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{entry.description}</span>}
        <span className="mt-3 flex flex-wrap gap-1.5">
          {entry.subjects.slice(0, SHOWN_SUBJECTS).map(subject => (
            <span key={subject} className="chip">
              <span className="size-1.5 rounded-full" style={{ background: resolveColor(undefined, subject).solid }} aria-hidden="true" />
              {subject}
            </span>
          ))}
          {more > 0 && <span className="chip">+{more}</span>}
        </span>
        <span className="tnum mt-3 text-[12.5px] text-ink-3">
          {entry.branchCount} branş · {entry.videoCount} video · {formatHours(entry.totalMinutes)}
        </span>
      </button>
    </li>
  );
}

/** Keşfet: camps students published, to look inside and add to one's own plan. */
export function DiscoverView({ account, today, version, onOpen, onSignIn, onOpenCamps }: Props) {
  const uid = useId();
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const userId = account.status === 'signed-in' ? account.userId : null;

  useEffect(() => {
    if (account.status === 'off') return;
    let cancelled = false;
    void listPublishedCamps().then(result => {
      if (!cancelled) setList(result.ok ? { status: 'ready', entries: result.data } : { status: 'error', message: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [account.status, version, attempt]);

  const retry = useCallback(() => {
    setList({ status: 'loading' });
    setAttempt(n => n + 1);
  }, []);

  // The account itself lives in the sidebar's profile (Ayarlar); only the demo offers a sign-in here.
  const accountActions =
    account.status === 'signed-out' ? (
      <button type="button" className="btn btn-secondary btn-sm" onClick={onSignIn}>
        <LogIn aria-hidden="true" />
        Giriş yap
      </button>
    ) : null;

  if (account.status === 'off') {
    return (
      <div className="mx-auto max-w-[920px]">
        <PageHeader title="Keşfet" subtitle="Öğrencilerin yayınladığı kamplar" />
        <section className="card empty-surface px-6 py-14">
          <EmptyState icon={<Compass className="size-5" />} title="Keşfet bu sunucuda kurulmamış">
            Uygulamanın Supabase bağlantısı tanımlı değil (kurulum: docs/kesfet.md). Kendi kampların bundan etkilenmez.
          </EmptyState>
        </section>
      </div>
    );
  }

  const entries = list.status === 'ready' ? searchCatalog(mine && userId ? list.entries.filter(e => e.authorId === userId) : list.entries, query) : [];

  return (
    <div className="mx-auto max-w-[920px]">
      <PageHeader
        title="Keşfet"
        subtitle="Öğrencilerin yayınladığı kamplar. İçine bak, beğenirsen kendi planına ekle."
        actions={accountActions}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <label htmlFor={`${uid}-search`} className="visually-hidden">
            Kamplarda ara
          </label>
          <input
            id={`${uid}-search`}
            type="search"
            className="input pl-9"
            placeholder="Kamp, branş ya da kişi ara"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        {userId && (
          <div className="segmented" role="group" aria-label="Gösterilen kamplar">
            <button type="button" aria-pressed={!mine} onClick={() => setMine(false)}>
              Tümü
            </button>
            <button type="button" aria-pressed={mine} onClick={() => setMine(true)}>
              Yayınladıklarım
            </button>
          </div>
        )}
        <button type="button" className="btn btn-secondary" onClick={onOpenCamps}>
          <Upload aria-hidden="true" />
          Kampını yayınla
        </button>
      </div>

      {list.status === 'loading' && (
        <p className="flex items-center gap-2 py-10 text-[14px] text-ink-2">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Kamplar yükleniyor…
        </p>
      )}
      {list.status === 'error' && (
        <div className="callout callout-warn flex-wrap items-center">
          <TriangleAlert className="size-4 shrink-0 text-warn" aria-hidden="true" />
          <p className="min-w-[14rem] flex-1 text-[14px] text-ink-2">{list.message}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={retry}>
            <RefreshCw aria-hidden="true" />
            Tekrar dene
          </button>
        </div>
      )}
      {list.status === 'ready' &&
        (list.entries.length === 0 ? (
          <section className="card empty-surface px-6 py-14">
            <EmptyState
              icon={<Compass className="size-5" />}
              tone="forest"
              title="Henüz yayınlanmış kamp yok"
              actions={
                <button type="button" className="btn btn-primary" onClick={onOpenCamps}>
                  <Upload aria-hidden="true" />
                  İlk kampı sen yayınla
                </button>
              }
            >
              Kamplar’dan bir kampını yayınladığında burada herkes görebilir ve kendi planına ekleyebilir.
            </EmptyState>
          </section>
        ) : entries.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-ink-2">
            {mine ? 'Henüz kamp yayınlamadın.' : `“${query.trim()}” ile eşleşen kamp yok.`}
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" aria-label="Yayınlanan kamplar">
            {entries.map(entry => (
              <EntryCard key={entry.id} entry={entry} today={today} own={entry.authorId === userId} onOpen={onOpen} />
            ))}
          </ul>
        ))}
    </div>
  );
}
