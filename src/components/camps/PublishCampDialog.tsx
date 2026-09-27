import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleCheck, Compass, ImageUp, LoaderCircle, LogIn, Trash2, TriangleAlert, Upload } from 'lucide-react';
import type { StudyCamp } from '../../types';
import { isImportedCamp, shareSummary, toSharedCamp } from '../../lib/campShare';
import type { CatalogEntry } from '../../lib/catalog';
import { MAX_DESCRIPTION, MAX_PUBLISHED_NAME, publishRow, suggestTags } from '../../lib/catalog';
import { findPublication, publishCamp, removeUnusedCovers, uploadCampCover } from '../../lib/catalogApi';
import { coverFromFile } from '../../lib/avatarImage';
import type { AccountState } from '../../hooks/useAccount';
import { AuthorBadge } from '../discover/AuthorBadge';
import { CoverImage } from '../discover/CampCover';
import { TagInput } from '../discover/TagInput';
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
 * updates that entry. A camp added from Keşfet or a share link is someone
 * else's work and is refused (the database also refuses a second author for
 * the same videos).
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
  // Two steps: the cover, name and description, then the interest tags.
  const [step, setStep] = useState<0 | 1>(0);
  const [tags, setTags] = useState<string[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
        setTags(entry.tags);
        setCover(entry.cover);
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
    const result = await publishCamp(publishRow(camp, shared, { name, description, tags, cover }));
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (userId) void removeUnusedCovers(userId);
    setDone(result.data);
    onPublished(result.data, existing.status === 'ready' && existing.entry !== null);
  };

  const pickCover = async (file: File) => {
    if (!userId) return;
    setCoverBusy(true);
    setCoverError(null);
    const prepared = await coverFromFile(file);
    if (!prepared.ok) {
      setCoverBusy(false);
      setCoverError(prepared.error);
      return;
    }
    const uploaded = await uploadCampCover(userId, prepared.blob, prepared.extension);
    setCoverBusy(false);
    if (uploaded.ok) setCover(uploaded.data);
    else setCoverError(uploaded.error);
  };

  const next = () => {
    if (!name.trim()) {
      setError('Kampa bir ad ver.');
      return;
    }
    setError(null);
    setStep(1);
  };

  const updating = existing.status === 'ready' && existing.entry !== null;
  let body;
  let footer;
  // Only the publish form itself has the two steps.
  let stepped = false;
  if (account.status === 'off') {
    body = <p className="text-[14px] text-ink-2">Keşfet bu sunucuda kurulmamış; kamp yayınlanamıyor.</p>;
    footer = (
      <button type="button" className="btn btn-primary" onClick={onClose}>
        Tamam
      </button>
    );
  } else if (isImportedCamp(camp)) {
    body = (
      <p className="callout callout-warn text-[13.5px] text-ink-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
        <span>
          Bu kampı {camp.origin === 'kesfet' ? 'Keşfet’ten' : 'bir paylaşım linkinden'} ekledin; başkasının hazırladığı kamp senin adınla
          yayınlanamaz. Yalnızca kendi oluşturduğun kampları yayınlayabilirsin.
        </span>
      </p>
    );
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
    stepped = true;
    body =
      existing.status === 'loading' ? (
        <p className="flex items-center gap-2 py-6 text-[14px] text-ink-2">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Hazırlanıyor…
        </p>
      ) : step === 0 ? (
        <div className="space-y-4">
          {updating && (
            <p className="callout callout-info text-[13.5px] text-ink-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
              <span>Bu kamp Keşfet’te yayında. Kaydettiğinde içeriği güncellenir.</span>
            </p>
          )}
          <div>
            <p className="field-label">
              Kapak fotoğrafı <span className="font-normal text-ink-3">(isteğe bağlı)</span>
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <CoverImage seed={camp.id} subjects={shared.branches.map(b => b.subject)} cover={cover} className="catalog-thumb shrink-0 sm:w-60">
                {coverBusy && (
                  <span className="absolute inset-0 grid place-items-center bg-paper/60">
                    <LoaderCircle className="size-5 animate-spin text-ink" aria-label="Yükleniyor" />
                  </span>
                )}
              </CoverImage>
              <div className="min-w-0 flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/*"
                  className="visually-hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void pickCover(file);
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={coverBusy}>
                    <ImageUp aria-hidden="true" />
                    {cover ? 'Başka fotoğraf seç' : 'Fotoğraf yükle'}
                  </button>
                  {cover && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCover(null)} disabled={coverBusy}>
                      <Trash2 aria-hidden="true" />
                      Kaldır
                    </button>
                  )}
                </div>
                {coverError ? (
                  <p className="field-error" role="alert">
                    {coverError}
                  </p>
                ) : (
                  <p className="field-hint">Keşfet kartında böyle görünür; fotoğraf 16:10 kırpılır. Yüklemezsen branş renklerinden bir kapak çizilir.</p>
                )}
              </div>
            </div>
          </div>
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
            <AuthorBadge name={account.displayName ?? '…'} avatar={account.profile?.avatar ?? null} size="sm" />
            <button type="button" className="font-semibold text-forest underline" onClick={onRename}>
              Adını değiştir
            </button>
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <TagInput tags={tags} onChange={setTags} suggestions={suggestTags(shared.branches.map(b => b.subject))} hideLabel />
          <ul className="list-disc space-y-1 border-t border-line pt-4 pl-5 text-[13.5px] text-ink-2">
            <li>
              Yayınlanan: {summary.branches} branş, {summary.videos} video, kampın temposu, kapağı ve etiketleri.
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
    footer =
      step === 0 ? (
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn btn-primary" onClick={next} disabled={existing.status === 'loading' || coverBusy}>
            Devam
            <ArrowRight aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-ghost mr-auto" onClick={() => setStep(0)} disabled={busy}>
            <ArrowLeft aria-hidden="true" />
            Geri
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void publish()} disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            {updating ? 'Güncelle' : 'Yayınla'}
          </button>
        </>
      );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      width={560}
      eyebrow={stepped ? `Keşfet’te yayınla · Adım ${step + 1} / 2` : 'Keşfet’te yayınla'}
      title={stepped && step === 1 ? 'İlgi etiketleri' : camp.name}
      description={stepped && step === 1 ? 'Kampın hangi konularla ilgili? Keşfet’te arayanlar bu etiketlerle bulur.' : undefined}
      dismissOnBackdrop={false}
      footer={footer}
    >
      {body}
    </Dialog>
  );
}
