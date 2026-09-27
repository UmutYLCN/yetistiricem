import { APP_LANGUAGES } from '../../lib/language';
import { msg } from '../../lib/messages';
import { useLanguage } from '../../lib/LanguageContext';

export function LanguageSelect() {
  const { language, setLanguage } = useLanguage();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-1">
      <div className="min-w-0 flex-1">
        <label htmlFor="app-language" className="font-medium text-ink">
          {msg('Uygulama dili')}
        </label>
        <p className="text-[13px] text-ink-2">{msg('Menüler ve Yetişir’in yönlendirmeleri')}</p>
      </div>
      <select
        id="app-language"
        className="input w-auto min-w-36"
        aria-label={msg('Uygulama dili seç')}
        value={language}
        onChange={event => setLanguage(event.target.value as typeof language)}
      >
        {APP_LANGUAGES.map(option => (
          <option key={option.code} value={option.code} lang={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </li>
  );
}
