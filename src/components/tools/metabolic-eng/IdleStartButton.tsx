'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '../../../theme';
export default function IdleStartButton({
  onStart,
  visible,
}: {
  onStart: () => void;
  visible: boolean;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          onClick={onStart}
          style={{
            position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
            fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: '#111318',
            textTransform: 'uppercase', letterSpacing: '0.15em', zIndex: 25,
            background: 'rgba(255,255,255,0.88)', border: 'none',
            borderRadius: '100px', padding: '8px 20px', cursor: 'pointer',
            transition: 'background 0.2s, box-shadow 0.2s',
            boxShadow: '0 12px 28px rgba(0,0,0,0.32)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#ffffff';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 34px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.88)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 28px rgba(0,0,0,0.32)';
          }}
        >
          ▶ Start Simulation
        </motion.button>
      )}
    </AnimatePresence>
  );
}
