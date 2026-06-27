import type { Metadata } from "next";
import MarketingNav from "../../src/components/marketing/MarketingNav";
import MarketingFooter from "../../src/components/marketing/MarketingFooter";

export const metadata: Metadata = {
  title: "Nexus-Bio | The Synthetic Biology Operating System",
  description:
    "Design, simulate, and optimize biological systems with AI-powered tools. From pathway design to protein engineering — all in one platform.",
  keywords:
    "synthetic biology, metabolic engineering, pathway design, flux balance analysis, protein engineering, bioinformatics, AI research tools",
  openGraph: {
    title: "Nexus-Bio | The Synthetic Biology Operating System",
    description:
      "Design, simulate, and optimize biological systems with AI-powered tools. From pathway design to protein engineering — all in one platform.",
    type: "website",
    url: "https://nexus-bio-1-0.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus-Bio | The Synthetic Biology Operating System",
    description:
      "Design, simulate, and optimize biological systems with AI-powered tools.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0d0f14", color: "#C8D8E8" }}>
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
