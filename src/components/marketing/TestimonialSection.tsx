"use client";

import { motion, useInView } from "framer-motion";
import { Quote } from "lucide-react";
import { useRef } from "react";
import { THEME } from "../../theme";

interface Testimonial {
  quote: string;
  name: string;
  institution: string;
  role: string;
  accentColor: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Nexus-Bio replaced three separate tools in our workflow. The integrated FBA solver and pathway designer cut our optimization cycle from weeks to days.",
    name: "Dr. Elena Vasquez",
    institution: "MIT Synthetic Biology Center",
    role: "Principal Investigator",
    accentColor: THEME.MINT,
  },
  {
    quote:
      "The protein evolution module with real fitness landscape heatmaps is exactly what we needed. No other platform gives you Pareto-front enzyme design in a browser.",
    name: "Prof. Kenji Tanaka",
    institution: "University of Tokyo, Dept. of Biotechnology",
    role: "Associate Professor",
    accentColor: THEME.SKY,
  },
  {
    quote:
      "As a grad student, having thermodynamics, kinetics, and multi-omics analysis in one place with actual algorithms — not toy demos — has been transformative for my thesis work.",
    name: "Amara Okonkwo",
    institution: "ETH Zurich, Biosystems Science",
    role: "PhD Candidate",
    accentColor: THEME.LILAC,
  },
];

function TestimonialCard({ testimonial, index }: { testimonial: Testimonial; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.12, ease: "easeOut" }}
      className="flex flex-col rounded-2xl p-6 lg:p-8"
      style={{
        backgroundColor: "rgba(255,255,255,0.02)",
        border: `1px solid ${THEME.BORDER}`,
      }}
    >
      {/* Quote icon */}
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg mb-5"
        style={{
          backgroundColor: `${testimonial.accentColor}12`,
          border: `1px solid ${testimonial.accentColor}25`,
        }}
      >
        <Quote size={16} style={{ color: testimonial.accentColor }} />
      </div>

      {/* Quote text */}
      <p className="text-sm leading-relaxed flex-1 mb-6" style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}>
        &ldquo;{testimonial.quote}&rdquo;
      </p>

      {/* Divider */}
      <div className="h-px mb-4" style={{ backgroundColor: THEME.BORDER }} />

      {/* Attribution */}
      <div className="flex items-center gap-3">
        {/* Avatar placeholder with initials */}
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
          style={{
            background: `linear-gradient(135deg, ${testimonial.accentColor}30, ${testimonial.accentColor}10)`,
            border: `1px solid ${testimonial.accentColor}25`,
          }}
        >
          <span
            className="text-xs font-semibold"
            style={{
              fontFamily: THEME.BRAND,
              color: testimonial.accentColor,
            }}
          >
            {testimonial.name
              .split(" ")
              .filter((w) => /^[A-Z]/.test(w))
              .map((w) => w[0])
              .join("")}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ fontFamily: THEME.SANS, color: THEME.VALUE }}>
            {testimonial.name}
          </p>
          <p className="text-xs truncate" style={{ fontFamily: THEME.SANS, color: THEME.INK_SOFT }}>
            {testimonial.role} &middot; {testimonial.institution}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function TestimonialSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: THEME.BG_SHELL }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span
            className="inline-block text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-4"
            style={{
              fontFamily: THEME.MONO,
              color: THEME.SKY,
              backgroundColor: "rgba(175, 195, 214, 0.08)",
              border: "1px solid rgba(175, 195, 214, 0.15)",
            }}
          >
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}>
            Trusted by Researchers
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}>
            Hear from synthetic biology labs using Nexus-Bio to accelerate their research.
          </p>
        </motion.div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {TESTIMONIALS.map((testimonial, i) => (
            <TestimonialCard key={testimonial.name} testimonial={testimonial} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
