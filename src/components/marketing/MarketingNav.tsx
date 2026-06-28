"use client";

import { motion } from "framer-motion";
import { Dna, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { THEME } from "../../theme";
import LanguageSwitcher from "../i18n/LanguageSwitcher";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "GitHub", href: "https://github.com/zhangze1007/Nexus-bio-1.0" },
];

export default function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        backgroundColor: "rgba(13, 15, 20, 0.85)",
        borderBottom: `1px solid ${THEME.BORDER}`,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${THEME.MINT} 0%, ${THEME.SKY} 100%)`,
              }}
            >
              <Dna size={16} color={THEME.BG_SHELL} strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}>
              Nexus-Bio
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm transition-colors hover:opacity-100"
                style={{
                  fontFamily: THEME.SANS,
                  color: THEME.LABEL,
                }}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link
              href="/tools"
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02]"
              style={{
                fontFamily: THEME.SANS,
                background: `linear-gradient(135deg, ${THEME.MINT} 0%, ${THEME.SKY} 100%)`,
                color: THEME.BG_SHELL,
              }}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            style={{ color: THEME.LABEL }}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden"
          style={{
            backgroundColor: "rgba(13, 15, 20, 0.95)",
            borderTop: `1px solid ${THEME.BORDER}`,
          }}
        >
          <div className="px-6 py-4 space-y-3">
            <div className="py-2">
              <LanguageSwitcher />
            </div>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-sm py-2"
                style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}
                onClick={() => setMobileOpen(false)}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/tools"
              className="block text-center px-5 py-2.5 rounded-lg text-sm font-semibold mt-2"
              style={{
                fontFamily: THEME.SANS,
                background: `linear-gradient(135deg, ${THEME.MINT} 0%, ${THEME.SKY} 100%)`,
                color: THEME.BG_SHELL,
              }}
              onClick={() => setMobileOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
