"use client";

/**
 * Nexus-Bio — Home Page Shell
 *
 * Layout: TopNav (fixed) → Hero (fluid+search) → Metrics → CTA → Engine Architecture → Contact → Footer
 */

import { motion, useInView } from "framer-motion";
import dynamic from "next/dynamic";
import { useRef } from "react";
import Hero from "./components/Hero";
import HomeInteractiveCard from "./components/HomeInteractiveCard";
import TopNav from "./components/TopNav";

const FeaturesArchitecture = dynamic(() => import("./components/FeaturesArchitecture"), { ssr: false });
const DevModePanel = dynamic(() => import("./components/DevModePanel"), { ssr: false });

import { BarChart3, Dna, Linkedin, ShieldCheck, Zap } from "lucide-react";
import styles from "./App.module.css";
import { THEME } from "./theme";

const H = THEME.SANS;
const MONO = THEME.MONO;

// ── Scroll reveal ──────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className={styles.shell}>
      <TopNav />

      <main>
        {/* ── HERO ── */}
        <Hero />

        {/* ── METRICS STRIP ── */}
        <section className={styles.metrics}>
          <div className={styles.metricsGrid}>
            {[
              { value: "37+", label: "Compute Engines" },
              { value: "8", label: "Database Integrations" },
              { value: "3D", label: "Real-time Visualization" },
              { value: "100%", label: "Client-side Computation" },
            ].map((m) => (
              <div key={m.label} className={styles.metricItem}>
                <div className={styles.metricValue} style={{ fontFamily: MONO }}>
                  {m.value}
                </div>
                <div className={styles.metricLabel} style={{ fontFamily: H }}>
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA BAND ── */}
        <section className={styles.ctaBand}>
          <div className={styles.ctaGroup}>
            <a href="/tools" className={styles.ctaPrimary} style={{ fontFamily: H }}>
              Explore Platform →
            </a>
            <a href="/tools/metabolic-eng" className={styles.ctaSecondary} style={{ fontFamily: H }}>
              See it in Action
            </a>
          </div>
        </section>

        {/* ── ENGINE ARCHITECTURE ── */}
        <Reveal>
          <FeaturesArchitecture />
        </Reveal>

        {/* ── CONTACT ── */}
        <section id="contact" className={styles.contact}>
          <div className={styles.contactInner}>
            <Reveal className={styles.contactHeader} delay={0}>
              <h2 className={styles.sectionHeading} style={{ fontFamily: H }}>
                Get in Touch
              </h2>
              <p className={styles.sectionSub} style={{ fontFamily: H }}>
                Open to research collaborations, partnerships, and pilot programs with research institutions and iGEM
                teams.
              </p>
            </Reveal>

            <div className={styles.contactGrid}>
              <HomeInteractiveCard
                href="https://github.com/zhangze1007/Nexus-bio-1.0"
                icon={<Dna size={16} style={{ color: "rgba(255,255,255,0.55)" }} />}
                label="Open Source"
                title="View on GitHub"
                description="Explore the codebase · Report issues · Contribute"
                footer="Star on GitHub"
                external
              />
              <HomeInteractiveCard
                href="https://www.linkedin.com/in/zhangze-foo-3575ba359"
                icon={<Linkedin size={16} style={{ color: "rgba(255,255,255,0.55)" }} />}
                label="Connect"
                title="Zhang Ze Foo"
                description="Founder · Synthetic Biology & Metabolic Engineering"
                footer="View profile"
                external
              />
            </div>
          </div>
        </section>

        {process.env.NODE_ENV === "development" && <DevModePanel />}

        {/* ── FOOTER ── */}
        <footer className={styles.footer}>
          <div className={styles.footerInner}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>
                <Dna size={11} />
              </div>
              <span className={styles.footerBrandName} style={{ fontFamily: H }}>
                Nexus-Bio
              </span>
            </div>
            <div className={styles.footerBadges}>
              {[
                { icon: <ShieldCheck size={10} />, label: "WCAG 2.2 AA" },
                { icon: <Zap size={10} />, label: "INP ≤ 50ms" },
                { icon: <BarChart3 size={10} />, label: "WebGL2 + FSM" },
              ].map(({ icon, label }) => (
                <div key={label} className={styles.footerBadge}>
                  <span className={styles.footerBadgeIcon}>{icon}</span>
                  <span className={styles.footerBadgeLabel} style={{ fontFamily: MONO }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.footerMeta}>
              <p className={styles.footerCopyright} style={{ fontFamily: MONO }}>
                © {new Date().getFullYear()} Nexus-Bio
              </p>
              {["Terms of Service", "Privacy Policy"].map((t, i) => (
                <a
                  key={i}
                  href={t === "Terms of Service" ? "/terms" : "/privacy"}
                  className={styles.footerLink}
                  style={{ fontFamily: H }}
                >
                  {t}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
