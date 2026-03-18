import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, Hash } from 'lucide-react';
import { PathwayNode } from '../types';

interface NodePanelProps {
  node: PathwayNode | null;
  onClose: () => void;
}

export default function NodePanel({ node, onClose }: NodePanelProps) {
  const handleDownload = () => {
    if (!node) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(node, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `${node.id}_metadata.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <AnimatePresence>
      {node && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[380px] z-50 flex flex-col"
            style={{ background: '#111111', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: node.color, boxShadow: `0 0 8px ${node.color}60` }} />
                <h2 className="text-white font-semibold text-base">{node.label}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

              {/* ID badge */}
              <div className="flex items-center gap-2">
                <Hash size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />
                <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>{node.id}</span>
              </div>

              {/* Summary */}
              <div>
                <p className="text-xs font-mono uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(255,255,255,0.25)' }}>Summary</p>
                <p className="text-sm leading-relaxed"
                  style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                  {node.summary}
                </p>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

              {/* Citation */}
              <div>
                <p className="text-xs font-mono uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(255,255,255,0.25)' }}>Citation</p>
                <div className="flex items-start gap-3 p-4 rounded-xl text-sm"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <FileText size={14} className="mt-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
                  <p style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{node.citation}</p>
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

              {/* Export */}
              <div>
                <p className="text-xs font-mono uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(255,255,255,0.25)' }}>Export</p>
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
                >
                  <Download size={14} />
                  Download JSON
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
