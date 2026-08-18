/**
 * Start of the UTC calendar week (Monday 00:00:00.000Z) containing `date`.
 * Pure/deterministic so the weekly lab schedule's grouping window can be
 * unit tested without a clock or a database.
 */
export function startOfWeekUTC(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diffToMonday);
  return start;
}

export function endOfWeekUTC(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}
