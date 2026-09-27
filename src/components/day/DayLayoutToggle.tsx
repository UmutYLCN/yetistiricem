import { List, Route } from 'lucide-react';

export type DayLayout = 'today' | 'path';

/** Rotam's two faces: the day as a task list or as the winding path. */
export function DayLayoutToggle({ value, onChange }: { value: DayLayout; onChange: (layout: DayLayout) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Günün görünümü">
      <button type="button" aria-pressed={value === 'today'} onClick={() => onChange('today')} className="inline-flex items-center gap-1.5">
        <List className="size-4" aria-hidden="true" />
        <span className="max-[400px]:sr-only">Liste</span>
      </button>
      <button type="button" aria-pressed={value === 'path'} onClick={() => onChange('path')} className="inline-flex items-center gap-1.5">
        <Route className="size-4" aria-hidden="true" />
        <span className="max-[400px]:sr-only">Yol</span>
      </button>
    </div>
  );
}
