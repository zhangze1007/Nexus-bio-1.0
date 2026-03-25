import { Mail, Linkedin, ArrowRight } from 'lucide-react';

const MONO = "'JetBrains Mono', 'Fira Code', monospace";

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
            background: 'rgba(0,212,255,0.02)',
            border: '1px solid rgba(0,212,255,0.1)',
            transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.05)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.3)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(0,212,255,0.08), 0 4px 20px rgba(0,0,0,0.3)';
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.02)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.1)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            (e.currentTarget as HTMLElement).style.transform = 'none';
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Mail size={16} style={{ color: 'rgba(0,212,255,0.7)' }} />
          </div>
          <p style={{ color: 'rgba(0,212,255,0.45)', fontSize: '10px', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.10em', margin: '0 0 6px' }}>
            Email
          </p>
          <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            fuchanze@gmail.com
          </p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: '0 0 16px', lineHeight: 1.5 }}>
            Research collaborations · Consulting · General inquiries
          </p>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(0,212,255,0.45)', fontSize: '12px', fontFamily: MONO }}>
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
            background: 'rgba(139,92,246,0.02)',
            border: '1px solid rgba(139,92,246,0.1)',
            transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.05)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.3)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(139,92,246,0.08), 0 4px 20px rgba(0,0,0,0.3)';
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.02)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.1)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            (e.currentTarget as HTMLElement).style.transform = 'none';
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Linkedin size={16} style={{ color: 'rgba(139,92,246,0.8)' }} />
          </div>
          <p style={{ color: 'rgba(139,92,246,0.5)', fontSize: '10px', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.10em', margin: '0 0 6px' }}>
            LinkedIn
          </p>
          <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            Zhang Ze Foo
          </p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: '0 0 16px', lineHeight: 1.5 }}>
            Founder · Synthetic Biology & Metabolic Engineering · Nexus-Bio
          </p>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(139,92,246,0.5)', fontSize: '12px', fontFamily: MONO }}>
            View profile <ArrowRight size={12} />
          </div>
        </a>

      </div>
    </div>
  );
}
