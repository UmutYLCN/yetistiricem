import { useEffect, useRef, useState } from 'react';
import { Check, Copy, LoaderCircle, Share2, TriangleAlert } from 'lucide-react';
import type { StudyCamp } from '../../types';
import { encodeCampShare, shareSummary, toSharedCamp } from '../../lib/campShare';
import { campImportUrl } from '../../lib/routes';
import { Dialog } from '../ui/Dialog';

/** Links longer than this may be cut by some chat apps. */
const LONG_LINK = 8000;

type LinkState = { status: 'loading' } | { status: 'ready'; url: string };

/**
 * A link that opens this camp in anyone's planner (`/app?import=…`): name,
 * tempo, branches and videos, never progress, notes or shifts.
 */
export function ShareCampDialog({ camp, onClose }: { camp: StudyCamp; onClose: () => void }) {
  const [link, setLink] = useState<LinkState>({ status: 'loading' });
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { shared, leftOut } = toSharedCamp(camp);
  const summary = shareSummary(shared);
  const empty = shared.branches.length === 0;

  useEffect(() => {
    let cancelled = false;
    const { shared: fresh } = toSharedCamp(camp);
    if (fresh.branches.length === 0) return;
    void encodeCampShare(fresh).then(payload => {
      if (!cancelled) setLink({ status: 'ready', url: campImportUrl(payload) });
    });
    return () => {
      cancelled = true;
    };
  }, [camp]);

  const copy = async () => {
    if (link.status !== 'ready') return;
    try {
      await navigator.clipboard.writeText(link.url);
    } catch {
      // No clipboard permission: select the link so it can be copied by hand.
      inputRef.current?.select();
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <Dialog
      open
      onClose={onClose}
      width={540}
      eyebrow="Kampı paylaş"
      title={camp.name}
      description="Bağlantıyı açan kişi bu kampı kendi planına ekleyebilir."
      footer={
        <>
          {canShare && link.status === 'ready' && (
            <button
              type="button"
              className="btn btn-ghost mr-auto"
              onClick={() => void navigator.share({ title: camp.name, url: link.url }).catch(() => {})}
            >
              <Share2 aria-hidden="true" />
              Paylaş…
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Kapat
          </button>
          <button type="button" className="btn btn-primary" disabled={link.status !== 'ready'} onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}
          </button>
        </>
      }
    >
      {empty ? (
        <p className="callout callout-warn text-[13.5px] text-ink-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <span>Bu kampta paylaşılabilecek branş yok. Örnek ve eski sürümden kalan veriler paylaşılmaz.</span>
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="share-link" className="field-label">
              Paylaşım bağlantısı
            </label>
            {link.status === 'loading' ? (
              <p className="flex h-[42px] items-center gap-2 text-[13.5px] text-ink-3">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Bağlantı hazırlanıyor…
              </p>
            ) : (
              <input
                ref={inputRef}
                id="share-link"
                className="input tnum text-[13px]"
                readOnly
                value={link.url}
                onFocus={event => event.currentTarget.select()}
              />
            )}
            {link.status === 'ready' && link.url.length > LONG_LINK && (
              <p className="field-hint">Bağlantı uzun ({link.url.length.toLocaleString('tr-TR')} karakter); bazı mesajlaşma uygulamaları kırpabilir.</p>
            )}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-ink-2">
            <li>
              Paylaşılan: {summary.branches} branş, {summary.videos} video ve kampın temposu.
            </li>
            <li>Paylaşılmayan: ilerlemen, notların ve ileri taşımaların.</li>
            {leftOut > 0 && <li>{leftOut} branş örnek ya da eski sürüm verisi olduğu için bağlantıya eklenmedi.</li>}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
