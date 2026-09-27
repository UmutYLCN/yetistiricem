import type { ComponentType, ReactNode, SVGProps } from 'react';
import { ChartColumn, Compass, Library, Plus, Route, Settings } from 'lucide-react';
import { LANDING_PATH } from '../../lib/routes';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { BrandMark, Wordmark } from '../ui/BrandMark';
import { msg } from '../../lib/messages';


export type View = 'today' | 'path' | 'progress' | 'camps' | 'discover' | 'settings';

interface NavItem {
  view: View;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const PRIMARY_NAV: NavItem[] = [
  // Rotam holds the day twice over: as a list ('today') or as the path ('path').
  { view: 'today', label: 'Rotam', icon: Route },
  { view: 'progress', label: 'İlerleme', icon: ChartColumn },
  { view: 'camps', label: 'Kamplar', icon: Library },
  { view: 'discover', label: 'Keşfet', icon: Compass },
];

interface NavProps {
  view: View;
  onNavigate: (view: View) => void;
  onAddCamp: () => void;
  campCount: number;
  /** Opens the Ayarlar window (the gear next to the profile). */
  onOpenSettings: () => void;
  isDemo: boolean;
  /** The notification bell, top right of the navigation. */
  bell?: ReactNode;
  /** Who is signed in; the profile entry opens the profile page. */
  profile: Profile;
}

export interface Profile {
  name: string;
  /** The line under the name (school details, the email, or what the entry opens). */
  detail: string;
  /** A drawn shape id or an uploaded picture (`ProfileAvatar`); null shows the initial. */
  avatar: string | null;
}

export function Sidebar({ view, onNavigate, onAddCamp, campCount, onOpenSettings, isDemo, bell, profile }: NavProps) {
  const item = ({ view: target, label, icon: Icon }: NavItem) => {
    const active = view === target || (target === 'today' && view === 'path');
    return (
      <li key={target}>
        <button
          type="button"
          onClick={() => onNavigate(target)}
          aria-current={active ? 'page' : undefined}
          className={`flex h-9 w-full items-center gap-3 rounded-[9px] px-2.5 text-[14px] font-medium transition-colors ${
            active ? 'bg-sunk text-ink ring-1 ring-line-strong' : 'text-ink-2 hover:bg-sunk/60 hover:text-ink'
          }`}
        >
          <Icon className={`size-[17px] ${active ? 'text-forest' : 'text-ink-3'}`} aria-hidden="true" />
          <span className="flex-1 text-left">{msg(label)}</span>
          {target === 'camps' && campCount > 0 && (
            <span className="tnum text-[12px] font-semibold text-ink-3">{campCount}</span>
          )}
        </button>
      </li>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line px-4 py-5 lg:flex">
      <div className="flex items-center gap-1">
        <a
          href={LANDING_PATH}
          className="-my-1 flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2 py-1 transition-colors hover:bg-sunk/60"
          aria-label={msg("Yetişir ana sayfası")}
        >
          <BrandMark />
          <div className="min-w-0">
            <p className="text-[16px] leading-none">
              <Wordmark />
            </p>
            <p className="mt-1 text-[12px] text-ink-3">{msg("Panik yok, yetişir")}</p>
          </div>
        </a>
        {bell}
      </div>

      <button type="button" className={`btn mt-5 w-full ${campCount > 0 ? 'btn-secondary' : 'btn-primary'}`} onClick={onAddCamp}>
        <Plus aria-hidden="true" />
        {isDemo ? msg("Kendi planını kur") : msg("Yeni kamp")}
      </button>

      <nav aria-label={msg("Ana menü")} className="mt-6 flex-1">
        <ul className="space-y-1">{PRIMARY_NAV.map(item)}</ul>
      </nav>

      <div className="flex items-center gap-1 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          aria-current={view === 'settings' ? 'page' : undefined}
          aria-label={`${profile.name}: profil`}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors ${
            view === 'settings' ? 'bg-sunk ring-1 ring-line-strong' : 'hover:bg-sunk/60'
          }`}
        >
          <ProfileAvatar avatar={profile.avatar} name={profile.name} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink">{profile.name}</span>
            <span className="block truncate text-[12px] text-ink-3">{profile.detail}</span>
          </span>
        </button>
        <button type="button" className="icon-btn shrink-0" onClick={onOpenSettings} aria-label={msg("Tercihler")} title={msg("Tercihler")}>
          <Settings aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

export function MobileTopBar({ view, onNavigate, onAddCamp, onOpenSettings, isDemo, bell, profile }: NavProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/80 px-4 backdrop-blur-md lg:hidden">
      <a href={LANDING_PATH} className="-m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-[9px] p-1" aria-label={msg("Yetişir ana sayfası")}>
        <BrandMark size={28} />
        <Wordmark className="text-[16px]" />
      </a>
      {bell}
      <button
        type="button"
        className="icon-btn shrink-0"
        onClick={onAddCamp}
        aria-label={isDemo ? msg("Kendi planını kur") : msg("Yeni kamp")}
      >
        <Plus aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn shrink-0" onClick={onOpenSettings} aria-label={msg("Tercihler")}>
        <Settings aria-hidden="true" />
      </button>
      <button
        type="button"
        className={`icon-btn shrink-0 ${view === 'settings' ? 'bg-sunk' : ''}`}
        onClick={() => onNavigate('settings')}
        aria-label={`${profile.name}: profil`}
        aria-current={view === 'settings' ? 'page' : undefined}
      >
        <ProfileAvatar avatar={profile.avatar} name={profile.name} size={28} />
      </button>
    </header>
  );
}

export function MobileTabBar({ view, onNavigate }: Pick<NavProps, 'view' | 'onNavigate'>) {
  return (
    <nav
      aria-label={msg("Ana menü")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {PRIMARY_NAV.map(({ view: target, label, icon: Icon }) => {
          const active = view === target || (target === 'today' && view === 'path');
          return (
            <li key={target}>
              <button
                type="button"
                onClick={() => onNavigate(target)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11.5px] font-semibold ${
                  active ? 'text-ink' : 'text-ink-3'
                }`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-forest-soft text-forest' : ''}`}>
                  <Icon className="size-[19px]" aria-hidden="true" />
                </span>
                {msg(label)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
