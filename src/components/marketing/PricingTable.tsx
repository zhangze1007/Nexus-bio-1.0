"use client";

import { motion, useInView } from "framer-motion";
import { Check, Minus } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { THEME } from "../../theme";

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: { text: string; included: boolean }[];
  cta: string;
  href: string;
  highlighted?: boolean;
  badge?: string;
}

const TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individual researchers exploring synthetic biology tools.",
    features: [
      { text: "3 active projects", included: true },
      { text: "100 AI queries/day", included: true },
      { text: "All 14 research tools", included: true },
      { text: "Community support", included: true },
      { text: "Export to SBOL/CSV", included: true },
      { text: "Team collaboration", included: false },
      { text: "Audit trail", included: false },
      { text: "Priority support", included: false },
    ],
    cta: "Get Started Free",
    href: "/tools",
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For labs and teams running active research programs.",
    features: [
      { text: "Unlimited projects", included: true },
      { text: "1,000 AI queries/day", included: true },
      { text: "All 14 research tools", included: true },
      { text: "Priority support", included: true },
      { text: "Export to SBOL/CSV", included: true },
      { text: "Team collaboration (up to 5)", included: true },
      { text: "Experiment ledger", included: true },
      { text: "Custom integrations", included: false },
    ],
    cta: "Start Pro Trial",
    href: "/tools",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Team",
    price: "$99",
    period: "/seat/month",
    description: "For research organizations requiring governance and scale.",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Unlimited AI queries", included: true },
      { text: "RBAC & permissions", included: true },
      { text: "Full audit trail", included: true },
      { text: "SSO / SAML", included: true },
      { text: "Dedicated support", included: true },
      { text: "Custom integrations", included: true },
      { text: "SLA guarantee", included: true },
    ],
    cta: "Contact Sales",
    href: "/contact",
  },
];

function TierCard({ tier, index }: { tier: PricingTier; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.12, ease: "easeOut" }}
      className="relative flex flex-col rounded-2xl p-6 lg:p-8"
      style={{
        backgroundColor: tier.highlighted ? "rgba(191, 220, 205, 0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${tier.highlighted ? "rgba(191, 220, 205, 0.2)" : THEME.BORDER}`,
      }}
    >
      {/* Badge */}
      {tier.badge && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
          style={{
            fontFamily: THEME.MONO,
            background: `linear-gradient(135deg, ${THEME.MINT} 0%, ${THEME.SKY} 100%)`,
            color: THEME.BG_SHELL,
          }}
        >
          {tier.badge}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}>
          {tier.name}
        </h3>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-4xl font-bold" style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}>
            {tier.price}
          </span>
          {tier.period && (
            <span className="text-sm" style={{ fontFamily: THEME.SANS, color: THEME.INK_SOFT }}>
              {tier.period}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed" style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}>
          {tier.description}
        </p>
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8 flex-1">
        {tier.features.map((feature) => (
          <li key={feature.text} className="flex items-start gap-2.5">
            {feature.included ? (
              <Check size={15} className="mt-0.5 shrink-0" style={{ color: THEME.MINT }} />
            ) : (
              <Minus size={15} className="mt-0.5 shrink-0" style={{ color: THEME.INK_SOFT }} />
            )}
            <span
              className="text-sm"
              style={{
                fontFamily: THEME.SANS,
                color: feature.included ? THEME.VALUE : THEME.INK_SOFT,
              }}
            >
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={tier.href}
        className="block text-center py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
        style={{
          fontFamily: THEME.SANS,
          ...(tier.highlighted
            ? {
                background: `linear-gradient(135deg, ${THEME.MINT} 0%, ${THEME.SKY} 100%)`,
                color: THEME.BG_SHELL,
                boxShadow: "0 4px 24px rgba(191, 220, 205, 0.2)",
              }
            : {
                backgroundColor: "rgba(255,255,255,0.05)",
                color: THEME.VALUE,
                border: `1px solid ${THEME.BORDER}`,
              }),
        }}
      >
        {tier.cta}
      </Link>
    </motion.div>
  );
}

export default function PricingTable({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className={compact ? "py-16" : "py-24 lg:py-32"} style={{ backgroundColor: THEME.BG_SHELL }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        {!compact && (
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
                color: THEME.APRICOT,
                backgroundColor: "rgba(231, 199, 169, 0.08)",
                border: "1px solid rgba(231, 199, 169, 0.15)",
              }}
            >
              Pricing
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}>
              Simple, Transparent Pricing
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}>
              Start free. Scale as your research grows.
            </p>
          </motion.div>
        )}

        {/* Tiers grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {TIERS.map((tier, i) => (
            <TierCard key={tier.name} tier={tier} index={i} />
          ))}
        </div>

        {/* Enterprise note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-10"
        >
          <p className="text-sm" style={{ fontFamily: THEME.SANS, color: THEME.INK_SOFT }}>
            Need a custom plan?{" "}
            <Link href="/contact" className="underline transition-colors" style={{ color: THEME.MINT }}>
              Contact us for Enterprise pricing
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </section>
  );
}
