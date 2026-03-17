import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText } from 'lucide-react';
import { PathwayNode } from '../types';

interface NodePanelProps {
  node: PathwayNode | null;
  onClose: () => void;
}

export default function NodePanel({ node, onClose }: NodePanelProps) {
  const handleDownload = () => {
    if (!node) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(node, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${node.id}_metadata.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-full sm:w-96 bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col"
        >
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: node.color }} />
              {node.label}
            </h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-2 rounded-full hover:bg-zinc-800">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto space-y-8">
            <div>
              <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-3">Summary (摘要)</h3>
              <p className="text-zinc-300 leading-relaxed bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                {node.summary}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-3">Citation (引用)</h3>
              <div className="flex items-start gap-3 text-sm text-zinc-400 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                <FileText size={16} className="mt-0.5 shrink-0" />
                <p>{node.citation}</p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-3">Data Export (数据导出)</h3>
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"
              >
                <Download size={16} />
                <span>Download JSON Snippet</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
