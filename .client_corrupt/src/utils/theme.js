const STORAGE_KEY = 'spendly_theme';

/** @returns {'light' | 'dark'} */
export function getStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

/** @param {'light' | 'dark'} theme */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#f1f5f9' : '#0a0a0b');
  }
}

export function initTheme() {
  applyTheme(getStoredTheme());
}

/** @returns {'light' | 'dark'} */
export function toggleTheme() {
  const next = getStoredTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
