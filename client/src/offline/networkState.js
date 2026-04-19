export function browserOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export function isOfflineFetchError(e) {
  if (!e) return false;
  if (e instanceof TypeError) return true;
  const m = String(e.message || '');
  return m.includes('Failed to fetch') || m.includes('NetworkError') || m.includes('Load failed');
}
