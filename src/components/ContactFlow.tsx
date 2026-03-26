'use client';

import { Mail, Linkedin, ArrowRight } from 'lucide-react';

export default function ContactFlow() {
  return (
    <section className="px-4 py-24" id="contact" style={{ background: '#0a0a0a' }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            05 · Contact
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-2"
            style={{ letterSpacing: '-0.02em' }}>
            Get in Touch
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>
            Open to research collaborations, consulting inquiries, and investment discussions.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4" style={{ maxWidth: '640px' }}>

          {/* Gmail */}
          <a
            href="mailto:fuchanze@gmail.com"
            style={{
              display: 'flex', flexDirection: 'column', padding: '24px',
              borderRadius: '16px', textDecoration: 'none',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
            }}
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Mail size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
              Email
            </p>
            <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              fuchanze@gmail.com
            </p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: '0 0 16px', lineHeight: 1.5 }}>
              Research collaborations · Consulting · General inquiries
            </p>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
              Send email <ArrowRight size={12} />
            </div>
          </a>

          {/* LinkedIn */}
          <a
            href="https://www.linkedin.com/in/zhangze-foo-3575ba359"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', flexDirection: 'column', padding: '24px',
              borderRadius: '16px', textDecoration: 'none',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
            }}
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Linkedin size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
              LinkedIn
            </p>
            <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              Zhang Ze Foo
            </p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: '0 0 16px', lineHeight: 1.5 }}>
              Founder · Synthetic Biology & Metabolic Engineering · Nexus-Bio
            </p>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
              View profile <ArrowRight size={12} />
            </div>
          </a>

        </div>
      </div>
    </section>
  );
}
