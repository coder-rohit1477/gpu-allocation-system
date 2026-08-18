const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Local-time Monday 00:00 for the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  return start;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function weekDays(weekStart: Date): { date: Date; label: string }[] {
  return DAY_LABELS.map((label, i) => ({ date: addDays(weekStart, i), label }));
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const weekRangeFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  return `${weekRangeFormatter.format(weekStart)} – ${weekRangeFormatter.format(weekEnd)}`;
}
