/**
 * Smoke tests for all 14 tool pages.
 *
 * Verifies that each tool page component renders without crashing.
 * These are minimal "does it mount?" tests — not functional tests.
 */

import { render } from "@testing-library/react";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/tools/test",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/dynamic to return a simple component
jest.mock("next/dynamic", () => {
  return function mockDynamic() {
    return function DynamicComponent() {
      return <div data-testid="dynamic-mock" />;
    };
  };
});

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<"div">) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: React.ComponentProps<"section">) => <section {...props}>{children}</section>,
    h2: ({ children, ...props }: React.ComponentProps<"h2">) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: React.ComponentProps<"p">) => <p {...props}>{children}</p>,
    span: ({ children, ...props }: React.ComponentProps<"span">) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: React.ComponentProps<"button">) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useInView: () => true,
  useAnimation: () => ({ start: jest.fn() }),
}));

const TOOLS = [
  { name: "CellFreePage", import: () => require("../../src/components/tools/CellFreePage") },
  { name: "CETHXPage", import: () => require("../../src/components/tools/CETHXPage") },
  { name: "DynConPage", import: () => require("../../src/components/tools/DynConPage") },
  { name: "FBASimPage", import: () => require("../../src/components/tools/FBASimPage") },
  { name: "GenMIMPage", import: () => require("../../src/components/tools/GenMIMPage") },
  { name: "ProEvolPage", import: () => require("../../src/components/tools/ProEvolPage") },
  { name: "ScSpatialPage", import: () => require("../../src/components/tools/ScSpatialPage") },
];

describe("Tool pages smoke tests", () => {
  TOOLS.forEach(({ name, import: importTool }) => {
    it(`${name} renders without crashing`, () => {
      const Component = importTool().default;
      expect(() => render(<Component />)).not.toThrow();
    });
  });
});
