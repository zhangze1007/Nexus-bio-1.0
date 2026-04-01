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
  ['Tools',    '/tools'],
  ['Analyze',  '/analyze'],
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '14px',
      flexWrap: 'wrap',
      padding: '10px clamp(16px, 4vw, 40px)',
      minHeight: '58px',
      background: 'rgba(6,10,16,0.86)',
      backdropFilter: 'blur(24px) saturate(1.15)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.15)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 1px 0 rgba(255,255,255,0.03), 0 12px 40px rgba(0,0,0,0.28)',
    }}>
      {/* Logo */}
      <Link href="/" style={{ display:'flex', alignItems:'center', gap:'9px', textDecoration:'none' }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.16)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
        }}>
          <Dna size={13} style={{ color: 'rgba(239,245,255,0.88)' }} />
        </div>
        <span style={{
          fontFamily: BRAND, fontWeight: 700, fontSize: '14px',
          color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.01em',
        }}>
          Nexus-Bio
        </span>
      </Link>

      {/* Nav links */}
      <div style={{ display:'flex', alignItems:'center', gap:'clamp(12px, 2.5vw, 28px)', flexWrap: 'wrap' }}>
        {NAV_LINKS.map(([label, href]) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} style={{
              fontFamily: SANS, fontSize: '12px', fontWeight: isActive ? 500 : 400,
              color: isActive ? 'rgba(241,246,255,0.96)' : 'rgba(214,226,242,0.54)',
              textDecoration: 'none', letterSpacing: '0.02em',
              position: 'relative', padding: '6px 0',
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(241,246,255,0.82)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(214,226,242,0.54)'; }}>
              {label}
              {isActive && (
                <span style={{
                  position: 'absolute', bottom: '-1px', left: 0, right: 0,
                  height: '2px',
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, transparent, rgba(153,216,255,0.92), transparent)',
                }} />
              )}
            </Link>
          );
        })}
      </div>

      {/* Mono tag */}
      <div style={{
        fontFamily: MONO, fontSize: '9px', fontWeight: 500,
        color: 'rgba(214,226,242,0.46)',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        padding: '6px 10px', borderRadius: '999px',
        background: 'rgba(153,216,255,0.08)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        workbench
      </div>
    </nav>
  );
}
