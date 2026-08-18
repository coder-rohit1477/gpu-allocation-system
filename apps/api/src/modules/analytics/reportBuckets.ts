// Pure date-bucketing helpers for the daily/weekly/monthly report endpoints
// — no I/O, so they're unit testable without a database. Reuses Phase 7's
// faculty/week.ts for the Monday-start week definition rather than
// redefining it, via that module's public exports (not modifying it).
import { endOfWeekUTC, startOfWeekUTC } from "../faculty/week.js";

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * `count` consecutive UTC calendar-day buckets ending on the day containing
 * `anchor` (inclusive) — buckets[buckets.length - 1] is always anchor's day.
 */
export function dailyBuckets(anchor: Date, count: number): DateRange[] {
  const anchorStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  const buckets: DateRange[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(anchorStart);
    start.setUTCDate(start.getUTCDate() - i);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    buckets.push({ start, end });
  }
  return buckets;
}

/** `count` consecutive Monday-start weeks ending on the week containing `anchor`. */
export function weeklyBuckets(anchor: Date, count: number): DateRange[] {
  const anchorWeekStart = startOfWeekUTC(anchor);
  const buckets: DateRange[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(anchorWeekStart);
    start.setUTCDate(start.getUTCDate() - i * 7);
    buckets.push({ start, end: endOfWeekUTC(start) });
  }
  return buckets;
}

/** `count` consecutive UTC calendar months ending on the month containing `anchor`. */
export function monthlyBuckets(anchor: Date, count: number): DateRange[] {
  const buckets: DateRange[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    buckets.push({ start, end });
  }
  return buckets;
}

/** Parses a "YYYY-MM" string (as used by the monthly report's `month` query param) into a UTC Date anchored to that month. */
export function parseYearMonth(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearStr, monthStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}
