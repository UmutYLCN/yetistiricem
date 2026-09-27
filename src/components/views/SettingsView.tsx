import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Briefcase, Download, Eye, GraduationCap, Layers, LogOut, Pencil, RotateCcw, Target, Upload } from 'lucide-react';
import type { AccountState } from '../../hooks/useAccount';
import type { ApiResult } from '../../lib/catalogApi';
import { MAX_DISPLAY_NAME, displayNameProblem } from '../../lib/catalog';
import type { ProfileFact, StudentProfile } from '../../lib/studentProfile';
import { EMPTY_PROFILE, isAvatarShape, profileFacts } from '../../lib/studentProfile';
import { PageHeader } from '../layout/PageHeader';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { SHAPE_ART } from '../profile/shapeArt';
import { AvatarPicker, BioField, StageChip, StageFields, StagePicker } from '../profile/ProfileForm';
import { AiConnections } from '../settings/AiConnections';

type SignedIn = Extract<AccountState, { status: 'signed-in' }>;

interface Props {
  account: AccountState;
  today: string;
  onRename: (name: string) => Promise<ApiResult<string>>;
  onSaveProfile: (profile: StudentProfile) => Promise<ApiResult<StudentProfile>>;
  onUploadAvatar: (blob: Blob, extension: 'webp' | 'jpg') => Promise<ApiResult<string>>;
  onSignOut: () => void;
  isDemo: boolean;
  campCount: number;
  onBackup: () => void;
  onRestoreFile: (file: File) => void;
  onReset: () => void;
  onStartDemo: () => void;
  onExitDemo: () => void;
}

const FACT_ICONS: Record<ProfileFact['kind'], LucideIcon> = {
  school: GraduationCap,
  department: BookOpen,
  grade: Layers,
  profession: Briefcase,
  target: Target,
};

