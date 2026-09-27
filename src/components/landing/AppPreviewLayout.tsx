import type { ReactNode } from 'react';
import type { LandingPreview } from '../../lib/landingPreview';
import { Sidebar } from '../layout/Navigation';
import type { View } from '../layout/Navigation';

const noop = () => {};

/** Both product shots use the app's sidebar width, breakpoints and content padding. */
export function AppPreviewLayout({ camp, view, children }: { camp: LandingPreview['camp']; view: View; children: ReactNode }) {
  return (
    <div className="flex min-w-0 [&>aside]:static [&>aside]:h-auto">
      <Sidebar
        view={view}
        onNavigate={noop}
        onAddCamp={noop}
        camps={[{ id: camp.id, name: camp.name }]}
        activeCampId={camp.id}
        scope="camp"
        onSelectCamp={noop}
        onSelectAll={noop}
        isDemo
        profile={{ name: 'Demo', detail: 'Ayarlar', avatar: null }}
      />
      <div className="min-w-0 flex-1 px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-8">{children}</div>
    </div>
  );
}
