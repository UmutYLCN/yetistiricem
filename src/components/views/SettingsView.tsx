import { useId, useRef } from 'react';
import { Download, Eye, Gauge, LogOut, RotateCcw, Upload } from 'lucide-react';
import type { AccountState } from '../../hooks/useAccount';
import { AuthorBadge } from '../discover/AuthorBadge';
import { PageHeader } from '../layout/PageHeader';

interface Props {
  account: AccountState;
  onRename: () => void;
  onSignOut: () => void;
  isDemo: boolean;
  campCount: number;
  onBackup: () => void;
  onRestoreFile: (file: File) => void;
  onReset: () => void;
  onStartDemo: () => void;
  onExitDemo: () => void;
  onOpenCamps: () => void;
}

/** App-level options. Each camp's tempo is edited from the camp itself. */
export function SettingsView({ account, onRename, onSignOut, isDemo, campCount, onBackup, onRestoreFile, onReset, onStartDemo, onExitDemo, onOpenCamps }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <PageHeader title="Ayarlar" subtitle={isDemo ? 'Demo açık: buradaki değişiklikler kaydedilmez.' : 'Uygulama ve verilerin.'} />

      {account.status === 'signed-in' && (
        <section className="card flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6" aria-labelledby={`${uid}-account`}>
          <div className="min-w-0 flex-1">
            <h2 id={`${uid}-account`} className="eyebrow">
              Hesap
            </h2>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <AuthorBadge name={account.displayName ?? '…'} />
              {account.email && <span className="min-w-0 truncate text-[13px] text-ink-3">{account.email}</span>}
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-3">Görünen adın Keşfet’te yayınladığın kamplarda yer alır; e-postan gösterilmez.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRename}>
              Adını değiştir
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onSignOut}>
              <LogOut aria-hidden="true" />
              Çıkış yap
            </button>
          </div>
        </section>
      )}

      <section className="callout callout-info items-start" aria-labelledby={`${uid}-tempo`}>
        <Gauge className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-[13.5px] text-ink-2">
          <h2 id={`${uid}-tempo`} className="font-semibold text-ink">
            Tempo her kampın kendisine ait
          </h2>
          <p className="mt-0.5">
            Günlük süre, çalışma günleri ve branş yerleşimi kamp kamp ayarlanır; bir kampı değiştirmek diğerlerini etkilemez. Açık
            kampın başlığındaki “Tempoyu düzenle” ile değiştirebilirsin.
          </p>
          {campCount > 0 && (
            <button type="button" className="btn btn-secondary btn-sm mt-2.5" onClick={onOpenCamps}>
              Kamplara git
            </button>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby={`${uid}-data`}>
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <h2 id={`${uid}-data`} className="text-[16px] font-semibold text-ink">
            Verilerin
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Kampların, ilerlemen ve notların yalnızca bu tarayıcıda saklanır; sunucuya yalnızca Keşfet’te yayınladığın kamplar gider.
            Tarayıcı verisini temizlemeden önce yedek al.
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
                {campCount > 0 ? `${campCount} kamp, ilerlemen ve notların silinir.` : 'Bu tarayıcıdaki tüm kayıtlar silinir.'} Geri
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

      <section className="rounded-[14px] border border-dashed border-line-strong px-5 py-4 text-[13px] text-ink-2 sm:px-6">
        <h2 className="font-semibold text-ink">Nasıl çalışır?</h2>
        <p className="mt-1">
          Bir oynatma listesi ya da video bağlantısı yapıştırdığında videoların adları ve süreleri sunucu üzerinden YouTube Data API
          ile okunur; YouTube dışındaki dersleri konu ve süreyle elle ekleyebilirsin. Hiçbir video, bağlantı ya da süre uydurulmaz. Her liste kampında bir branş
          olur. Plan, kampın temposuna göre (otomatik ya da senin gün gün seçtiğin branşlarla) videoları liste sırasıyla günlere
          böler. Bir görevi işaretlemek planı kaydırmaz; geride kalanları yalnızca sen “ileri taşı” dediğinde yeniden dağıtır.
        </p>
      </section>
    </div>
  );
}
