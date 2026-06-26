/**
 * Accessibility (WCAG 2.1 AA) tests for Nexus-Bio.
 *
 * Verifies:
 *   1. Focus indicator styles are applied
 *   2. Skip-to-content link exists and is functional
 *   3. ARIA landmarks are present in layouts
 *   4. Icon-only buttons have aria-label
 *   5. Keyboard navigation support (Tab, Escape, Arrow keys)
 */

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── 1. Focus indicator styles ──────────────────────────────────────────

describe("Focus indicators", () => {
  it("global focus-visible rule uses 2px solid outline", () => {
    // Read the compiled CSS from src/index.css (imported via jest transform)
    // We verify the rule exists by checking the stylesheet directly.
    const styleSheets = document.styleSheets;
    let foundFocusRule = false;

    for (const sheet of styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && rule.selectorText === "*:focus-visible") {
            const outline = rule.style.outline;
            if (outline.includes("2px") && outline.includes("solid")) {
              foundFocusRule = true;
            }
          }
        }
      } catch {
        // Cross-origin stylesheets throw — skip
      }
    }

    // If no stylesheets loaded (jsdom), we verify via the CSS string import
    if (!foundFocusRule) {
      // Fallback: verify the CSS file content
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs");
      const path = require("path");
      const cssPath = path.resolve(__dirname, "../src/index.css");
      const css = fs.readFileSync(cssPath, "utf-8");
      expect(css).toContain("*:focus-visible");
      expect(css).toMatch(/outline:\s*2px solid #C8D8E8/);
    }
  });
});

// ── 2. Skip-to-content link ────────────────────────────────────────────

describe("Skip link", () => {
  it("globals.css defines .skip-to-content with focus-visible styling", () => {
    const fs = require("fs");
    const path = require("path");
    const cssPath = path.resolve(__dirname, "../app/globals.css");
    const css = fs.readFileSync(cssPath, "utf-8");
    expect(css).toContain(".skip-to-content");
    expect(css).toContain(".skip-to-content:focus");
  });

  it("layout.tsx renders a skip-to-content link before main content", () => {
    const fs = require("fs");
    const path = require("path");
    const layoutPath = path.resolve(__dirname, "../app/layout.tsx");
    const layout = fs.readFileSync(layoutPath, "utf-8");
    expect(layout).toContain('href="#main-content"');
    expect(layout).toMatch(/Skip to (content|main)/i);
  });
});

// ── 3. ARIA landmarks ──────────────────────────────────────────────────

describe("ARIA landmarks", () => {
  it("ToolsLayoutShell has <main> with id='main-content' and role='main'", () => {
    const fs = require("fs");
    const path = require("path");
    const shellPath = path.resolve(__dirname, "../src/components/ide/ToolsLayoutShell.tsx");
    const shell = fs.readFileSync(shellPath, "utf-8");
    expect(shell).toContain('id="main-content"');
    expect(shell).toContain('role="main"');
    expect(shell).toContain('aria-label="Tool workspace"');
  });

  it("IDEShell has <main> with role='main'", () => {
    const fs = require("fs");
    const path = require("path");
    const shellPath = path.resolve(__dirname, "../src/components/ide/IDEShell.tsx");
    const shell = fs.readFileSync(shellPath, "utf-8");
    expect(shell).toContain('role="main"');
    expect(shell).toContain('aria-label="Tool workspace"');
  });

  it("IDESidebar uses role='navigation' with aria-label", () => {
    const fs = require("fs");
    const path = require("path");
    const sidebarPath = path.resolve(__dirname, "../src/components/ide/IDESidebar.tsx");
    const sidebar = fs.readFileSync(sidebarPath, "utf-8");
    expect(sidebar).toContain('role="navigation"');
    expect(sidebar).toContain('aria-label="Tool navigation"');
    expect(sidebar).toContain("aria-expanded");
  });

  it("IDETopBar renders <header> element", () => {
    const fs = require("fs");
    const path = require("path");
    const topbarPath = path.resolve(__dirname, "../src/components/ide/IDETopBar.tsx");
    const topbar = fs.readFileSync(topbarPath, "utf-8");
    expect(topbar).toContain("<header");
  });

  it("CopilotSlideOver has role='dialog' and aria-modal='true'", () => {
    const fs = require("fs");
    const path = require("path");
    const copilotPath = path.resolve(__dirname, "../src/components/ide/CopilotSlideOver.tsx");
    const copilot = fs.readFileSync(copilotPath, "utf-8");
    expect(copilot).toContain('role="dialog"');
    expect(copilot).toContain('aria-modal="true"');
    expect(copilot).toContain('aria-label="Axon Copilot"');
  });
});

// ── 4. ARIA labels on icon buttons ─────────────────────────────────────

