import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  bufferToBase64url,
  base64urlToArrayBuffer,
  getRpId,
  platformBiometricsAvailable,
} from '../utils/webauthnLocal.js';

const STORAGE_BLUR = 'spendly_privacy_blur_amounts';
const STORAGE_BIOMETRIC = 'spendly_privacy_face_lock';
const STORAGE_CRED_ID = 'spendly_webauthn_cred_id';

const PrivacyContext = createContext(null);

function loadBool(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function PrivacyProvider({ children }) {
  const [blurAmounts, setBlurAmountsState] = useState(() => loadBool(STORAGE_BLUR));
  const [faceLock, setFaceLockState] = useState(() => loadBool(STORAGE_BIOMETRIC));
  const [credentialId, setCredentialId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_CRED_ID) || '';
    } catch {
      return '';
    }
  });

  /** Session: amounts visible after unlock / tap */
  const [unveiled, setUnveiled] = useState(() => {
    if (loadBool(STORAGE_BIOMETRIC) && localStorage.getItem(STORAGE_CRED_ID)) return false;
    if (loadBool(STORAGE_BLUR)) return false;
    return true;
  });

  const [biometricReady, setBiometricReady] = useState(false);

  useEffect(() => {
    platformBiometricsAvailable().then(setBiometricReady);
  }, []);

  const setBlurAmounts = useCallback((v) => {
    setBlurAmountsState(v);
    try {
      localStorage.setItem(STORAGE_BLUR, v ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (v) setUnveiled(false);
    else setUnveiled(true);
  }, []);

  const setFaceLock = useCallback((v) => {
    setFaceLockState(v);
    try {
      localStorage.setItem(STORAGE_BIOMETRIC, v ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!v) {
      try {
        localStorage.removeItem(STORAGE_CRED_ID);
      } catch {
        /* ignore */
      }
      setCredentialId('');
      setUnveiled(true);
    } else {
      setUnveiled(false);
    }
  }, []);

  const persistCredentialId = useCallback((id) => {
    setCredentialId(id);
    try {
      if (id) localStorage.setItem(STORAGE_CRED_ID, id);
      else localStorage.removeItem(STORAGE_CRED_ID);
    } catch {
      /* ignore */
    }
  }, []);

  const lock = useCallback(() => {
    if (faceLock && credentialId) setUnveiled(false);
    if (blurAmounts && !faceLock) setUnveiled(false);
  }, [blurAmounts, faceLock, credentialId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') lock();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [lock]);

  /** Global blur (settings / blur-all mode) */
  const amountsHidden = useMemo(() => {
    if (blurAmounts) return !unveiled;
    return false;
  }, [blurAmounts, unveiled]);

  /** Face lock: only the dashboard hero running balance uses this */
  const heroBalanceHidden = useMemo(
    () => !!(faceLock && credentialId && !unveiled),
    [faceLock, credentialId, unveiled]
  );

  const revealWithTap = useCallback(() => {
    if (!faceLock || !credentialId) {
      setUnveiled(true);
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }, [faceLock, credentialId]);

  const revealWithBiometric = useCallback(async () => {
    if (!credentialId) return false;
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const idBuf = base64urlToArrayBuffer(credentialId);
      const cred = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ type: 'public-key', id: idBuf }],
          userVerification: 'required',
          timeout: 120000,
          rpId: getRpId(),
        },
      });
      if (cred) {
        setUnveiled(true);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }, [credentialId]);

  const registerBiometric = useCallback(async () => {
    const ok = await platformBiometricsAvailable();
    if (!ok) throw new Error('Face or Touch ID is not available in this browser or device.');
    const userId = new TextEncoder().encode('spendly-privacy');
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const rpId = getRpId();
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Spendly', id: rpId },
        user: {
          id: userId,
          name: 'privacy',
          displayName: 'Spendly privacy',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 120000,
        attestation: 'none',
      },
    });
    if (!cred || cred.type !== 'public-key') throw new Error('Could not create passkey.');
    const rawId = bufferToBase64url(cred.rawId);
    persistCredentialId(rawId);
    setFaceLockState(true);
    try {
      localStorage.setItem(STORAGE_BIOMETRIC, '1');
    } catch {
      /* ignore */
    }
    setUnveiled(true);
    return true;
  }, [persistCredentialId]);

  const value = useMemo(
    () => ({
      blurAmounts,
      setBlurAmounts,
      faceLock,
      setFaceLock,
      credentialId,
      persistCredentialId,
      amountsHidden,
      heroBalanceHidden,
      unveiled,
      setUnveiled,
      lock,
      revealWithTap,
      revealWithBiometric,
      registerBiometric,
      biometricReady,
    }),
    [
      blurAmounts,
      setBlurAmounts,
      faceLock,
      setFaceLock,
      credentialId,
      persistCredentialId,
      amountsHidden,
      heroBalanceHidden,
      unveiled,
      lock,
      revealWithTap,
      revealWithBiometric,
      registerBiometric,
      biometricReady,
    ]
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider');
  return ctx;
}
