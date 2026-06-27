"use client";

import { motion, useInView } from "framer-motion";
import { ArrowRight, Github, Globe, GraduationCap, Quote } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import FeatureGrid from "../../src/components/marketing/FeatureGrid";
import HeroSection from "../../src/components/marketing/HeroSection";
import PricingTable from "../../src/components/marketing/PricingTable";
import { THEME } from "../../src/theme";

/* ── Social Proof Section ────────────────────────────────────────────── */

function SocialProof() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-20 lg:py-28" style={{ backgroundColor: "#0d0f14" }}>
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span
            className="inline-block text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-4"
            style={{
              fontFamily: THEME.MONO,
              color: THEME.LILAC,
              backgroundColor: "rgba(207, 196, 227, 0.08)",
              border: "1px solid rgba(207, 196, 227, 0.15)",
            }}
          >
            Story
          </span>
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}
          >
            Built by a Researcher, for Researchers
          </h2>
        </motion.div>

        {/* Story card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="rounded-2xl p-8 lg:p-10 mb-12"
          style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            border: `1px solid ${THEME.BORDER}`,
          }}
        >
          <div className="flex items-start gap-4 mb-6">
            <Quote size={24} style={{ color: THEME.LILAC, opacity: 0.5 }} />
            <p
              className="text-lg leading-relaxed"
              style={{ fontFamily: THEME.SANS, color: THEME.VALUE }}
            >
              Nexus-Bio was built in 48 hours by a Malaysian student on gap year,
              on a tablet. It started as a tool to explore metabolic pathways and
              grew into a full synthetic biology operating system with 14 integrated
              research tools.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #CFC4E3 0%, #AFC3D6 100%)",
              }}
            >
              <GraduationCap size={18} color="#0d0f14" />
            </div>
            <div>
              <p
                className="text-sm font-semibold"
                style={{ fontFamily: THEME.SANS, color: THEME.VALUE }}
              >
                Zhang Ze Foo
              </p>
              <p
                className="text-xs"
                style={{ fontFamily: THEME.SANS, color: THEME.INK_SOFT }}
              >
                STPM Student &middot; Malaysia
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: Github,
              value: "Open Source",
              label: "MIT licensed, fully transparent",
              color: THEME.MINT,
            },
            {
              icon: Globe,
              value: "Global Research",
              label: "Used by synthetic biology researchers worldwide",
              color: THEME.SKY,
            },
            {
              icon: GraduationCap,
              value: "48 Hours",
              label: "From zero to full platform",
              color: THEME.LILAC,
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.value}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className="text-center p-6 rounded-xl"
              style={{
                backgroundColor: "rgba(255,255,255,0.02)",
                border: `1px solid ${THEME.BORDER}`,
              }}
            >
              <stat.icon
                size={24}
                className="mx-auto mb-3"
                style={{ color: stat.color }}
              />
              <p
                className="text-lg font-bold mb-1"
                style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}
              >
                {stat.value}
              </p>
              <p
                className="text-xs"
                style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}
              >
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA Section ─────────────────────────────────────────────────────── */

function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: "#0d0f14" }}>
      <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}
          >
            Ready to Accelerate Your Research?
          </h2>
          <p
            className="text-lg mb-8 max-w-xl mx-auto"
            style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}
          >
            Join researchers using Nexus-Bio to design, simulate, and optimize
            biological systems. Start building today — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/tools"
              className="group flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold transition-all hover:scale-[1.03] hover:shadow-lg"
              style={{
                fontFamily: THEME.SANS,
                background: "linear-gradient(135deg, #BFDCCD 0%, #AFC3D6 100%)",
                color: "#0d0f14",
                boxShadow: "0 4px 24px rgba(191, 220, 205, 0.2)",
              }}
            >
              Get Started Free
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/contact"
              className="px-8 py-4 rounded-xl text-sm font-semibold transition-all hover:scale-[1.03]"
              style={{
                fontFamily: THEME.SANS,
                backgroundColor: "rgba(255,255,255,0.05)",
                color: THEME.VALUE,
                border: `1px solid ${THEME.BORDER}`,
              }}
            >
              Contact Sales
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ── Landing Page ────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeatureGrid />
      <SocialProof />
      <PricingTable />
      <CTASection />
    </>
  );
}
