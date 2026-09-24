import type { ComponentType, SVGProps } from 'react';
import { CalendarCheck, CalendarRange, ChartColumn, Library, Plus, Settings } from 'lucide-react';

export type View = 'today' | 'week' | 'progress' | 'camps' | 'settings';

interface NavItem {
  view: View;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const PRIMARY_NAV: NavItem[] = [
  { view: 'today', label: 'Bugün', icon: CalendarCheck },
  { view: 'week', label: 'Haftalık', icon: CalendarRange },
  { view: 'progress', label: 'İlerleme', icon: ChartColumn },
  { view: 'camps', label: 'Kamplar', icon: Library },
];

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="9" fill="#1f5a43" />
      <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#f6f3ec" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.5" cy="24.5" r="3" fill="#e0782f" />
    </svg>
  );
}

interface NavProps {
  view: View;
  onNavigate: (view: View) => void;
  onAddCamp: () => void;
  campCount: number;
  isDemo: boolean;
}

export function Sidebar({ view, onNavigate, onAddCamp, campCount, isDemo }: NavProps) {
  const item = ({ view: target, label, icon: Icon }: NavItem) => {
    const active = view === target;
    return (
      <li key={target}>
        <button
          type="button"
          onClick={() => onNavigate(target)}
          aria-current={active ? 'page' : undefined}
          className={`flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[14.5px] font-medium transition-colors ${
            active ? 'bg-card text-ink shadow-[var(--shadow-card)] ring-1 ring-line' : 'text-ink-2 hover:bg-sunk hover:text-ink'
          }`}
        >
          <Icon className={`size-[18px] ${active ? 'text-forest' : ''}`} aria-hidden="true" />
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
      <div className="flex items-center gap-3 px-2">
        <BrandMark />
        <div className="min-w-0">
          <p className="font-display text-[19px] leading-none text-ink">Yetiştiricem</p>
          <p className="mt-1 text-[12px] text-ink-3">Çalışma planlayıcı</p>
        </div>
      </div>

      <button type="button" className="btn btn-primary mt-6 w-full" onClick={onAddCamp}>
        <Plus aria-hidden="true" />
        {isDemo ? 'Kendi planını kur' : 'Kamp ekle'}
      </button>

      <nav aria-label="Ana menü" className="mt-6 flex-1">
        <ul className="space-y-1">{PRIMARY_NAV.map(item)}</ul>
      </nav>

      <ul className="space-y-1 border-t border-line pt-4">
        {item({ view: 'settings', label: 'Ayarlar', icon: Settings })}
      </ul>
      <p className="mt-4 px-3 text-[12px] leading-relaxed text-ink-3">
        Verilerin yalnızca bu tarayıcıda saklanır. Ayarlar’dan yedek alabilirsin.
      </p>
    </aside>
  );
}

export function MobileTopBar({ view, onNavigate, onAddCamp, isDemo }: Omit<NavProps, 'campCount'>) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/95 px-4 backdrop-blur-sm lg:hidden">
      <BrandMark size={28} />
      <p className="font-display flex-1 text-[18px] text-ink">Yetiştiricem</p>
      <button
        type="button"
        className="icon-btn"
        onClick={onAddCamp}
        aria-label={isDemo ? 'Kendi planını kur' : 'Kamp ekle'}
      >
        <Plus aria-hidden="true" />
      </button>
      <button
        type="button"
        className={`icon-btn ${view === 'settings' ? 'bg-sunk text-ink' : ''}`}
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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {PRIMARY_NAV.map(({ view: target, label, icon: Icon }) => {
          const active = view === target;
          return (
            <li key={target}>
              <button
                type="button"
                onClick={() => onNavigate(target)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11.5px] font-semibold ${
                  active ? 'text-forest' : 'text-ink-3'
                }`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-forest-soft' : ''}`}>
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
