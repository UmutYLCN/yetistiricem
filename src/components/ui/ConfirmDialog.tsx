import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Dialog } from './Dialog';

export interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  /** A notice with a single button (resolves true). */
  hideCancel?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

// eslint-disable-next-line react/only-export-components
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm needs <ConfirmProvider>');
  return confirm;
}

/** One app-wide confirmation dialog, opened with `await confirm({...})`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<Confirm>(
    options =>
      new Promise<boolean>(resolve => {
        setRequest({ ...options, resolve });
      }),
    []
  );

  const settle = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  const danger = request?.tone === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={request !== null}
        onClose={() => settle(false)}
        title={request?.title ?? ''}
        width={460}
        tone={danger ? 'danger' : 'default'}
        initialFocus={danger ? cancelRef : undefined}
        footer={
          <>
            {!request?.hideCancel && (
              <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={() => settle(false)}>
                {request?.cancelLabel ?? 'Vazgeç'}
              </button>
            )}
            <button
              type="button"
              className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => settle(true)}
              data-autofocus={danger ? undefined : true}
            >
              {request?.confirmLabel}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-[14.5px] text-ink-2">{request?.body}</div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
