import { useState } from 'react';
import { Mail, FileDown, ArrowRight } from 'lucide-react';

export default function ContactFlow() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section className="px-4 py-24" id="contact"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            04 · Contact
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-2"
            style={{ letterSpacing: '-0.02em' }}>
            Accelerate Your Research
          </h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Early-adopter consulting for biotech teams · 早期采用者咨询
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">

          {/* Consulting Card */}
          <div
            className="rounded-2xl p-8 flex flex-col transition-all duration-200 cursor-pointer"
            style={{
              background: hovered === 'consult' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${hovered === 'consult' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
            }}
            onMouseEnter={() => setHovered('consult')}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Mail size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">Strategic Consulting</h3>
            <p className="text-sm leading-relaxed mb-8 flex-1"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              45-minute deep dive into your bioprocessing pipeline. Identify bottlenecks and scalable microbial solutions tailored to your team.
            </p>
            <a
              href="https://forms.gle/your-google-form-link-here"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-5 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: '#ffffff', color: '#0a0a0a' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e5e5e5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#ffffff'; }}
            >
              Book Early-Adopter Session · $50
              <ArrowRight size={14} />
            </a>
          </div>

          {/* Whitepaper Card */}
          <div
            className="rounded-2xl p-8 flex flex-col transition-all duration-200"
            style={{
              background: hovered === 'paper' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${hovered === 'paper' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
            }}
            onMouseEnter={() => setHovered('paper')}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <FileDown size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">Technical Whitepaper</h3>
            <p className="text-sm leading-relaxed mb-8 flex-1"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              1-page technical brief on Next-Gen Bio-Intelligent Architecture for Sustainable Food Production. Free download.
            </p>
            <a
              href="/whitepaper-template.pdf"
              download
              className="flex items-center justify-between px-5 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
            >
              Download Whitepaper
              <FileDown size={14} />
            </a>
          </div>

        </div>
      </div>
    </section>
  );
}
