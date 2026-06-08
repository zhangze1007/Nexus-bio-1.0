'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import { LogIn, LogOut, User, ChevronDown } from 'lucide-react';
import { THEME } from '../../theme';
/**
 * LoginButton — Authentication control for the IDE top bar.
 *
 * Unauthenticated: shows "Sign in" button
 * Authenticated: shows avatar + name with dropdown (Profile, Sign out)
 */
export default function LoginButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (status === 'loading') {
    return (
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px',
        background: 'rgba(255,255,255,0.04)',
      }} />
    );
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn()}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: THEME.SANS, fontSize: '12px', fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.88)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)';
        }}
      >
        <LogIn size={13} />
        Sign in
      </button>
    );
  }

  const user = session.user;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User menu"
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '4px 10px 4px 4px', borderRadius: '8px',
          background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: '1px solid transparent',
          color: 'rgba(255,255,255,0.7)',
          fontFamily: THEME.SANS, fontSize: '12px', fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            width={24}
            height={24}
            style={{ borderRadius: '6px' }}
          />
        ) : (
          <div style={{
            width: '24px', height: '24px', borderRadius: '6px',
            background: 'rgba(191,220,205,0.15)',
            display: 'grid', placeItems: 'center',
          }}>
            <User size={12} style={{ color: '#BFDCCD' }} />
          </div>
        )}
        <span style={{
          maxWidth: '120px', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {user.name || user.email}
        </span>
        <ChevronDown size={11} style={{
          color: 'rgba(255,255,255,0.3)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
        }} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            minWidth: '200px', borderRadius: '10px',
            background: 'rgba(10,12,16,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            overflow: 'hidden', zIndex: 100,
          }}
        >
          {/* User info */}
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <p style={{
              fontFamily: THEME.SANS, fontSize: '13px', fontWeight: 600,
              color: 'rgba(255,255,255,0.88)', margin: 0,
            }}>
              {user.name}
            </p>
            <p style={{
              fontFamily: THEME.MONO, fontSize: '11px',
              color: 'rgba(255,255,255,0.4)', margin: '2px 0 0',
            }}>
              {user.email}
            </p>
            {user.institution && (
              <p style={{
                fontFamily: THEME.SANS, fontSize: '11px',
                color: 'rgba(255,255,255,0.55)', margin: '4px 0 0',
              }}>
                {user.institution}
              </p>
            )}
          </div>

          {/* Menu items */}
          <div style={{ padding: '4px' }}>
            <button
              role="menuitem"
              onClick={() => { setOpen(false); window.location.href = '/profile'; }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '8px 10px', borderRadius: '6px',
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: THEME.SANS, fontSize: '12px',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.88)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'none';
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)';
              }}
            >
              <User size={13} />
              Profile
            </button>
            <button
              role="menuitem"
              onClick={() => signOut()}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '8px 10px', borderRadius: '6px',
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: THEME.SANS, fontSize: '12px',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(232,163,161,0.08)';
                (e.currentTarget as HTMLElement).style.color = '#E8A3A1';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'none';
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)';
              }}
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
