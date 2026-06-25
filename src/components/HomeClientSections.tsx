"use client";

/**
 * HomeClientSections — Client-rendered interactive sections of the homepage.
 *
 * Contains: FeaturesArchitecture (ssr:false), Contact section (Reveal + HomeInteractiveCard),
 * and DevModePanel (ssr:false). Extracted from App.tsx to enable server-side rendering
 * of static sections (metrics, CTA, footer) in app/page.tsx.
 */

import { motion, useInView } from "framer-motion";
import { Dna, Linkedin } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef } from "react";
import styles from "../App.module.css";
import { THEME } from "../theme";
import HomeInteractiveCard from "./HomeInteractiveCard";

const FeaturesArchitecture = dynamic(() => import("./FeaturesArchitecture"), { ssr: false });
const DevModePanel = dynamic(() => import("./DevModePanel"), { ssr: false });

const H = THEME.SANS;

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

export default function HomeClientSections() {
  return (
    <>
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
    </>
  );
}
