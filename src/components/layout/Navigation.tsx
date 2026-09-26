import { useId } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { CalendarCheck, CalendarRange, ChartColumn, Library, Plus, Route, Settings } from 'lucide-react';
import type { CampScope } from '../../lib/allCamps';
import { offersAllCamps } from '../../lib/allCamps';
import { LANDING_PATH } from '../../lib/routes';
import { BrandMark } from '../ui/BrandMark';

export type View = 'today' | 'path' | 'week' | 'progress' | 'camps' | 'settings';

interface NavItem {
  view: View;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const PRIMARY_NAV: NavItem[] = [
  { view: 'today', label: 'Bugün', icon: CalendarCheck },
  { view: 'path', label: 'Yol', icon: Route },
  { view: 'week', label: 'Haftalık', icon: CalendarRange },
  { view: 'progress', label: 'İlerleme', icon: ChartColumn },
  { view: 'camps', label: 'Kamplar', icon: Library },
];

export interface CampOption {
  id: string;
  name: string;
}

interface NavProps {
  view: View;
  onNavigate: (view: View) => void;
  onAddCamp: () => void;
  camps: CampOption[];
  activeCampId: string | null;
  /** `all`: the plan screens combine every camp ("Tüm Kamplar"). */
  scope: CampScope;
  onSelectCamp: (campId: string) => void;
  onSelectAll: () => void;
  isDemo: boolean;
}

export const ALL_CAMPS_LABEL = 'Tüm Kamplar';

// Option values; a camp id is prefixed so no id can pass for "all".
const ALL_VALUE = 'all';
const campValue = (id: string) => `camp:${id}`;

/**
 * What the plan screens show: with two or more camps a picker of "Tüm
 * Kamplar" and each camp, with one camp its name.
 */
export function CampSwitcher({
  camps,
  activeCampId,
  scope,
  onSelectCamp,
  onSelectAll,
  compact = false,
}: Pick<NavProps, 'camps' | 'activeCampId' | 'scope' | 'onSelectCamp' | 'onSelectAll'> & { compact?: boolean }) {
  const uid = useId();
  const active = camps.find(c => c.id === activeCampId) ?? camps[0];
  if (!active) return null;
  const showAll = scope === 'all' && offersAllCamps(camps.length);
  if (camps.length === 1) {
    return compact ? (
      <p className="font-display min-w-0 truncate text-[15px] text-ink">{active.name}</p>
    ) : (
      <p className="font-display truncate text-[15px] leading-snug text-ink" title={active.name}>
        {active.name}
      </p>
    );
  }
  return (
    <>
      <label htmlFor={`${uid}-camp`} className="sr-only">
        Gösterilen kamp
      </label>
      <select
        id={`${uid}-camp`}
        className={`input camp-select ${compact ? 'camp-select-compact' : ''}`}
        value={showAll ? ALL_VALUE : campValue(active.id)}
        onChange={e => {
          const value = e.target.value;
          if (value === ALL_VALUE) onSelectAll();
          else {
            const camp = camps.find(c => campValue(c.id) === value);
            if (camp) onSelectCamp(camp.id);
          }
        }}
      >
        <option value={ALL_VALUE}>{ALL_CAMPS_LABEL}</option>
        {camps.map(c => (
          <option key={c.id} value={campValue(c.id)}>
            {c.name}
          </option>
        ))}
      </select>
    </>
  );
}

export function Sidebar({ view, onNavigate, onAddCamp, camps, activeCampId, scope, onSelectCamp, onSelectAll, isDemo }: NavProps) {
  const campCount = camps.length;
  const item = ({ view: target, label, icon: Icon }: NavItem) => {
    const active = view === target;
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
          <span className="flex-1 text-left">{label}</span>
          {target === 'camps' && campCount > 0 && (
            <span className="tnum text-[12px] font-semibold text-ink-3">{campCount}</span>
          )}
        </button>
      </li>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line px-4 py-5 lg:flex">
      <a
        href={LANDING_PATH}
        className="-my-1 flex items-center gap-3 rounded-[10px] px-2 py-1 transition-colors hover:bg-sunk/60"
        aria-label="Yetiştiricem ana sayfası"
      >
        <BrandMark />
        <div className="min-w-0">
          <p className="font-display text-[15.5px] leading-none text-ink">Yetiştiricem</p>
          <p className="mt-1 text-[12px] text-ink-3">Çalışma planlayıcı</p>
        </div>
      </a>

      {/* With several camps, switch the open one here (the plan screens show it). */}
      {campCount > 1 && (
        <div className="mt-5">
          <CampSwitcher
            camps={camps}
            activeCampId={activeCampId}
            scope={scope}
            onSelectCamp={onSelectCamp}
            onSelectAll={onSelectAll}
            compact
          />
        </div>
      )}

      <button type="button" className={`btn mt-5 w-full ${campCount > 0 ? 'btn-secondary' : 'btn-primary'}`} onClick={onAddCamp}>
        <Plus aria-hidden="true" />
        {isDemo ? 'Kendi planını kur' : 'Yeni kamp'}
      </button>

      <nav aria-label="Ana menü" className="mt-6 flex-1">
        <ul className="space-y-1">{PRIMARY_NAV.map(item)}</ul>
      </nav>

      <ul className="space-y-1 border-t border-line pt-4">
        {item({ view: 'settings', label: 'Ayarlar', icon: Settings })}
      </ul>
    </aside>
  );
}

export function MobileTopBar({ view, onNavigate, onAddCamp, camps, activeCampId, scope, onSelectCamp, onSelectAll, isDemo }: NavProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/80 px-4 backdrop-blur-md lg:hidden">
      <a href={LANDING_PATH} className="-m-1 shrink-0 rounded-[9px] p-1" aria-label="Yetiştiricem ana sayfası">
        <BrandMark size={28} />
      </a>
      <div className="min-w-0 flex-1">
        {camps.length > 0 ? (
          <CampSwitcher
            camps={camps}
            activeCampId={activeCampId}
            scope={scope}
            onSelectCamp={onSelectCamp}
            onSelectAll={onSelectAll}
            compact
          />
        ) : (
          <p className="font-display text-[15.5px] text-ink">Yetiştiricem</p>
        )}
      </div>
      <button
        type="button"
        className="icon-btn shrink-0"
        onClick={onAddCamp}
        aria-label={isDemo ? 'Kendi planını kur' : 'Yeni kamp'}
      >
        <Plus aria-hidden="true" />
      </button>
      <button
        type="button"
        className={`icon-btn shrink-0 ${view === 'settings' ? 'bg-sunk text-ink' : ''}`}
        onClick={() => onNavigate('settings')}
        aria-label="Ayarlar"
        aria-current={view === 'settings' ? 'page' : undefined}
      >
        <Settings aria-hidden="true" />
      </button>
    </header>
  );
}

export function MobileTabBar({ view, onNavigate }: Pick<NavProps, 'view' | 'onNavigate'>) {
  return (
    <nav
      aria-label="Ana menü"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {PRIMARY_NAV.map(({ view: target, label, icon: Icon }) => {
          const active = view === target;
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
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
