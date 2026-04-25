import { useEffect, useState } from 'react';

export default function BiometricOverlay({ onComplete }) {
  const [status, setStatus] = useState('scanning'); // scanning -> success

  useEffect(() => {
    // Stage 1: Scanning
    const t1 = setTimeout(() => {
      setStatus('success');
    }, 1800);

    // Stage 2: Fade out and complete
    const t2 = setTimeout(() => {
      onComplete();
    }, 2400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <div className={`biometric-overlay ${status === 'success' ? 'bio-fade-out' : ''}`}>
      <div className="bio-content">
        <div className={`bio-ring ${status === 'success' ? 'bio-ring-success' : 'bio-ring-scanning'}`}>
          <div className="bio-laser" />
          <div className="bio-icon">
            {status === 'scanning' ? (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <path d="M9 9h.01" />
                <path d="M15 9h.01" />
              </svg>
            ) : (
              <svg className="bio-check" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>
        <p className="bio-status">
          {status === 'scanning' ? 'Verifying Identity...' : 'Access Granted'}
        </p>
      </div>
    </div>
  );
}
