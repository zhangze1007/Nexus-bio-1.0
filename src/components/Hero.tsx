import { motion } from 'framer-motion';
import { ArrowRight, FlaskConical, Search, Dna } from 'lucide-react';

const features = [
  { icon: <Dna size={14} />, label: 'Metabolic Pathway Visualization' },
  { icon: <Search size={14} />, label: 'PubMed Literature Search' },
  { icon: <FlaskConical size={14} />, label: 'AI-Powered Paper Analysis' },
];

export default function Hero() {
  return (
    <header className="relative w-full min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">

      {/* Radial vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(255,255,255,0.03) 0%, transparent 70%)' }}
      />

      {/* Top nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
            <Dna size={14} className="text-black" />
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">Nexus-Bio</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          {[['Visualize', 'demo'], ['Search', 'search'], ['Analyze', 'analyzer'], ['Contact', 'contact']].map(([label, id]) => (
            <a key={id} href={`#${id}`}
              className="text-xs font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.45)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
              {label}
            </a>
          ))}
        </div>
        <a href="#analyzer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#f5f5f5', border: '1px solid rgba(255,255,255,0.1)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}>
          Try Now <ArrowRight size={11} />
        </a>
      </nav>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-3xl mx-auto pt-20">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-8"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white opacity-50" />
          Next-Gen Bio-Intelligent Architecture
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-semibold text-white mb-6"
          style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}
        >
          From literature<br />
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>to mechanistic insight.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base md:text-lg mb-4 max-w-xl mx-auto leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Nexus-Bio extracts metabolic nodes, enzymatic reactions, and pathway logic from any research paper — rendered as an interactive 3D map in seconds.
        </motion.p>

        {/* Secondary line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-sm mb-10"
          style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}
        >
          Built for researchers, biotech teams, and grant-stage startups.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
        >
          <a href="#analyzer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#ffffff', color: '#0a0a0a' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e5e5e5'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#ffffff'; }}>
            Analyze a Paper
            <ArrowRight size={14} />
          </a>
          <a href="#search"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}>
            Browse Literature
          </a>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {features.map((f, i) => (
            <div key={i}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
              {f.icon}
              {f.label}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #0a0a0a)' }} />
    </header>
  );
}
