import { Dialog } from '../ui/Dialog';
import { ThemeSegmented } from '../ui/ThemeToggle';
import { DailyLimitSetting } from './DailyLimitSetting';
import { LanguageSelect } from './LanguageSelect';
import { msg } from '../../lib/messages';

/** Preferences for appearance, language and the daily study ceiling, opened from the gear next to the profile. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={msg('Tercihler')} width={540}>
      <ul className="divide-y divide-line">
        <li className="flex flex-wrap items-center justify-between gap-3 py-1">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">{msg('Görünüm')}</p>
            <p className="text-[13px] text-ink-2">{msg('Açık ya da koyu tema; Sistem cihazının ayarını izler.')}</p>
          </div>
          <ThemeSegmented />
        </li>
        <LanguageSelect />
        <DailyLimitSetting />
      </ul>
    </Dialog>
  );
}
