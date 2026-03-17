import { useState } from 'react';
import { Terminal, Code, Server, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DevModePanel() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white p-3 rounded-full border border-zinc-700 shadow-lg transition-colors"
        title="Developer Mode"
      >
        <Terminal size={20} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 w-full h-[60vh] bg-zinc-950 border-t border-zinc-800 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-lg font-mono font-bold text-emerald-400 flex items-center gap-2">
                <Terminal size={18} />
                Developer Mode (开发者模式)
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white p-2">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <section>
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Server size={18} className="text-zinc-400" />
                    Zero-Cost Deployment Steps
                  </h3>
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-sm text-zinc-300 space-y-3 font-mono">
                    <p>1. Export code from AI Studio</p>
                    <p>2. Push to a new GitHub repository</p>
                    <p>3. Go to Vercel.com or Netlify.com</p>
                    <p>4. Import your GitHub repository</p>
                    <p>5. Build Command: <span className="text-emerald-400">npm run build</span></p>
                    <p>6. Output Directory: <span className="text-emerald-400">dist</span></p>
                    <p>7. Click Deploy. Done in ~2 mins.</p>
                  </div>
                </section>

                <section>
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Code size={18} className="text-zinc-400" />
                    Export Source Code
                  </h3>
                  <p className="text-sm text-zinc-400 mb-4">
                    Use the AI Studio platform's export feature to download the complete React project as a ZIP file, ready for local development or deployment.
                  </p>
                  <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg border border-zinc-700 text-sm transition-colors">
                    Hint: Use Platform Export Menu
                  </button>
                </section>
              </div>

              <div className="space-y-6">
                <section>
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-yellow-500" />
                    Troubleshooting FAQ
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                      <h4 className="text-sm font-bold text-white mb-1">Error: "vite: command not found"</h4>
                      <p className="text-xs text-zinc-400">Fix: Run <code className="text-emerald-400">npm install</code> to ensure all dependencies are installed before building.</p>
                    </div>
                    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                      <h4 className="text-sm font-bold text-white mb-1">Error: Blank page on deploy</h4>
                      <p className="text-xs text-zinc-400">Fix: Ensure your Vercel/Netlify build settings point to the <code className="text-emerald-400">dist</code> folder, not <code className="text-emerald-400">public</code> or root.</p>
                    </div>
                    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                      <h4 className="text-sm font-bold text-white mb-1">Error: Three.js canvas not rendering</h4>
                      <p className="text-xs text-zinc-400">Fix: Check if the parent container has a defined height (e.g., <code className="text-emerald-400">h-[500px]</code>). Canvas requires explicit dimensions.</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
