import type { StudyCamp } from '../types/index.ts';
import { DEFAULT_DAILY_LIMIT } from './dailyLimit.ts';
import { buildCampSchedule, dailyHoursForDeadline, planEndDate } from './engine.ts';
import { withTempo } from './plannerOps.ts';

// The prompt after a postponement pushes a camp past its target date: how far
// past, and which daily time (applied from today, like "Tempoyu düzenle")
// would make the target again. See docs/planner-engine.md, "Target end date".

/** A suggestion above this share of the current daily time is flagged as possibly too intense. */
export const INTENSE_FACTOR = 1.5;

/** `camp` with a new daily time, applied the way "Tempoyu düzenle" applies it (from today once started). */
export function campWithDailyHours(camp: StudyCamp, hours: number, today: string): StudyCamp {
  return withTempo(camp, { ...camp.schedule, dailyStudyHours: hours }, today);
}

/**
 * The smallest half-hour daily time, above the current one and at most
 * `maxHours`, with which the camp ends by its target date once applied from
 * today: only the days from today on gain capacity, past days keep their
 * layout. Null when no such time exists.
 */
export function hoursToMeetTarget(camp: StudyCamp, options: { today: string; maxHours?: number }): number | null {
  const { today, maxHours } = options;
  return dailyHoursForDeadline(camp, { today, maxHours, withHours: hours => campWithDailyHours(camp, hours, today) });
}

export interface DeadlineOverrun {
  targetEndDate: string;
  /** Where the plan ends now (after the postponement). */
  finishDate: string;
  currentHours: number;
  /** The student's daily ceiling; no suggestion goes above it. */
  limit: number;
  /** The daily time that makes the target, or null when none up to `limit` does (or the target already passed). */
  suggestion: { hours: number; finishDate: string; intense: boolean } | null;
  /** The target day is before today: no daily time can make it. */
  targetPassed: boolean;
}

/** Above 1.5× the current daily time or above the student's ceiling. */
export function isIntense(hours: number, currentHours: number, limit: number): boolean {
  return hours > currentHours * INTENSE_FACTOR || hours > limit;
}

/**
 * Null unless the camp has a target date and its plan, as stored, ends after
 * it. Otherwise the gap and a verified suggestion: the plan laid out with the
 * suggested time from today really ends on or before the target.
 */
export function deadlineOverrun(camp: StudyCamp, options: { today: string; limit?: number }): DeadlineOverrun | null {
  const target = camp.schedule.targetEndDate;
  if (!target) return null;
  const { today, limit = DEFAULT_DAILY_LIMIT } = options;
  const result = buildCampSchedule(camp, { today });
  // Unplaceable videos are a different problem (the tempo dialog reports it).
  if (result.unscheduledItems.length > 0) return null;
  const finishDate = planEndDate(result.plans);
  if (finishDate === null || finishDate <= target) return null;

  const currentHours = camp.schedule.dailyStudyHours;
  const targetPassed = target < today;
  let suggestion: DeadlineOverrun['suggestion'] = null;
  const hours = targetPassed ? null : hoursToMeetTarget(camp, { today, maxHours: limit });
  if (hours !== null) {
    const check = buildCampSchedule(campWithDailyHours(camp, hours, today), { today });
    const end = planEndDate(check.plans);
    if (check.unscheduledItems.length === 0 && end !== null && end <= target) {
      suggestion = { hours, finishDate: end, intense: isIntense(hours, currentHours, limit) };
    }
  }
  return { targetEndDate: target, finishDate, currentHours, limit, suggestion, targetPassed };
}
