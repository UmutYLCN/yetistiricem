import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.getClientRects().length > 0);
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Stays above the scrolling body, under the title (e.g. a step indicator). */
  subheader?: ReactNode;
  /** Panel width in px on larger screens. */
  width?: number;
  /** Keep the panel at full height on larger screens (multi-step flows, so it does not jump). */
  tall?: boolean;
  /** Element to focus on open; defaults to `[data-autofocus]`, then the first control. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Close when the backdrop is clicked. Off for forms, so a stray click keeps the input. */
  dismissOnBackdrop?: boolean;
  tone?: 'default' | 'danger';
}

/**
 * Modal dialog on the native <dialog> element: the page behind is inert,
 * Tab and Shift+Tab cycle inside the dialog, Escape closes it, and focus
 * returns to the control that opened it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  subheader,
  width = 560,
  tall = false,
  initialFocus,
  dismissOnBackdrop = true,
  tone = 'default',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    openRef.current = open;
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      const target =
        initialFocus?.current ?? dialog.querySelector<HTMLElement>('[data-autofocus]') ?? focusables(dialog)[0] ?? dialog;
      target.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      restoreFocus(returnTo.current);
      returnTo.current = null;
    }
  }, [open, initialFocus]);

  // Unmounted while open (the parent dropped it): still hand focus back.
  useEffect(
    () => () => {
      if (openRef.current && returnTo.current) restoreFocus(returnTo.current);
    },
    []
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const dialog = ref.current;
    if (!dialog) return;
    const items = focusables(dialog);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleMouseDown = (event: MouseEvent<HTMLDialogElement>) => {
    if (dismissOnBackdrop && event.target === event.currentTarget) onCloseRef.current();
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={event => {
        event.preventDefault();
        onCloseRef.current();
      }}
      onClose={() => {
        // Closed by the browser itself (e.g. a repeated Escape): sync state.
        if (openRef.current) onCloseRef.current();
      }}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
    >
      {open && (
        <div className={`dialog-panel ${tall ? 'dialog-panel-tall' : ''}`} style={{ ['--dialog-width' as string]: `${width}px` }}>
          <header className="flex items-start gap-4 px-6 pt-5 pb-4 max-sm:px-4">
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className={`font-display text-[22px] leading-tight ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}
              >
                {title}
              </h2>
              {description && (
                <div id={descriptionId} className="mt-1.5 text-[14px] text-ink-2">
                  {description}
                </div>
              )}
            </div>
            <button type="button" className="icon-btn -mr-2 -mt-1" onClick={() => onCloseRef.current()} aria-label="Kapat">
              <X aria-hidden="true" />
            </button>
          </header>
          {subheader && <div className="border-b border-line px-6 pb-3.5 max-sm:px-4">{subheader}</div>}
          <div className="dialog-body flex-1">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-card px-6 py-4 max-sm:px-4">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

function restoreFocus(target: HTMLElement | null) {
  requestAnimationFrame(() => {
    if (target && target !== document.body && target.isConnected) {
      target.focus();
      if (document.activeElement === target) return;
    }
    // The opener is gone (or was never focused): keep focus in the page, not on <body>.
    document.getElementById('main')?.focus({ preventScroll: true });
  });
}
