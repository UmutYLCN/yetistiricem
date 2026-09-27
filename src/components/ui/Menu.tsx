import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  /** Draws a divider above the item. */
  separated?: boolean;
}

const PANEL_WIDTH = 220;

/**
 * A "⋯" button with a small action menu. The panel is fixed to the viewport
 * under the button (so no card clips it), closes on Escape, an outside click,
 * scrolling or a choice, and hands focus back to the button. Arrow keys move
 * between items.
 */
export function Menu({ label, items, className = '' }: { label: string; items: MenuItem[]; className?: string }) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8));
    const below = rect.bottom + 6;
    const height = panelRef.current?.offsetHeight ?? 0;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
    setPosition({ top, left });
    panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const closeAndReturn = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = entries.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndReturn();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      entries[(at + 1) % entries.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      entries[(at - 1 + entries.length) % entries.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      entries[event.key === 'Home' ? 0 : entries.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`icon-btn size-9 ${open ? 'bg-sunk text-ink' : ''} ${className}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(value => !value)}
      >
        <MoreHorizontal aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={id}
          role="menu"
          aria-label={label}
          className="menu-panel"
          style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, width: PANEL_WIDTH }}
          onKeyDown={onKeyDown}
        >
          {items.map(item => (
            <div key={item.label} role="none">
              {item.separated && <div className="my-1 h-px bg-line" role="separator" />}
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`menu-item ${item.tone === 'danger' ? 'menu-item-danger' : ''}`}
                onClick={() => {
                  closeAndReturn();
                  item.onSelect();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
