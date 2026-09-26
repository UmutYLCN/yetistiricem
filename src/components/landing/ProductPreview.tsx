import { useEffect, useMemo, useRef, useState } from 'react';
import type { LandingPreview } from '../../lib/landingPreview';
import { buildLandingPreview } from '../../lib/landingPreview';
import { formatDayTitle, relativeDayLabel } from '../../lib/format';
import { DayPanel } from '../day/DayPanel';
import { WeekStrip } from '../day/WeekStrip';
import { Sidebar } from '../layout/Navigation';
import { ProgressCard, WeekCard } from '../rail/RightRail';

const noop = () => {};
const NONE = new Set<string>();
/** Pause before the preview ticks a task off, once it is in view. */
const TICK_DELAY_MS = 1400;

/**
 * The Today screen with the demo camp, drawn by the app's own components and
 * laid out like the app. It is a picture: inert and hidden from assistive
 * technology (the page text describes it). Once in view it ticks the next
 * open task off, as a user would.
 */
export function ProductPreview({ base }: { base: LandingPreview }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [ticked, setTicked] = useState<string | null>(null);
  const { today } = base;
  const preview = useMemo(() => (ticked ? buildLandingPreview(today, [ticked]) : base), [base, ticked, today]);
  const nextOpen = base.day.plan?.items.find(item => !item.completed);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !nextOpen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        timer = window.setTimeout(() => setTicked(nextOpen.videoId), TICK_DELAY_MS);
      },
      { threshold: 0.45 }
    );
    observer.observe(frame);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [nextOpen]);

  const { camp, day, week, index, stats, prefs, branches } = preview;
  const isToday = day.date === today;

  return (
    <div ref={frameRef} className="preview-frame text-left" aria-hidden="true" inert>
      <div className="flex [&>aside]:static [&>aside]:h-auto">
        <Sidebar
          view="today"
          onNavigate={noop}
          onAddCamp={noop}
          camps={[{ id: camp.id, name: camp.name }]}
          activeCampId={camp.id}
          scope="camp"
          onSelectCamp={noop}
          onSelectAll={noop}
          isDemo
        />
        <div className="min-w-0 flex-1 px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-8">
          <div className="grid gap-x-6 gap-y-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <p className={`eyebrow mb-1.5 ${isToday ? 'text-accent' : ''}`}>{relativeDayLabel(day.date, today)}</p>
              <p className="font-display text-[26px] leading-tight text-ink sm:text-[30px]">{formatDayTitle(day.date)}</p>
            </div>
            <div className="min-w-0 space-y-4 xl:col-start-1 xl:row-start-2">
              <WeekStrip days={week} selectedDate={day.date} today={today} onSelect={noop} />
              <DayPanel
                summary={day}
                today={today}
                camps={branches}
                oversizedIds={NONE}
                firstDate={index.firstDate}
                lastDate={index.lastDate}
                startDate={prefs.startDate}
                onToggle={noop}
                onShift={noop}
                onEditLink={noop}
                onAddBranches={noop}
              />
            </div>
            <div className="hidden min-w-0 content-start gap-4 xl:col-start-2 xl:row-start-2 xl:grid">
              <ProgressCard stats={stats} prefs={prefs} today={today} targetEndDate={camp.schedule.targetEndDate} />
              <WeekCard days={week} selectedDate={day.date} today={today} onSelect={noop} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
