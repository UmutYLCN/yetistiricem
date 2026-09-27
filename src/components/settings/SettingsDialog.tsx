import { Dialog } from '../ui/Dialog';
import { ThemeSegmented } from '../ui/ThemeToggle';

/** "Ayarlar": app options, opened from the gear next to the profile. The account lives on the profile page. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Ayarlar" width={540}>
      <ul className="divide-y divide-line">
        <li className="flex flex-wrap items-center justify-between gap-3 py-1">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">Görünüm</p>
            <p className="text-[13px] text-ink-2">Açık ya da koyu tema; Sistem cihazının ayarını izler.</p>
          </div>
          <ThemeSegmented />
        </li>
      </ul>
    </Dialog>
  );
}
