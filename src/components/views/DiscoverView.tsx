import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Compass, Heart, LogIn, RefreshCw, Search, Share2, TriangleAlert, Upload, X } from 'lucide-react';
import type { CatalogEntry, CatalogSort } from '../../lib/catalog';
import { popularTags, searchCatalog, sortCatalog, withTag } from '../../lib/catalog';
import { listPublishedCamps } from '../../lib/catalogApi';
import type { AccountState } from '../../hooks/useAccount';
import { CatalogCard } from '../discover/CatalogCard';
import { PageHeader } from '../layout/PageHeader';
import { EmptyState } from '../ui/EmptyState';

export type SaveToggle = (campId: string) => Promise<{ ok: true; saved: boolean } | { ok: false; error: string }>;

interface Props {
  account: AccountState;
  today: string;
  /** Changes when the list should load again (after publishing or removing). */
  version: number;
  /** Ids of the camps the student saved; null without an account. */
  saved: ReadonlySet<string> | null;
  onToggleSave: SaveToggle;
  onOpen: (id: string) => void;
  onSignIn: () => void;
  onOpenCamps: () => void;
  onNotify: (message: string) => void;
}

type ListState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; entries: CatalogEntry[] };
type Scope = 'all' | 'saved' | 'mine';

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'new', label: 'En yeni' },
  { value: 'old', label: 'En eski' },
  { value: 'popular', label: 'En çok kaydedilen' },
  { value: 'short', label: 'En kısa' },
  { value: 'long', label: 'En uzun' },
];

function CardSkeleton() {
  return (
    <li aria-hidden="true">
      <div className="aspect-[16/10] animate-pulse rounded-[16px] bg-sunk" />
      <div className="mt-3 flex items-center gap-2">
        <div className="size-5 animate-pulse rounded-full bg-sunk" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-sunk" />
      </div>
      <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-sunk" />
      <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-sunk" />
    </li>
  );
}

/** Keşfet: camps students published, to search by name or tag, save for later and add to one's own plan. */
export function DiscoverView({ account, today, version, saved, onToggleSave, onOpen, onSignIn, onOpenCamps, onNotify }: Props) {
  const uid = useId();
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<CatalogSort>('new');
  const [scope, setScope] = useState<Scope>('all');
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

  const all = useMemo(() => (list.status === 'ready' ? list.entries : []), [list]);
  const tags = useMemo(() => popularTags(all, 12), [all]);

  const toggleSave = async (entry: Pick<CatalogEntry, 'id'>) => {
    if (!userId) {
      onSignIn();
      return;
    }
    const result = await onToggleSave(entry.id);
    if (!result.ok) {
      onNotify(result.error);
      return;
    }
    // The count on screen follows at once; the next load brings the stored one.
    setList(current =>
      current.status === 'ready'
        ? { ...current, entries: current.entries.map(e => (e.id === entry.id ? { ...e, saveCount: Math.max(0, e.saveCount + (result.saved ? 1 : -1)) } : e)) }
        : current
    );
  };

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

  const scoped = scope === 'mine' && userId ? all.filter(e => e.authorId === userId) : scope === 'saved' && saved ? all.filter(e => saved.has(e.id)) : all;
  const entries = sortCatalog(searchCatalog(withTag(scoped, tag), query), sort);
  const filtered = query.trim() !== '' || tag !== null || scope !== 'all';

  return (
    <div className="mx-auto max-w-[920px]">
      <PageHeader
        title="Keşfet"
        subtitle={scope === 'saved' ? 'Favorilerin: sonra dönmek için kaydettiğin kamplar.' : scope === 'mine' ? 'Keşfet’te paylaştığın kamplar.' : undefined}
        actions={
          <>
            {account.status === 'signed-out' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onSignIn}>
                <LogIn aria-hidden="true" />
                Giriş yap
              </button>
            )}
            <button
              type="button"
              className={`btn btn-sm ${scope === 'saved' ? 'btn-primary' : 'btn-secondary'}`}
              aria-pressed={scope === 'saved'}
              onClick={() => (userId ? setScope(scope === 'saved' ? 'all' : 'saved') : onSignIn())}
            >
              <Heart className={scope === 'saved' ? 'fill-current text-danger' : ''} aria-hidden="true" />
              Favoriler
              {saved && saved.size > 0 && <span className="tnum opacity-70">{saved.size}</span>}
            </button>
            {userId && (
              <button
                type="button"
                className={`btn btn-sm ${scope === 'mine' ? 'btn-primary' : 'btn-secondary'}`}
                aria-pressed={scope === 'mine'}
                onClick={() => setScope(scope === 'mine' ? 'all' : 'mine')}
              >
                <Share2 aria-hidden="true" />
                Paylaştıklarım
              </button>
            )}
          </>
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <label htmlFor={`${uid}-search`} className="visually-hidden">
          Kamplarda ara
        </label>
        <input
          id={`${uid}-search`}
          type="search"
          className="input min-h-[46px] rounded-full pl-10"
          placeholder="Kamp adı ya da #etiket ara"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
      </div>

      <div className="mt-3 mb-5 flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-0.5" role="group" aria-label="Etikete göre süz">
          <button type="button" className="filter-chip" aria-pressed={tag === null} onClick={() => setTag(null)}>
            Tümü
          </button>
          {tags.map(name => (
            <button key={name} type="button" className="filter-chip" aria-pressed={tag === name} onClick={() => setTag(tag === name ? null : name)}>
              #{name}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label htmlFor={`${uid}-sort`} className="visually-hidden">
            Sırala
          </label>
          <select id={`${uid}-sort`} className="input min-h-[38px] w-auto py-1.5 text-[13px]" value={sort} onChange={e => setSort(e.target.value as CatalogSort)}>
            {SORTS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {list.status === 'loading' && (
        <ul className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3" aria-label="Kamplar yükleniyor" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </ul>
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
        (all.length === 0 ? (
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
          <div className="flex flex-col items-center rounded-[16px] border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="font-semibold text-ink">
              {scope === 'saved' && !query.trim() && !tag
                ? 'Favorilerinde kamp yok.'
                : scope === 'mine' && !query.trim() && !tag
                  ? 'Henüz kamp paylaşmadın.'
                  : 'Eşleşen kamp yok.'}
            </p>
            <p className="mt-1 text-[13.5px] text-ink-2">
              {scope === 'saved' && !query.trim() && !tag
                ? 'Sonra dönmek istediğin bir kampın kalbine bas; burada toplanır.'
                : scope === 'mine' && !query.trim() && !tag
                  ? 'Kamplar’da bir kampının ⋯ menüsünden “Keşfet’te yayınla”yı seç.'
                  : 'Aramayı ya da süzgeçleri değiştirip tekrar dene.'}
            </p>
            {scope === 'mine' && !query.trim() && !tag ? (
              <button type="button" className="btn btn-secondary btn-sm mt-4" onClick={onOpenCamps}>
                Kamplar’a git
              </button>
            ) : filtered && (
              <button
                type="button"
                className="btn btn-secondary btn-sm mt-4"
                onClick={() => {
                  setQuery('');
                  setTag(null);
                  setScope('all');
                }}
              >
                <X aria-hidden="true" />
                Süzgeçleri temizle
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3" aria-label="Yayınlanan kamplar">
            {entries.map(entry => (
              <CatalogCard
                key={entry.id}
                entry={entry}
                today={today}
                own={entry.authorId === userId}
                saved={saved?.has(entry.id) ?? false}
                onOpen={onOpen}
                onToggleSave={e => void toggleSave(e)}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}
