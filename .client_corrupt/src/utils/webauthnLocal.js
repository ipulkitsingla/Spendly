/** Base64url helpers for storing WebAuthn credential id in localStorage. */

export function bufferToBase64url(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64urlToArrayBuffer(s) {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const str = atob(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out.buffer;
}

export function getRpId() {
  const h = typeof window !== 'undefined' ? window.location.hostname : '';
  if (h === 'localhost' || h === '127.0.0.1') return 'localhost';
  return h || 'localhost';
}

export async function platformBiometricsAvailable() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {
    return false;
  }
  return true;
}
