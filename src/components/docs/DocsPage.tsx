import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Menu, Search, X } from 'lucide-react';
import { APP_PATH, DOCS_PATH, LANDING_PATH, docsHref } from '../../lib/routes';
import { BrandMark, Wordmark } from '../ui/BrandMark';
import type { DocPage } from './content';
import { DOC_PAGES } from './content';
import { DocsNavigate } from './navigate';
import { msg } from '../../lib/messages';
import { useLanguage } from '../../lib/LanguageContext';
import { dateLocale } from '../../lib/format';


const GROUPS = [...new Set(DOC_PAGES.map(p => p.group))];

function slugOf(pathname: string): string {
  return pathname.replace(/\/+$/, '').slice(DOCS_PATH.length).replace(/^\//, '');
}

const fold = (text: string) => text.toLocaleLowerCase(dateLocale()).normalize('NFD').replace(/\p{M}/gu, '');

function searchDocs(query: string): DocPage[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return DOC_PAGES.filter(page => {
    const haystack = fold([msg(page.title), msg(page.group), msg(page.description), page.keywords ?? ''].join(' '));
    return words.every(word => haystack.includes(word));
  }).slice(0, 8);
}

function SearchBox({ onGo }: { onGo: (page: DocPage) => void }) {
  const { language } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchDocs(query), [query, language]);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (page: DocPage) => {
    setQuery('');
    inputRef.current?.blur();
    onGo(page);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(i => Math.min(results.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(i => Math.max(0, i - 1));
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault();
      go(results[active]);
    } else if (event.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full max-w-[420px]">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      <label htmlFor="docs-search" className="visually-hidden">
        {msg("\n        Belgelerde ara\n      ")}</label>
      <input
        ref={inputRef}
        id="docs-search"
        type="search"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="docs-search-results"
        aria-activedescendant={results[active] ? `docs-result-${active}` : undefined}
        autoComplete="off"
        className="input h-9 pr-14 pl-9 text-[13.5px]"
        placeholder={msg("Belgelerde ara")}
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {!query && (
        <kbd className="kbd pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] max-sm:hidden">{isMac ? msg("⌘K") : msg("Ctrl K")}</kbd>
      )}
      {query.trim() && (
        <ul id="docs-search-results" role="listbox" className="absolute top-11 right-0 left-0 z-50 overflow-hidden rounded-[12px] border border-line-strong bg-card p-1.5 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)]">
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-[13.5px] text-ink-3">{msg("Sonuç yok.")}</li>
          ) : (
            results.map((page, i) => (
              <li
                key={page.slug}
                id={`docs-result-${i}`}
                role="option"
                aria-selected={i === active}
                className={`cursor-pointer rounded-[8px] px-3 py-2 ${i === active ? 'bg-sunk' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={event => {
                  event.preventDefault();
                  go(page);
                }}
              >
                <p className="text-[13.5px] font-medium text-ink">
                  <span className="text-ink-3">{msg(page.group)} {msg(" ›")}</span> {msg(page.title)}
                </p>
                <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{msg(page.description)}</p>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function Sidebar({ current, onGo }: { current: string; onGo: (slug: string) => void }) {
  return (
    <nav aria-label={msg("Belgeler")} className="space-y-6">
      {GROUPS.map(group => (
        <div key={group}>
          <p className="px-3 text-[12px] font-semibold tracking-[0.02em] text-ink-3">{msg(group)}</p>
          <ul className="mt-1.5 space-y-0.5">
            {DOC_PAGES.filter(p => p.group === group).map(page => (
              <li key={page.slug}>
                <a
                  href={docsHref(page.slug)}
                  className="docs-nav-link"
                  aria-current={page.slug === current ? 'page' : undefined}
                  onClick={event => {
                    if (event.metaKey || event.ctrlKey || event.button !== 0) return;
                    event.preventDefault();
                    onGo(page.slug);
                  }}
                >
                  {msg(page.title)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

function useToc(slug: string, language: string) {
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const headings = [...document.querySelectorAll<HTMLElement>('#docs-article h2[id], #docs-article h3[id]')];
    // Read once the page's headings are drawn.
    const frame = requestAnimationFrame(() => {
      setEntries(headings.map(h => ({ id: h.id, text: (h.firstChild?.textContent ?? h.textContent ?? '').trim(), level: h.tagName === 'H3' ? 3 : 2 })));
      setActive(headings[0]?.id ?? null);
    });
    const observer = new IntersectionObserver(
      observed => {
        const visible = observed.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' }
    );
    headings.forEach(h => observer.observe(h));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [slug, language]);
  return { entries, active };
}

/**
 * `/docs[/<page>]`: the Yetişir docs, laid out like most docs sites: a top bar
 * with search, pages grouped on the left, the article, and "Bu sayfada" on the
 * right. Moving between docs pages stays in this page (history entries); the
 * planner and the landing page are full page loads away.
 */
export default function DocsPage() {
  const { language } = useLanguage();
  const [slug, setSlug] = useState(() => slugOf(window.location.pathname));
  const [menuOpen, setMenuOpen] = useState(false);
  const page = DOC_PAGES.find(p => p.slug === slug) ?? null;
  const index = page ? DOC_PAGES.indexOf(page) : -1;
  const prev = index > 0 ? DOC_PAGES[index - 1] : null;
  const next = index >= 0 && index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : null;
  const { entries, active } = useToc(slug, language);
  const pendingSection = useRef<string | null>(window.location.hash.slice(1) || null);

  const navigate = useCallback((to: string, section?: string) => {
    setMenuOpen(false);
    const href = docsHref(to, section);
    if (`${window.location.pathname}${window.location.hash}` !== href) window.history.pushState(null, '', href);
    pendingSection.current = section ?? null;
    setSlug(to);
    if (!section) window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => {
      pendingSection.current = window.location.hash.slice(1) || null;
      setSlug(slugOf(window.location.pathname));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = page ? `${msg(page.title)} · ${msg('Yetişir Belgeleri')}` : msg('Sayfa bulunamadı · Yetişir Belgeleri');
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute(
      'content',
      page ? msg(page.description) : msg('Bu adreste bir belge yok. Soldaki menüden ya da aramadan bulabilirsin.')
    );
    const section = pendingSection.current;
    pendingSection.current = null;
    if (section) document.getElementById(section)?.scrollIntoView();
  }, [page, language]);

  return (
    <DocsNavigate.Provider value={navigate}>
      <div className="min-h-dvh bg-paper">
        <a href="#docs-article" className="skip-link">
          {msg("\n          İçeriğe geç\n        ")}</a>
        <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
            <button type="button" className="icon-btn -ml-1 lg:hidden" onClick={() => setMenuOpen(true)} aria-label={msg("Menüyü aç")}>
              <Menu aria-hidden="true" />
            </button>
            <a href={LANDING_PATH} className="flex shrink-0 items-center gap-2 rounded-[10px]" aria-label={msg("Yetişir ana sayfası")}>
              <BrandMark size={26} />
              <Wordmark className="text-[15.5px] max-sm:hidden" />
            </a>
            <span className="rounded-full border border-line-strong px-2 py-0.5 text-[12px] font-semibold text-ink-2">{msg("Belgeler")}</span>
            <div className="ml-auto flex min-w-0 flex-1 justify-end sm:justify-center">
              <SearchBox onGo={p => navigate(p.slug)} />
            </div>
            <a href={APP_PATH} className="btn btn-secondary btn-sm shrink-0 max-md:hidden">
              {msg("\n              Uygulamaya git\n              ")}<ArrowUpRight aria-hidden="true" />
            </a>
          </div>
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={msg("Belgeler menüsü")}>
            <button type="button" className="absolute inset-0 bg-paper/70 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-label={msg("Menüyü kapat")} />
            <div className="absolute inset-y-0 left-0 w-[290px] overflow-y-auto border-r border-line bg-card px-3 py-4">
              <div className="mb-4 flex items-center justify-between px-3">
                <span className="text-[14px] font-semibold text-ink">{msg("Belgeler")}</span>
                <button type="button" className="icon-btn" onClick={() => setMenuOpen(false)} aria-label={msg("Menüyü kapat")}>
                  <X aria-hidden="true" />
                </button>
              </div>
              <Sidebar current={slug} onGo={navigate} />
              <a href={APP_PATH} className="btn btn-secondary mt-6 w-full">
                {msg("\n                Uygulamaya git\n              ")}</a>
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-[1440px] gap-10 px-4 sm:px-6">
          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[240px] shrink-0 overflow-y-auto py-8 lg:block">
            <Sidebar current={slug} onGo={navigate} />
          </aside>

          <main id="docs-article" tabIndex={-1} className="min-w-0 flex-1 py-10 outline-none lg:py-12">
            <article className="mx-auto max-w-[720px]">
              {page ? (
                <>
                  <p className="text-[13px] font-semibold text-forest">{msg(page.group)}</p>
                  <h1 className="mt-2 text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[38px]">{msg(page.title)}</h1>
                  <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{msg(page.description)}</p>
                  <hr className="my-8 border-line" />
                  <div key={page.slug} className="docs-prose">
                    <page.Body />
                  </div>
                  <nav aria-label={msg("Önceki ve sonraki sayfa")} className="mt-16 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
                    {prev ? (
                      <a
                        href={docsHref(prev.slug)}
                        onClick={event => {
                          if (event.metaKey || event.ctrlKey || event.button !== 0) return;
                          event.preventDefault();
                          navigate(prev.slug);
                        }}
                        className="group rounded-[12px] border border-line px-4 py-3 transition-colors hover:border-line-strong"
                      >
                        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
                          <ArrowLeft className="size-3.5" aria-hidden="true" />
                          {msg("\n                          Önceki\n                        ")}</span>
                        <span className="mt-1 block text-[15px] font-medium text-ink">{msg(prev.title)}</span>
                      </a>
                    ) : (
                      <span />
                    )}
                    {next && (
                      <a
                        href={docsHref(next.slug)}
                        onClick={event => {
                          if (event.metaKey || event.ctrlKey || event.button !== 0) return;
                          event.preventDefault();
                          navigate(next.slug);
                        }}
                        className="group rounded-[12px] border border-line px-4 py-3 text-right transition-colors hover:border-line-strong"
                      >
                        <span className="flex items-center justify-end gap-1.5 text-[12.5px] text-ink-3">
                          {msg("\n                          Sonraki\n                          ")}<ArrowRight className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="mt-1 block text-[15px] font-medium text-ink">{msg(next.title)}</span>
                      </a>
                    )}
                  </nav>
                </>
              ) : (
                <div className="py-16">
                  <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-ink">{msg("Sayfa bulunamadı")}</h1>
                  <p className="mt-3 text-[16px] text-ink-2">{msg("Bu adreste bir belge yok. Soldaki menüden ya da aramadan bulabilirsin.")}</p>
                  <button type="button" className="btn btn-secondary mt-6" onClick={() => navigate('')}>
                    {msg("\n                    Belgelerin başına dön\n                  ")}</button>
                </div>
              )}
            </article>
          </main>

          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[220px] shrink-0 overflow-y-auto py-12 xl:block" aria-label={msg("Bu sayfada")}>
            {entries.length > 0 && (
              <>
                <p className="text-[12px] font-semibold tracking-[0.02em] text-ink-3">{msg("Bu sayfada")}</p>
                <ul className="mt-3 space-y-1 border-l border-line">
                  {entries.map(entry => (
                    <li key={entry.id}>
                      <a
                        href={`#${entry.id}`}
                        className={`-ml-px block border-l py-1 text-[13px] transition-colors ${entry.level === 3 ? 'pl-6' : 'pl-3.5'} ${
                          active === entry.id ? 'border-forest text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'
                        }`}
                      >
                        {entry.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      </div>
    </DocsNavigate.Provider>
  );
}
