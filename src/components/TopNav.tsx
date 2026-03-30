'use client';
/**
 * TopNav — Fixed global navigation bar.
 * Uses Next.js Link for proper multi-page routing.
 * Active route highlighting via usePathname().
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dna } from 'lucide-react';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";
const BRAND = "'Space Grotesk',-apple-system,sans-serif";

const NAV_LINKS: [string, string][] = [
  ['Home',     '/'],
  ['Research', '/research'],
  ['Tools',    '/tools/pathd'],
  ['Analyze',  '/analyze'],
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(20px, 4vw, 48px)', height: '58px',
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(28px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(28px) saturate(1.4)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      boxShadow: '0 1px 0 rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.3)',
    }}>
      {/* Logo */}
      <Link href="/" style={{ display:'flex', alignItems:'center', gap:'9px', textDecoration:'none' }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 10px rgba(255,255,255,0.08)',
        }}>
          <Dna size={13} style={{ color: 'rgba(255,255,255,0.75)' }} />
        </div>
        <span style={{
          fontFamily: BRAND, fontWeight: 700, fontSize: '14px',
          color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.01em',
        }}>
          Nexus-Bio
        </span>
      </Link>

      {/* Nav links */}
      <div style={{ display:'flex', alignItems:'center', gap:'clamp(16px, 3vw, 36px)' }}>
        {NAV_LINKS.map(([label, href]) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} style={{
              fontFamily: SANS, fontSize: '12px', fontWeight: isActive ? 500 : 400,
              color: isActive ? 'rgba(226,232,240,0.92)' : 'rgba(226,232,240,0.32)',
              textDecoration: 'none', letterSpacing: '0.02em',
              position: 'relative', paddingBottom: '2px',
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.72)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.32)'; }}>
              {label}
              {isActive && (
                <span style={{
                  position: 'absolute', bottom: '-1px', left: 0, right: 0,
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)',
                }} />
              )}
            </Link>
          );
        })}
      </div>

      {/* Mono tag */}
      <div style={{
        fontFamily: MONO, fontSize: '9px', fontWeight: 500,
        color: 'rgba(255,255,255,0.05)',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        padding: '4px 10px', borderRadius: '6px',
        background: 'rgba(34,211,238,0.05)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        v2.0
      </div>
    </nav>
  );
}
