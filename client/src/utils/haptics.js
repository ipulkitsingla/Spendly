function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function vibrate(pattern) {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* no-op */
  }
}

export function hapticLight() {
  vibrate(10);
}

export function hapticMedium() {
  vibrate(18);
}

export function hapticSuccess() {
  vibrate([12, 30, 18]);
}

export function hapticError() {
  vibrate([18, 35, 18, 35, 24]);
}