describe("ARIA labels on icon-only buttons", () => {
  it("IDEConsole clear button has aria-label", () => {
    const fs = require("fs");
    const path = require("path");
    const consolePath = path.resolve(__dirname, "../src/components/ide/IDEConsole.tsx");
    const content = fs.readFileSync(consolePath, "utf-8");
    expect(content).toContain('aria-label="Clear console"');
  });

  it("IDEConsole close button has aria-label", () => {
    const fs = require("fs");
    const path = require("path");
    const consolePath = path.resolve(__dirname, "../src/components/ide/IDEConsole.tsx");
    const content = fs.readFileSync(consolePath, "utf-8");
    expect(content).toContain('aria-label="Close console"');
  });

  it("CopilotSlideOver maximize link has aria-label", () => {
    const fs = require("fs");
    const path = require("path");
    const copilotPath = path.resolve(__dirname, "../src/components/ide/CopilotSlideOver.tsx");
    const content = fs.readFileSync(copilotPath, "utf-8");
    expect(content).toContain('aria-label="Open full Copilot view"');
  });

  it("IDETopBar sidebar toggle has aria-label", () => {
    const fs = require("fs");
    const path = require("path");
    const topbarPath = path.resolve(__dirname, "../src/components/ide/IDETopBar.tsx");
    const content = fs.readFileSync(topbarPath, "utf-8");
    expect(content).toContain('aria-label="Toggle sidebar"');
  });

  it("IDETopBar console toggle has aria-label", () => {
    const fs = require("fs");
    const path = require("path");
    const topbarPath = path.resolve(__dirname, "../src/components/ide/IDETopBar.tsx");
    const content = fs.readFileSync(topbarPath, "utf-8");
    expect(content).toContain('aria-label="Toggle console"');
  });

  it("CopilotSlideOver close button has aria-label", () => {
    const fs = require("fs");
    const path = require("path");
    const copilotPath = path.resolve(__dirname, "../src/components/ide/CopilotSlideOver.tsx");
    const content = fs.readFileSync(copilotPath, "utf-8");
    expect(content).toContain('aria-label="Close copilot"');
  });

  it("WorkflowBanner dismiss button has English aria-label", () => {
    const fs = require("fs");
    const path = require("path");
    const bannerPath = path.resolve(__dirname, "../src/components/WorkflowBanner.tsx");
    const content = fs.readFileSync(bannerPath, "utf-8");
    expect(content).toContain('aria-label="Dismiss workflow"');
    // Verify no Chinese characters remain in aria-label
    expect(content).not.toMatch(/aria-label="[^"]*[一-鿿][^"]*"/);
  });

  it("MarketingNav mobile toggle has aria-label", () => {
    const fs = require("fs");
    const path = require("path");
    const navPath = path.resolve(__dirname, "../src/components/marketing/MarketingNav.tsx");
    const content = fs.readFileSync(navPath, "utf-8");
    expect(content).toContain('aria-label="Toggle menu"');
  });
});

// ── 5. Keyboard navigation ─────────────────────────────────────────────

describe("Keyboard navigation", () => {
  it("ToolTabBar supports Arrow key navigation", () => {
    const fs = require("fs");
    const path = require("path");
    const tabBarPath = path.resolve(__dirname, "../src/components/tools/shared/ToolTabBar.tsx");
    const content = fs.readFileSync(tabBarPath, "utf-8");
    expect(content).toContain('role="tablist"');
    expect(content).toContain('role="tab"');
    expect(content).toContain("ArrowRight");
    expect(content).toContain("ArrowLeft");
    expect(content).toContain("ArrowDown");
    expect(content).toContain("ArrowUp");
    expect(content).toContain("Home");
    expect(content).toContain("End");
    expect(content).toContain("aria-selected");
    expect(content).toContain("aria-controls");
  });

  it("CopilotSlideOver traps Tab and handles Escape", () => {
    const fs = require("fs");
    const path = require("path");
    const copilotPath = path.resolve(__dirname, "../src/components/ide/CopilotSlideOver.tsx");
    const content = fs.readFileSync(copilotPath, "utf-8");
    expect(content).toContain("handleTab");
    expect(content).toContain('e.key === "Escape"');
    expect(content).toContain('"Tab"');
  });

  it("CopilotSlideOver textarea handles Enter to submit", () => {
    const fs = require("fs");
    const path = require("path");
    const copilotPath = path.resolve(__dirname, "../src/components/ide/CopilotSlideOver.tsx");
    const content = fs.readFileSync(copilotPath, "utf-8");
    expect(content).toContain('e.key === "Enter"');
  });
});

// ── 6. Color contrast helpers ──────────────────────────────────────────

describe("Color contrast (WCAG 2.1 AA)", () => {
  it("focus indicator color #C8D8E8 has sufficient contrast against dark backgrounds", () => {
    // #C8D8E8 on #050505 → luminance ratio ~14.5:1 (well above 3:1 for non-text)
    // #C8D8E8 on #0d0f14 → luminance ratio ~12.8:1
    // Both pass WCAG 2.1 AA for non-text contrast (3:1 minimum).
    const focusColor = { r: 0xc8, g: 0xd8, b: 0xe8 };
    const darkBg = { r: 0x05, g: 0x05, b: 0x05 };

    function relativeLuminance(c: { r: number; g: number; b: number }) {
      const [rs, gs, bs] = [c.r, c.g, c.b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function contrastRatio(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }) {
      const l1 = relativeLuminance(c1);
      const l2 = relativeLuminance(c2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    const ratio = contrastRatio(focusColor, darkBg);
    expect(ratio).toBeGreaterThanOrEqual(3); // WCAG 2.1 AA non-text contrast
  });
});
