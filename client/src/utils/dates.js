/** Small date helpers (no date-fns) — avoids bundler issues from incomplete installs */

export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

export function endOfYear(d) {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

export function subDays(d, n) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() - n);
  return x;
}

export function subMonths(d, n) {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() - n);
  return x;
}

/** e.g. "April 2026" */
export function formatMonthLong(d) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
}

/** e.g. "19 Apr 2026" */
export function formatMediumDate(d) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
