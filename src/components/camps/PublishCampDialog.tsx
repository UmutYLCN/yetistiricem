import { useEffect, useId, useState } from 'react';
import { CircleCheck, Compass, LoaderCircle, LogIn, TriangleAlert, Upload } from 'lucide-react';
import type { StudyCamp } from '../../types';
import { shareSummary, toSharedCamp } from '../../lib/campShare';
import type { CatalogEntry } from '../../lib/catalog';
import { MAX_DESCRIPTION, MAX_PUBLISHED_NAME, publishRow } from '../../lib/catalog';
import { findPublication, publishCamp } from '../../lib/catalogApi';
import type { AccountState } from '../../hooks/useCatalogAccount';
import { AuthorBadge } from '../discover/AuthorBadge';
import { Dialog } from '../ui/Dialog';

interface Props {
  camp: StudyCamp;
  account: AccountState;
  onSignIn: () => void;
  onRename: () => void;
  onClose: () => void;
  /** Opens the published entry in Keşfet. */
  onView: (entry: CatalogEntry) => void;
  onPublished: (entry: CatalogEntry, updated: boolean) => void;
}

type Existing = { status: 'loading' } | { status: 'ready'; entry: CatalogEntry | null };

/**
 * "Keşfet’te yayınla": the camp's name, tempo, branches and videos become a
 * public entry under the student's name. Publishing the same camp again
 * updates that entry.
 */
export function PublishCampDialog({ camp, account, onSignIn, onRename, onClose, onView, onPublished }: Props) {
  const uid = useId();
  const { shared, leftOut } = toSharedCamp(camp);
  const summary = shareSummary(shared);
  const userId = account.status === 'signed-in' ? account.userId : null;
  const [existing, setExisting] = useState<Existing>({ status: 'loading' });
  const [name, setName] = useState(camp.name);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CatalogEntry | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void findPublication(camp.id, userId).then(result => {
      if (cancelled) return;
      const entry = result.ok ? result.data : null;
      setExisting({ status: 'ready', entry });
      if (entry) {
        setName(entry.name);
        setDescription(entry.description);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [camp.id, userId]);

  const publish = async () => {
    if (!name.trim()) {
      setError('Kampa bir ad ver.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await publishCamp(publishRow(camp, shared, { name, description }));
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(result.data);
    onPublished(result.data, existing.status === 'ready' && existing.entry !== null);
  };

  const updating = existing.status === 'ready' && existing.entry !== null;
  let body;
  let footer;
  if (account.status === 'off') {
    body = <p className="text-[14px] text-ink-2">Keşfet bu sunucuda kurulmamış; kamp yayınlanamıyor.</p>;
    footer = (
      <button type="button" className="btn btn-primary" onClick={onClose}>
        Tamam
      </button>
    );
  } else if (shared.branches.length === 0) {
    body = (
      <p className="callout callout-warn text-[13.5px] text-ink-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
        <span>Bu kampta yayınlanabilecek branş yok. Örnek ve eski sürümden kalan veriler yayınlanmaz.</span>
      </p>
    );
    footer = (
      <button type="button" className="btn btn-primary" onClick={onClose}>
        Tamam
      </button>
    );
  } else if (account.status !== 'signed-in') {
    body = (
      <div className="flex flex-col items-center py-4 text-center">
        <span className="grid size-12 place-items-center rounded-[14px] bg-sunk text-ink-2" aria-hidden="true">
          <Compass className="size-6" />
        </span>
        <p className="mt-4 font-semibold text-ink">Yayınlamak için giriş yap</p>
        <p className="mt-1 max-w-[22rem] text-[13.5px] text-ink-2">
          Kampın Keşfet’te senin adınla görünür; sonra güncelleyebilir ya da kaldırabilirsin.
        </p>
      </div>
    );
    footer = (
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Vazgeç
        </button>
        <button type="button" className="btn btn-primary" onClick={onSignIn} disabled={account.status === 'loading' || account.status === 'idle'}>
          <LogIn aria-hidden="true" />
          Giriş yap
        </button>
      </>
    );
  } else if (done) {
    body = (
      <div className="flex flex-col items-center py-4 text-center">
        <span className="grid size-12 place-items-center rounded-[14px] bg-forest-soft text-forest" aria-hidden="true">
          <CircleCheck className="size-6" />
        </span>
        <p className="mt-4 font-semibold text-ink">{updating ? 'Kampın güncellendi' : 'Kampın Keşfet’te yayında'}</p>
        <p className="mt-1 max-w-[22rem] text-[13.5px] text-ink-2">Herkes inceleyip kendi planına ekleyebilir.</p>
      </div>
    );
    footer = (
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Kapat
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onView(done)} data-autofocus>
          <Compass aria-hidden="true" />
          Keşfet’te gör
        </button>
      </>
    );
  } else {
    body =
      existing.status === 'loading' ? (
        <p className="flex items-center gap-2 py-6 text-[14px] text-ink-2">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Hazırlanıyor…
        </p>
      ) : (
        <div className="space-y-4">
          {updating && (
            <p className="callout callout-info text-[13.5px] text-ink-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
              <span>Bu kamp Keşfet’te yayında. Yeniden yayınlarsan içeriği güncellenir.</span>
            </p>
          )}
          <div>
            <label htmlFor={`${uid}-name`} className="field-label">
              Kampın adı
            </label>
            <input
              id={`${uid}-name`}
              className="input"
              value={name}
              maxLength={MAX_PUBLISHED_NAME}
              onChange={event => setName(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-description`} className="field-label">
              Açıklama <span className="font-normal text-ink-3">(isteğe bağlı)</span>
            </label>
            <textarea
              id={`${uid}-description`}
              className="input"
              value={description}
              maxLength={MAX_DESCRIPTION}
              placeholder="Kimler için? Nasıl çalışmalı? Örn. TYT’ye 3 ay kala, her gün 3 saat."
              onChange={event => setDescription(event.target.value)}
            />
            <p className="field-hint tnum">
              {description.length}/{MAX_DESCRIPTION}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-ink-2">
            Yayınlayan:
            <AuthorBadge name={account.displayName ?? '…'} size="sm" />
            <button type="button" className="font-semibold text-forest underline" onClick={onRename}>
              Adını değiştir
            </button>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-ink-2">
            <li>
              Yayınlanan: {summary.branches} branş, {summary.videos} video ve kampın temposu.
            </li>
            <li>Yayınlanmayan: ilerlemen, notların, ileri taşımaların ve e-posta adresin.</li>
            {leftOut > 0 && <li>{leftOut} branş örnek ya da eski sürüm verisi olduğu için eklenmedi.</li>}
          </ul>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
      );
    footer = (
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Vazgeç
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void publish()} disabled={busy || existing.status === 'loading'}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
          {updating ? 'Güncelle' : 'Yayınla'}
        </button>
      </>
    );
  }

  return (
    <Dialog open onClose={onClose} width={540} eyebrow="Keşfet’te yayınla" title={camp.name} dismissOnBackdrop={false} footer={footer}>
      {body}
    </Dialog>
  );
}
