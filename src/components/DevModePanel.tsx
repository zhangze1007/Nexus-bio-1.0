'use client';

import { useState } from 'react';
import { Terminal, Server, AlertTriangle, X, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const steps = [
  'Push code to a GitHub repository',
  'Go to vercel.com → Import repository',
  'Framework: Next.js · Build: npm run build · Output: leave default',
  'Add GROQ_API_KEY (optional) and GEMINI_API_KEY in Environment Variables',
  'Deploy — done in ~2 minutes',
];

const faqs = [
  {
    q: 'Why does Vercel still mention Vite?',
    a: 'Your project should use the Next.js framework preset. Remove any old Vite build/output overrides and redeploy.',
    code: 'npm install',
  },
  {
    q: 'Blank page after deploy',
    a: 'Ensure Vercel output directory is left blank so the Next.js default is used.',
    code: '.next',
  },
  {
    q: 'API error 429',
    a: 'Free tier rate limit reached. Wait 1–2 minutes before retrying.',
    code: null,
  },
  {
    q: 'AI response incomplete',
    a: 'Gemini returned truncated JSON. Retry with a shorter input text.',
    code: null,
  },
];

export default function DevModePanel() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        title="Developer Info"
        style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 40,
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
          backdropFilter: 'blur(8px)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = '#ffffff';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)';
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
        }}
      >
        <Terminal size={16} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 48 }}
            />

            {/* Panel */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
                height: '60vh', display: 'flex', flexDirection: 'column',
                background: '#0f0f0f',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Terminal size={15} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                    Developer Info
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace' }}>
                    Nexus-Bio 1.0
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>

                {/* Deployment Steps */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <Server size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Deployment
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {steps.map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', flexShrink: 0, marginTop: '1px' }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', lineHeight: 1.6 }}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Stack info */}
                  <div style={{ marginTop: '20px', padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                      Stack
                    </p>
                    {[
                      ['Frontend', 'React 19 · TypeScript · Next.js 15'],
                      ['3D', 'Three.js · React Three Fiber'],
                      ['AI', 'Groq Llama 3.3 70B → Gemini fallback · Vercel Edge'],
                      ['Data', 'PubMed · Semantic Scholar · RCSB PDB'],
                      ['Deploy', 'Vercel · GitHub'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', width: '72px', flexShrink: 0 }}>{label}</span>
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontFamily: 'monospace' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FAQ */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <AlertTriangle size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Troubleshooting
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {faqs.map((faq, i) => (
                      <div key={i} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600, margin: '0 0 5px' }}>
                          {faq.q}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                          {faq.a}
                          {faq.code && (
                            <code style={{ marginLeft: '6px', color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>
                              {faq.code}
                            </code>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
