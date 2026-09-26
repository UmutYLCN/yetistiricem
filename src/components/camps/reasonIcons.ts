import type { LucideIcon } from 'lucide-react';
import { AlarmClock, BatteryLow, Brain, CircleHelp, Meh, Smartphone } from 'lucide-react';
import type { ReasonKey } from '../../lib/insights';

/** One icon per postpone reason (the reason copy lives in `src/lib/postpone.ts`). */
export const REASON_ICONS: Record<ReasonKey, LucideIcon> = {
  distraction: Smartphone,
  difficult: Brain,
  exhausted: BatteryLow,
  emergency: AlarmClock,
  low_motivation: Meh,
  unspecified: CircleHelp,
};
