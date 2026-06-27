/**
 * Marketing components tests.
 *
 * Covers TestimonialSection, CTASection, and StatsSection.
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";

// Mock framer-motion — render children directly, expose useInView
jest.mock("framer-motion", () => {
  const actual = jest.requireActual("framer-motion");
  return {
    ...actual,
    motion: {
      ...actual.motion,
      div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
        // Strip animation props to avoid DOM warnings
        const {
          initial: _initial,
          animate: _animate,
          transition: _transition,
          whileInView: _whileInView,
          viewport: _viewport,
          ...rest
        } = props as Record<string, unknown>;
        return <div {...rest}>{children}</div>;
      },
      h2: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
        const {
          initial: _initial,
          animate: _animate,
          transition: _transition,
          whileInView: _whileInView,
          viewport: _viewport,
          ...rest
        } = props as Record<string, unknown>;
        return <h2 {...rest}>{children}</h2>;
      },
    },
    useInView: () => true,
  };
});

// Mock next/link
jest.mock("next/link", () => {
  return ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

import TestimonialSection from "../src/components/marketing/TestimonialSection";
import CTASection from "../src/components/marketing/CTASection";
import StatsSection from "../src/components/marketing/StatsSection";

// ── TestimonialSection ──────────────────────────────────────────────────

describe("TestimonialSection", () => {
  it("renders the section heading", () => {
    render(<TestimonialSection />);
    expect(screen.getByText("Trusted by Researchers")).toBeTruthy();
  });

  it("renders all 3 testimonial quotes", () => {
    render(<TestimonialSection />);
    expect(screen.getByText(/Dr\. Elena Vasquez/)).toBeTruthy();
    expect(screen.getByText(/Prof\. Kenji Tanaka/)).toBeTruthy();
    expect(screen.getByText(/Amara Okonkwo/)).toBeTruthy();
  });

  it("displays each researcher's institution", () => {
    render(<TestimonialSection />);
    expect(screen.getByText(/MIT Synthetic Biology Center/)).toBeTruthy();
    expect(screen.getByText(/University of Tokyo/)).toBeTruthy();
    expect(screen.getByText(/ETH Zurich/)).toBeTruthy();
  });

  it("displays each researcher's role", () => {
    render(<TestimonialSection />);
    expect(screen.getByText(/Principal Investigator/)).toBeTruthy();
    expect(screen.getByText(/Associate Professor/)).toBeTruthy();
    expect(screen.getByText(/PhD Candidate/)).toBeTruthy();
  });

  it("renders quotes with opening quotation marks", () => {
    render(<TestimonialSection />);
    // The component wraps quotes with &ldquo;
    const quotes = screen.getAllByText(/^“/);
    expect(quotes.length).toBe(3);
  });

  it("renders the Testimonials badge label", () => {
    render(<TestimonialSection />);
    expect(screen.getByText("Testimonials")).toBeTruthy();
  });
});

// ── CTASection ──────────────────────────────────────────────────────────

describe("CTASection", () => {
  it("renders the main headline", () => {
    render(<CTASection />);
    expect(screen.getByText(/Ready to accelerate/)).toBeTruthy();
    expect(screen.getByText(/your research/)).toBeTruthy();
  });

  it("renders the Get Started Free button as a link to /tools", () => {
    render(<CTASection />);
    const link = screen.getByText("Get Started Free").closest("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/tools");
  });

  it("renders the View Documentation button linking to GitHub", () => {
    render(<CTASection />);
    const link = screen.getByText("View Documentation").closest("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toContain("github.com");
  });

  it("renders the trust note", () => {
    render(<CTASection />);
    expect(screen.getByText(/No credit card required/)).toBeTruthy();
    expect(screen.getByText(/MIT License/)).toBeTruthy();
  });

  it("renders the subtext paragraph", () => {
    render(<CTASection />);
    expect(
      screen.getByText(/Join thousands of synthetic biology researchers/)
    ).toBeTruthy();
  });
});

// ── StatsSection ────────────────────────────────────────────────────────

describe("StatsSection", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders all 4 stat labels", () => {
    render(<StatsSection />);
    expect(screen.getByText("Integrated Tools")).toBeTruthy();
    expect(screen.getByText("Real Algorithms")).toBeTruthy();
    expect(screen.getByText("Tests")).toBeTruthy();
    expect(screen.getByText("Open Source")).toBeTruthy();
  });

  it("starts counters at 0", () => {
    render(<StatsSection />);
    // Initially counters are at 0 (before animation interval fires)
    // With useInView mocked to true, the effect runs immediately but
    // the first interval tick hasn't happened yet.
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(1);
  });

  it("animates counters to their target values", () => {
    render(<StatsSection />);
    // Advance timers past the animation duration (1600ms)
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByText("20+")).toBeTruthy();
    expect(screen.getByText("1,000+")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("renders the correct number of stat cards", () => {
    const { container } = render(<StatsSection />);
    // Each stat card is a motion.div rendered as a plain <div>
    const statItems = container.querySelectorAll(".text-center");
    expect(statItems.length).toBe(4);
  });
});
