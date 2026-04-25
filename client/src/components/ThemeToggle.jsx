import { useCallback, useSyncExternalStore } from 'react';
import { toggleTheme as flipTheme } from '../utils/theme.js';
import { hapticLight } from '../utils/haptics.js';

function subscribe(cb) {
  const el = document.documentElement;
  const obs = new MutationObserver(() => cb());
  obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
  return () => obs.disconnect();
}

function getSnapshot() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

function getServerSnapshot() {
  return 'dark';
}

export default function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const onToggle = useCallback(() => {
    hapticLight();
    flipTheme();
  }, []);

  const isLight = mode === 'light';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-pressed={isLight}
      title={isLight ? 'Dark mode' : 'Light mode'}
    >
      <span className="theme-toggle-icon" aria-hidden>
        {isLight ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        )}
      </span>
    </button>
  );
}
