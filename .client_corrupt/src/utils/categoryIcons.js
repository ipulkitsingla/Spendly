/** Category → emoji for list tiles (matches “app icon” feel) */
const MAP = {
  Food: '🍔',
  Travel: '✈️',
  Bills: '📋',
  Shopping: '🛍️',
  Entertainment: '🎬',
  Health: '💊',
  Transport: '🚗',
  Salary: '💼',
  Debt: '🧾',
  Other: '📌',
  Transfer: '⇄',
  'Balance update': '⚖️',
};

export function categoryIcon(category, type) {
  if (type === 'transfer') return MAP.Transfer;
  if (type === 'balance_update') return MAP['Balance update'];
  if (category && MAP[category]) return MAP[category];
  return MAP.Other;
}