/** The profile card: picture, name and school details, edited in place. */
function ProfileCard({ account, onRename, onSaveProfile, onUploadAvatar }: { account: SignedIn } & Pick<Props, 'onRename' | 'onSaveProfile' | 'onUploadAvatar'>) {
  const uid = useId();
  const profile = account.profile ?? EMPTY_PROFILE;
  const name = account.displayName ?? account.email?.split('@')[0] ?? 'Sen';
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draft, setDraft] = useState<StudentProfile>(profile);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startEditing = () => {
    setDraftName(account.displayName ?? '');
    setDraft(profile);
    setNameError(null);
    setError(null);
    setEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const problem = displayNameProblem(draftName);
    if (problem) {
      setNameError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    if (draftName.trim() !== (account.displayName ?? '')) {
      const renamed = await onRename(draftName);
      if (!renamed.ok) {
        setBusy(false);
        setNameError(renamed.error);
        return;
      }
    }
    const result = await onSaveProfile({ ...draft, onboardedAt: profile.onboardedAt ?? new Date().toISOString() });
    setBusy(false);
    if (result.ok) setEditing(false);
    else setError(result.error);
  };

  const shown = editing ? draft.avatar : profile.avatar;
  const tint = isAvatarShape(shown) ? SHAPE_ART[shown].color : 'var(--color-forest)';
  const facts = profileFacts(profile);

  return (
    <section className="card overflow-hidden" aria-labelledby={`${uid}-title`}>
      <div
        className="profile-cover h-24 sm:h-28"
        style={{ ['--profile-tint' as string]: tint }}
        aria-hidden="true"
      />
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="-mt-11 flex items-end justify-between gap-3">
          <span className="rounded-full bg-card p-1">
            <ProfileAvatar avatar={shown} name={editing ? draftName || name : name} size={88} />
          </span>
          {!editing && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={startEditing}>
              <Pencil aria-hidden="true" />
              Profili düzenle
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={event => void save(event)} noValidate className="mt-5 space-y-6">
            <h2 id={`${uid}-title`} className="text-[18px] font-semibold text-ink">
              Profili düzenle
            </h2>
            <div>
              <p className="field-label">Profil resmi</p>
              <AvatarPicker preview={false} value={draft.avatar} name={draftName || name} onChange={avatar => setDraft(d => ({ ...d, avatar }))} onUpload={onUploadAvatar} />
            </div>
            <div>
              <label htmlFor={`${uid}-name`} className="field-label">
                Görünen ad
              </label>
              <input
                id={`${uid}-name`}
                className="input"
                value={draftName}
                maxLength={MAX_DISPLAY_NAME}
                onChange={event => {
                  setDraftName(event.target.value);
                  setNameError(null);
                }}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={`${uid}-name-note`}
              />
              {nameError ? (
                <p id={`${uid}-name-note`} className="field-error" role="alert">
                  {nameError}
                </p>
              ) : (
                <p id={`${uid}-name-note`} className="field-hint">
                  Keşfet’te kamplarının yanında adın, resmin, durumun, bölümün ya da mesleğin ve Hakkında yazın görünür; okulun, sınıfın ve e-postan gösterilmez.
                </p>
              )}
            </div>
            <StagePicker value={draft.stage} onChange={stage => setDraft(d => ({ ...d, stage }))} />
            <StageFields profile={draft} onChange={(field, value) => setDraft(d => ({ ...d, [field]: value }))} />
            <BioField value={draft.bio} onChange={bio => setDraft(d => ({ ...d, bio }))} />
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)} disabled={busy}>
                Vazgeç
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-3">
            <h2 id={`${uid}-title`} className="font-display truncate text-[24px] leading-tight text-ink">
              {account.displayName ?? '…'}
            </h2>
            {account.email && <p className="mt-0.5 truncate text-[13.5px] text-ink-3">{account.email}</p>}
            {profile.bio && <p className="mt-3 max-w-[60ch] text-[14.5px] leading-relaxed break-words whitespace-pre-line text-ink-2">{profile.bio}</p>}
            {profile.stage ? (
              <>
                <StageChip stage={profile.stage} className="mt-3" />
                {facts.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-ink-2">
                    {facts.map(fact => {
                      const Icon = FACT_ICONS[fact.kind];
                      return (
                        <li key={`${fact.kind}-${fact.text}`} className="flex min-w-0 items-center gap-1.5">
                          <Icon className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                          <span className="min-w-0 truncate">{fact.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                className="mt-4 flex w-full items-center gap-3 rounded-[12px] border border-dashed border-line-strong px-4 py-3 text-left transition-colors hover:border-ink-3 hover:bg-sunk/50"
              >
                <GraduationCap className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[13.5px] text-ink-2">
                  <span className="block font-semibold text-ink">Okulunu ve bölümünü ekle</span>
                  Lise, üniversite ya da meslek: seni tanımamıza yardım eder.
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Profile, AI connections and data. Each camp's tempo is edited from the camp itself. */
export function SettingsView({ account, today, onRename, onSaveProfile, onUploadAvatar, onSignOut, isDemo, campCount, onBackup, onRestoreFile, onReset, onStartDemo, onExitDemo }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <PageHeader title="Profil ve ayarlar" subtitle={isDemo ? 'Demo açık: buradaki değişiklikler kaydedilmez.' : 'Sen, yapay zekâ bağlantıların ve verilerin.'} />

      {account.status === 'signed-in' && <ProfileCard key={account.userId} account={account} onRename={onRename} onSaveProfile={onSaveProfile} onUploadAvatar={onUploadAvatar} />}

      {account.status === 'signed-in' && <AiConnections today={today} />}

      <section className="card" aria-labelledby={`${uid}-data`}>
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <h2 id={`${uid}-data`} className="text-[16px] font-semibold text-ink">
            Verilerin
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Kampların, ilerlemen ve notların hesabına kaydedilir; hangi cihazdan girersen gir planın seninle. İstersen hepsini bir
            dosyaya yedekleyebilirsin.
          </p>
        </div>
        <ul className="divide-y divide-line">
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">Yedek indir</p>
              <p className="text-[13px] text-ink-2">Tüm kampların (branşları ve tempolarıyla), tamamlananlar, ileri taşımalar ve notlar tek bir JSON dosyasında.</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={onBackup} disabled={isDemo}>
              <Download aria-hidden="true" />
              İndir
            </button>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">Yedekten geri yükle</p>
              <p className="text-[13px] text-ink-2">Dosya kontrol edilir ve onayından sonra mevcut verilerin yerine geçer.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onRestoreFile(file);
              }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={isDemo}>
              <Upload aria-hidden="true" />
              Dosya seç
            </button>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">Demo önizleme</p>
              <p className="text-[13px] text-ink-2">
                {isDemo
                  ? 'Şu an örnek bir plana bakıyorsun. Çıkınca kendi verilerine dönersin.'
                  : 'Örnek bir planla uygulamayı dene. Verilerine dokunmaz, hiçbir şey kaydedilmez.'}
              </p>
            </div>
            {isDemo ? (
              <button type="button" className="btn btn-secondary" onClick={onExitDemo}>
                <LogOut aria-hidden="true" />
                Demodan çık
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={onStartDemo}>
                <Eye aria-hidden="true" />
                Demoyu aç
              </button>
            )}
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-danger">Tüm verileri sıfırla</p>
              <p className="text-[13px] text-ink-2">
                {campCount > 0 ? `${campCount} kamp, ilerlemen ve notların silinir.` : 'Hesabındaki tüm kayıtlar silinir.'} Geri
                alınamaz.
              </p>
            </div>
            <button type="button" className="btn btn-danger-quiet" onClick={onReset} disabled={isDemo}>
              <RotateCcw aria-hidden="true" />
              Sıfırla
            </button>
          </li>
        </ul>
        {isDemo && (
          <p className="border-t border-line px-5 py-3 text-[12.5px] text-ink-3 sm:px-6">
            Demo açıkken yedekleme, geri yükleme ve sıfırlama kapalı.
          </p>
        )}
      </section>

      {account.status === 'signed-in' && (
        <section className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6" aria-label="Oturum">
          <p className="min-w-0 flex-1 text-[13px] text-ink-2">
            <span className="text-ink-3">Giriş yapılan hesap: </span>
            <span className="break-all text-ink">{account.email ?? account.displayName ?? '…'}</span>
          </p>
          <button type="button" className="btn btn-secondary hover:text-danger" onClick={onSignOut}>
            <LogOut aria-hidden="true" />
            Çıkış yap
          </button>
        </section>
      )}
    </div>
  );
}
