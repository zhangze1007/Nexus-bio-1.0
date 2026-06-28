"use client";

import { motion, useInView } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { THEME } from "../../theme";

export default function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden" style={{ backgroundColor: THEME.BG_SHELL }}>
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full opacity-15 blur-[140px]"
          style={{
            background: "radial-gradient(circle, #BFDCCD 0%, #AFC3D6 50%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 lg:px-8 text-center">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          {/* Headline */}
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight mb-5"
            style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}
          >
            Ready to accelerate{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #BFDCCD 0%, #AFC3D6 50%, #CFC4E3 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              your research
            </span>
            ?
          </h2>

          {/* Subtext */}
          <p
            className="text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed"
            style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}
          >
            Join thousands of synthetic biology researchers using Nexus-Bio to design, simulate, and optimize biological
            systems — all in one open-source platform.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/tools"
              className="group flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.03] hover:shadow-lg"
              style={{
                fontFamily: THEME.SANS,
                background: "linear-gradient(135deg, #BFDCCD 0%, #AFC3D6 100%)",
                color: "#0d0f14",
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
              <BookOpen size={14} />
              View Documentation
            </Link>
          </div>

          {/* Trust note */}
          <p className="text-xs mt-8" style={{ fontFamily: THEME.MONO, color: THEME.INK_SOFT }}>
            No credit card required &middot; Open source &middot; MIT License
          </p>
        </motion.div>
      </div>
    </section>
  );
}
