'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X } from 'lucide-react';
import { THEME } from '../../theme';

interface WhatIsThisProps {
  title: string;
  description: string;
  keyConcepts?: Array<{ term: string; definition: string }>;
}

export default function WhatIsThis({ title, description, keyConcepts }: WhatIsThisProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: THEME.LABEL, fontFamily: THEME.SANS, fontSize: THEME.FS_XS,
          padding: '4px', borderRadius: THEME.R_SM,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = THEME.VALUE)}
        onMouseLeave={e => (e.currentTarget.style.color = THEME.LABEL)}
        aria-label={`What is ${title}?`}
      >
        <HelpCircle size={14} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100,
              marginTop: '4px', width: '340px',
              background: THEME.PANEL_STRONG,
              border: `1px solid ${THEME.BORDER_ACTIVE}`,
              borderRadius: THEME.R_LG,
              padding: '16px',
              boxShadow: THEME.SHADOW_HIGH,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h4 style={{
                margin: 0, fontFamily: THEME.SANS, fontSize: THEME.FS_MD,
                color: THEME.VALUE, fontWeight: 600,
              }}>What is {title}?</h4>
              <button onClick={() => setOpen(false)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: THEME.LABEL, padding: '2px',
              }}><X size={14} /></button>
            </div>
            <p style={{
              margin: 0, marginBottom: keyConcepts?.length ? '12px' : 0,
              fontFamily: THEME.SANS, fontSize: THEME.FS_SM,
              color: THEME.LABEL, lineHeight: 1.6,
            }}>{description}</p>
            {keyConcepts && keyConcepts.length > 0 && (
              <div style={{ display: 'grid', gap: '6px' }}>
                {keyConcepts.map(({ term, definition }) => (
                  <div key={term} style={{ display: 'flex', gap: '8px' }}>
                    <span style={{
                      fontFamily: THEME.MONO, fontSize: THEME.FS_XS,
                      color: THEME.SKY, fontWeight: 600, flexShrink: 0,
                    }}>{term}</span>
                    <span style={{
                      fontFamily: THEME.SANS, fontSize: THEME.FS_XS,
                      color: THEME.LABEL, lineHeight: 1.5,
                    }}>{definition}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
