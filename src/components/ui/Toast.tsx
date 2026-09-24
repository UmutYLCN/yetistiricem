import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Info, X } from 'lucide-react';

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'success' | 'info';
}

type Notify = (options: ToastOptions) => void;

const ToastContext = createContext<Notify | null>(null);

// eslint-disable-next-line react/only-export-components
export function useToast(): Notify {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast needs <ToastProvider>');
  return notify;
}

const DURATION_MS = 6000;

/** One toast at a time, announced politely, with an optional undo-style action. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const [paused, setPaused] = useState(false);
  const counter = useRef(0);

  const notify = useCallback<Notify>(options => {
    counter.current += 1;
    setToast({ ...options, id: counter.current });
  }, []);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(() => setToast(null), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast, paused]);

  const Icon = toast?.tone === 'info' ? Info : Check;

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+84px)] lg:justify-end lg:px-8 lg:pb-8"
        role="status"
        aria-live="polite"
      >
        {toast && (
          <div
            key={toast.id}
            className="toast-enter pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-[14px] bg-ink py-2.5 pr-2 pl-4 text-[14px] text-white shadow-[var(--shadow-pop)]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <Icon className="size-4 shrink-0 text-[#9fd3b6]" aria-hidden="true" />
            <p className="min-w-0 flex-1 leading-snug">{toast.message}</p>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-[13px] font-semibold text-[#ffc59c] hover:bg-white/10"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setToast(null)}
              aria-label="Bildirimi kapat"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
