import type { MouseEvent, ReactNode } from 'react';
import { useContext, useState } from 'react';
import { ArrowRight, Check, Copy, Info, Lightbulb, TriangleAlert } from 'lucide-react';
import { docsHref } from '../../lib/routes';
import { DocsNavigate } from './navigate';

// The pieces docs pages are written with (`content.tsx`). Text is styled by
// `.docs-prose` (index.css); these add what plain text cannot: section
// anchors, steps, callouts, copyable code and links between pages.


export function DocLink({ to, section, children }: { to: string; section?: string; children: ReactNode }) {
  const navigate = useContext(DocsNavigate);
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to, section);
  };
  return (
    <a href={docsHref(to, section)} onClick={onClick}>
      {children}
    </a>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="group flex items-center gap-2">
      {children}
      <a href={`#${id}`} className="text-ink-3 no-underline opacity-0 transition-opacity group-hover:opacity-100" aria-label="Bu bölümün bağlantısı">
        #
      </a>
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return <h3 id={id}>{children}</h3>;
}

const CALLOUT = {
  info: { icon: Info, box: 'border-line-strong bg-sunk', tint: 'text-ink-2' },
  tip: { icon: Lightbulb, box: 'border-forest/40 bg-forest-tint', tint: 'text-forest' },
  warn: { icon: TriangleAlert, box: 'border-warn/40 bg-warn-soft', tint: 'text-warn' },
};

export function Callout({ tone = 'info', title, children }: { tone?: keyof typeof CALLOUT; title?: string; children: ReactNode }) {
  const { icon: Icon, box, tint } = CALLOUT[tone];
  return (
    <div className={`not-prose flex gap-3 rounded-[12px] border px-4 py-3.5 text-[14.5px] leading-relaxed ${box}`}>
      <Icon className={`mt-1 size-4 shrink-0 ${tint}`} aria-hidden="true" />
      <div className="min-w-0 text-ink-2">
        {title && <p className="font-semibold text-ink">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  );
}

/** Numbered steps on a line, as docs sites draw a procedure. */
export function Steps({ children }: { children: ReactNode[] }) {
  return (
    <ol className="!list-none !pl-0">
      {children.map((step, i) => (
        <li key={i} className="relative !mt-0 pb-6 pl-11 last:pb-0">
          {i < children.length - 1 && <span className="absolute top-8 bottom-1 left-[13px] w-px bg-line-strong" aria-hidden="true" />}
          <span className="tnum absolute top-0.5 left-0 grid size-7 place-items-center rounded-full border border-line-strong bg-sunk text-[12.5px] font-semibold text-ink">
            {i + 1}
          </span>
          <div className="text-ink-2">{step}</div>
        </li>
      ))}
    </ol>
  );
}

export function CodeBlock({ children, label }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The text stays selectable.
    }
  };
  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-field">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-1.5">
        <span className="text-[12px] text-ink-3">{label ?? 'Kopyala'}</span>
        <button type="button" onClick={() => void copy()} className="flex items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-[12px] text-ink-3 hover:text-ink">
          {copied ? <Check className="size-3.5 text-forest" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-ink">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/** A card linking to another page, for "where next" grids. */
export function PageCard({ to, title, children, icon }: { to: string; title: string; children: ReactNode; icon?: ReactNode }) {
  const navigate = useContext(DocsNavigate);
  return (
    <a
      href={docsHref(to)}
      onClick={event => {
        if (event.metaKey || event.ctrlKey || event.button !== 0) return;
        event.preventDefault();
        navigate(to);
      }}
      className="group flex flex-col gap-1.5 rounded-[14px] border border-line bg-card p-4 !no-underline transition-colors hover:border-line-strong hover:bg-sunk/60"
    >
      <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        {icon}
        {title}
        <ArrowRight className="ml-auto size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
      <span className="text-[13.5px] leading-relaxed text-ink-2">{children}</span>
    </a>
  );
}

export function Cards({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}
