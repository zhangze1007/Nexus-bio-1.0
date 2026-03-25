import { Mail, Linkedin, ArrowRight } from 'lucide-react';

const MONO  = "'JetBrains Mono', 'Fira Code', monospace";
const BODY  = "'Public Sans', -apple-system, sans-serif";
const CYAN  = '#38bdf8';
const BLUE  = '#60a5fa';

export default function ContactFlow() {
  return (
    <div style={{ maxWidth: '640px' }}>
      <div className="grid md:grid-cols-2 gap-4">

        {/* Gmail */}
        <a
          href="mailto:fuchanze@gmail.com"
          style={{
            display: 'flex', flexDirection: 'column', padding: '24px',
            borderRadius: '16px', textDecoration: 'none',
            background: 'rgba(56,189,248,0.04)',
            border: '1px solid rgba(56,189,248,0.16)',
            transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            boxShadow: '0 0 0 rgba(56,189,248,0)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(56,189,248,0.08)';
            el.style.borderColor = 'rgba(56,189,248,0.32)';
            el.style.boxShadow = '0 0 24px rgba(56,189,248,0.1)';
            el.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(56,189,248,0.04)';
            el.style.borderColor = 'rgba(56,189,248,0.16)';
            el.style.boxShadow = '0 0 0 rgba(56,189,248,0)';
            el.style.transform = 'none';
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 0 12px rgba(56,189,248,0.12)' }}>
            <Mail size={16} style={{ color: CYAN }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>
            Email
          </p>
          <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em', fontFamily: BODY }}>
            fuchanze@gmail.com
          </p>
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '12px', margin: '0 0 16px', lineHeight: 1.5, fontFamily: BODY }}>
            Research collaborations · Consulting · General inquiries
          </p>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: CYAN, fontSize: '12px', fontFamily: BODY, opacity: 0.7 }}>
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
            background: 'rgba(96,165,250,0.04)',
            border: '1px solid rgba(96,165,250,0.16)',
            transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            boxShadow: '0 0 0 rgba(96,165,250,0)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(96,165,250,0.08)';
            el.style.borderColor = 'rgba(96,165,250,0.32)';
            el.style.boxShadow = '0 0 24px rgba(96,165,250,0.1)';
            el.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(96,165,250,0.04)';
            el.style.borderColor = 'rgba(96,165,250,0.16)';
            el.style.boxShadow = '0 0 0 rgba(96,165,250,0)';
            el.style.transform = 'none';
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 0 12px rgba(96,165,250,0.12)' }}>
            <Linkedin size={16} style={{ color: BLUE }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>
            LinkedIn
          </p>
          <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em', fontFamily: BODY }}>
            Zhang Ze Foo
          </p>
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '12px', margin: '0 0 16px', lineHeight: 1.5, fontFamily: BODY }}>
            Founder · Synthetic Biology & Metabolic Engineering · Nexus-Bio
          </p>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: BLUE, fontSize: '12px', fontFamily: BODY, opacity: 0.7 }}>
            View profile <ArrowRight size={12} />
          </div>
        </a>

      </div>
    </div>
  );
}
