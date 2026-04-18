export function parseMonth(monthStr) {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return null;
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { start, end };
}
