'use client';
/**
 * TopNav — Fixed global navigation bar.
 * Uses Next.js Link for proper multi-page routing.
 * Active route highlighting via usePathname().
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dna } from 'lucide-react';
import styles from './TopNav.module.css';
import LoginButton from './auth/LoginButton';
import { THEME } from '../theme';

const NAV_LINKS: [string, string][] = [
  ['Home',     '/'],
  ['Research', '/research'],
  ['Workbench', '/tools'],
  ['Analyze',  '/analyze'],
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} style={{ fontFamily: THEME.SANS }}>
      {/* Logo */}
      <Link href="/" className={styles.logo}>
        <div className={styles.logoIcon}>
          <Dna size={13} />
        </div>
        <span className={styles.logoText} style={{ fontFamily: THEME.BRAND }}>
          Nexus-Bio
        </span>
      </Link>

      {/* Nav links */}
      <div className={styles.links}>
        {NAV_LINKS.map(([label, href]) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.link} ${isActive ? styles.linkActive : ''}`}
              style={{ fontFamily: THEME.SANS }}
            >
              {label}
              {isActive && <span className={styles.activeIndicator} />}
            </Link>
          );
        })}
      </div>

      {/* Auth */}
      <LoginButton />

      {/* Version tag */}
      <div className={styles.versionTag} style={{ fontFamily: THEME.MONO }}>
        v1.0
      </div>
    </nav>
  );
}
