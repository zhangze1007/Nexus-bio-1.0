"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { THEME } from "../../theme";

export default function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: THEME.BG_SHELL }}
    >
      {/* Gradient background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{ background: `radial-gradient(circle, ${THEME.MINT} 0%, transparent 70%)` }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
          style={{ background: `radial-gradient(circle, ${THEME.LILAC} 0%, transparent 70%)` }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-10 blur-[80px]"
          style={{ background: `radial-gradient(circle, ${THEME.SKY} 0%, transparent 70%)` }}
        />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(${THEME.BORDER} 1px, transparent 1px), linear-gradient(90deg, ${THEME.BORDER} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 lg:px-8 text-center pt-24 pb-20">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{
            backgroundColor: "rgba(191, 220, 205, 0.08)",
            border: `1px solid rgba(191, 220, 205, 0.2)`,
            fontFamily: THEME.MONO,
            fontSize: "12px",
            color: THEME.MINT,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: THEME.MINT }} />
          Open Source &middot; Built for Researchers
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight mb-6"
          style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}
        >
          The Synthetic Biology{" "}
          <span
            style={{
              background: `linear-gradient(135deg, ${THEME.MINT} 0%, ${THEME.SKY} 50%, ${THEME.LILAC} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Operating System
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}
        >
          Design, simulate, and optimize biological systems with AI-powered tools. From pathway design to protein
          engineering — all in one platform.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/tools"
            className="group flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.03] hover:shadow-lg"
            style={{
              fontFamily: THEME.SANS,
              background: `linear-gradient(135deg, ${THEME.MINT} 0%, ${THEME.SKY} 100%)`,
              color: THEME.BG_SHELL,
              boxShadow: "0 4px 24px rgba(191, 220, 205, 0.2)",
            }}
          >
            Get Started Free
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="https://github.com/zhangze1007/Nexus-bio-1.0"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.03]"
            style={{
              fontFamily: THEME.SANS,
              backgroundColor: "rgba(255,255,255,0.05)",
              color: THEME.VALUE,
              border: `1px solid ${THEME.BORDER}`,
            }}
          >
            <Play size={14} />
            View on GitHub
          </Link>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65 }}
          className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-2xl mx-auto"
        >
          {[
            { value: "14", label: "Integrated Tools" },
            { value: "4", label: "Research Stages" },
            { value: "48h", label: "Built In" },
            { value: "100%", label: "Open Source" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold mb-1" style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}>
                {stat.value}
              </div>
              <div className="text-xs" style={{ fontFamily: THEME.SANS, color: THEME.INK_SOFT }}>
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
