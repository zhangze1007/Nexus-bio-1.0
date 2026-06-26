"use client";

import { motion } from "framer-motion";
import { Check, HelpCircle, Minus } from "lucide-react";
import Link from "next/link";
import PricingTable from "../../../src/components/marketing/PricingTable";
import { THEME } from "../../../src/theme";

interface FeatureRow {
  name: string;
  tooltip?: string;
  free: boolean | string;
  pro: boolean | string;
  team: boolean | string;
}

const FEATURE_COMPARISON: FeatureRow[] = [
  // Core
  { name: "Active projects", free: "3", pro: "Unlimited", team: "Unlimited" },
  { name: "AI queries per day", free: "100", pro: "1,000", team: "Unlimited" },
  { name: "All 14 research tools", free: true, pro: true, team: true },
  { name: "Export to SBOL / CSV", free: true, pro: true, team: true },
  // Collaboration
  { name: "Team members", free: "1", pro: "Up to 5", team: "Unlimited" },
  { name: "Shared workspaces", free: false, pro: true, team: true },
  { name: "Experiment ledger", free: false, pro: true, team: true },
  { name: "Role-based access control", free: false, pro: false, team: true },
  // Governance
  { name: "Audit trail", free: false, pro: "Basic", team: "Full" },
  { name: "Decision trace", free: false, pro: true, team: true },
  { name: "Evidence trace", free: false, pro: false, team: true },
  { name: "SSO / SAML", free: false, pro: false, team: true },
  // Support
  { name: "Community support", free: true, pro: true, team: true },
  { name: "Priority email support", free: false, pro: true, team: true },
  { name: "Dedicated account manager", free: false, pro: false, team: true },
  { name: "SLA guarantee", free: false, pro: false, team: true },
  // Advanced
  {
    name: "Custom integrations",
    tooltip: "API access and webhook integrations",
    free: false,
    pro: false,
    team: true,
  },
  {
    name: "On-premise deployment",
    tooltip: "Self-hosted option for air-gapped environments",
    free: false,
    pro: false,
    team: true,
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check size={16} style={{ color: THEME.MINT }} />
    ) : (
      <Minus size={16} style={{ color: THEME.INK_SOFT }} />
    );
  }
  return (
    <span
      className="text-sm font-medium"
      style={{ fontFamily: THEME.SANS, color: THEME.VALUE }}
    >
      {value}
    </span>
  );
}

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section
        className="pt-32 pb-16"
        style={{ backgroundColor: "#0d0f14" }}
      >
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span
              className="inline-block text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-6"
              style={{
                fontFamily: THEME.MONO,
                color: THEME.APRICOT,
                backgroundColor: "rgba(231, 199, 169, 0.08)",
                border: "1px solid rgba(231, 199, 169, 0.15)",
              }}
            >
              Pricing
            </span>
            <h1
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}
            >
              Plans for Every Scale
            </h1>
            <p
              className="text-lg max-w-xl mx-auto"
              style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}
            >
              From individual researchers to enterprise teams. Start free, upgrade when you need more.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing cards */}
      <PricingTable compact />

      {/* Feature comparison table */}
      <section className="py-16 lg:py-24" style={{ backgroundColor: "#0d0f14" }}>
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2
              className="text-2xl md:text-3xl font-bold mb-3"
              style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}
            >
              Feature Comparison
            </h2>
            <p
              className="text-sm"
              style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}
            >
              A detailed look at what each plan includes.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="rounded-2xl overflow-hidden"
            style={{
              border: `1px solid ${THEME.BORDER}`,
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    style={{
                      backgroundColor: "rgba(255,255,255,0.03)",
                      borderBottom: `1px solid ${THEME.BORDER}`,
                    }}
                  >
                    <th
                      className="text-left py-4 px-6 text-sm font-semibold"
                      style={{ fontFamily: THEME.SANS, color: THEME.VALUE, width: "40%" }}
                    >
                      Feature
                    </th>
                    <th
                      className="text-center py-4 px-4 text-sm font-semibold"
                      style={{ fontFamily: THEME.SANS, color: THEME.VALUE, width: "20%" }}
                    >
                      Free
                    </th>
                    <th
                      className="text-center py-4 px-4 text-sm font-semibold"
                      style={{ fontFamily: THEME.SANS, color: THEME.MINT, width: "20%" }}
                    >
                      Pro
                    </th>
                    <th
                      className="text-center py-4 px-4 text-sm font-semibold"
                      style={{ fontFamily: THEME.SANS, color: THEME.VALUE, width: "20%" }}
                    >
                      Team
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_COMPARISON.map((row, i) => (
                    <tr
                      key={row.name}
                      style={{
                        borderBottom:
                          i < FEATURE_COMPARISON.length - 1
                            ? `1px solid ${THEME.BORDER}`
                            : undefined,
                        backgroundColor:
                          i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                      }}
                    >
                      <td
                        className="py-3.5 px-6 text-sm flex items-center gap-2"
                        style={{ fontFamily: THEME.SANS, color: THEME.VALUE }}
                      >
                        {row.name}
                        {row.tooltip && (
                          <span title={row.tooltip}>
                            <HelpCircle
                              size={13}
                              style={{ color: THEME.INK_SOFT }}
                            />
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <CellValue value={row.free} />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <CellValue value={row.pro} />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <CellValue value={row.team} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Enterprise CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 text-center rounded-2xl p-8"
            style={{
              backgroundColor: "rgba(255,255,255,0.02)",
              border: `1px solid ${THEME.BORDER}`,
            }}
          >
            <h3
              className="text-xl font-bold mb-2"
              style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}
            >
              Need a Custom Plan?
            </h3>
            <p
              className="text-sm mb-6 max-w-md mx-auto"
              style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}
            >
              Enterprise customers get custom integrations, on-premise deployment,
              dedicated support, and volume discounts.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
              style={{
                fontFamily: THEME.SANS,
                backgroundColor: "rgba(255,255,255,0.05)",
                color: THEME.VALUE,
                border: `1px solid ${THEME.BORDER}`,
              }}
            >
              Contact Sales
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
