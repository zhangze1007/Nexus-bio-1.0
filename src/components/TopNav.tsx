'use client';
/**
 * TopNav — Fixed global navigation bar.
 * Uses Next.js Link for proper multi-page routing.
 * Active route highlighting via usePathname().
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dna } from 'lucide-react';
import { T } from './ide/tokens';
import styles from './TopNav.module.css';

const NAV_LINKS: [string, string][] = [
  ['Home',     '/'],
  ['Research', '/research'],
  ['Tools',    '/tools'],
  ['Analyze',  '/analyze'],
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} style={{ fontFamily: T.SANS }}>
      {/* Logo */}
      <Link href="/" className={styles.logo}>
        <div className={styles.logoIcon}>
          <Dna size={13} />
        </div>
        <span className={styles.logoText} style={{ fontFamily: T.BRAND }}>
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
              style={{ fontFamily: T.SANS }}
            >
              {label}
              {isActive && <span className={styles.activeIndicator} />}
            </Link>
          );
        })}
      </div>

      {/* Version tag */}
      <div className={styles.versionTag} style={{ fontFamily: T.MONO }}>
        v1.0
      </div>
    </nav>
  );
}
