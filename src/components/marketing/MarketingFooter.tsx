"use client";

import { Dna, Github, Linkedin, Mail } from "lucide-react";
import Link from "next/link";
import { THEME } from "../../theme";

const FOOTER_LINKS: Record<string, { label: string; href: string; external?: boolean }[]> = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Tools", href: "/tools" },
  ],
  Resources: [
    { label: "GitHub", href: "https://github.com/zhangze1007/Nexus-bio-1.0", external: true },
    { label: "Documentation", href: "#", external: true },
  ],
  Legal: [
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
  ],
};

export default function MarketingFooter() {
  return (
    <footer
      style={{
        backgroundColor: THEME.BG_SHELL,
        borderTop: `1px solid ${THEME.BORDER}`,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand column */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg"
                style={{
                  background: "linear-gradient(135deg, #BFDCCD 0%, #AFC3D6 100%)",
                }}
              >
                <Dna size={16} color="#0d0f14" strokeWidth={2.5} />
              </div>
              <span
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}
              >
                Nexus-Bio
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}>
              The synthetic biology operating system. Design, simulate, and optimize biological systems with AI.
            </p>
            <div className="flex gap-3">
              <a
                href="https://github.com/zhangze1007/Nexus-bio-1.0"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: THEME.LABEL,
                  border: `1px solid ${THEME.BORDER}`,
                }}
                aria-label="GitHub"
              >
                <Github size={16} />
              </a>
              <a
                href="https://linkedin.com/in/zhangze-foo-3575ba359"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: THEME.LABEL,
                  border: `1px solid ${THEME.BORDER}`,
                }}
                aria-label="LinkedIn"
              >
                <Linkedin size={16} />
              </a>
              <a
                href="mailto:fuchanze@gmail.com"
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: THEME.LABEL,
                  border: `1px solid ${THEME.BORDER}`,
                }}
                aria-label="Email"
              >
                <Mail size={16} />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-4"
                style={{ fontFamily: THEME.SANS, color: THEME.VALUE }}
              >
                {category}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors hover:opacity-100"
                      style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: `1px solid ${THEME.BORDER}` }}
        >
          <p className="text-xs" style={{ fontFamily: THEME.SANS, color: THEME.INK_SOFT }}>
            &copy; 2026 Nexus-Bio. All rights reserved.
          </p>
          <p className="text-xs" style={{ fontFamily: THEME.SANS, color: THEME.INK_SOFT }}>
            Built with care in Malaysia
          </p>
        </div>
      </div>
    </footer>
  );
}
