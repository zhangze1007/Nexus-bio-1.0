'use client';
import { useState, useEffect } from 'react';

export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('nexus-bio-consent');
    if (!consent) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem('nexus-bio-consent', JSON.stringify({ analytics: true, timestamp: Date.now() }));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#10131a', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1rem', zIndex: 9999, display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center' }}>
      <span style={{ color: '#a3a3a3', fontSize: '14px' }}>We use analytics to improve your experience. By continuing, you agree to our <a href="/privacy" style={{ color: '#C8D8E8' }}>Privacy Policy</a>.</span>
      <button onClick={accept} style={{ background: '#C8D8E8', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Accept</button>
    </div>
  );
}
