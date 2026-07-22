import { expectedImprovement, upperConfidenceBound } from "../../src/services/doe/acquisition";

describe("acquisition functions", () => {
  it("EI is zero at zero uncertainty", () => {
    expect(expectedImprovement(5, 0, 3)).toBe(0);
  });

  it("EI increases as the predicted mean rises above the incumbent (exploitation)", () => {
    const lo = expectedImprovement(1, 1, 0);
    const hi = expectedImprovement(3, 1, 0);
    expect(hi).toBeGreaterThan(lo);
    expect(hi).toBeGreaterThan(0);
  });

  it("EI increases with posterior uncertainty (exploration)", () => {
    const lo = expectedImprovement(0, 0.5, 0);
    const hi = expectedImprovement(0, 2, 0);
    expect(hi).toBeGreaterThan(lo);
  });

  it("larger xi dampens exploitation-driven EI", () => {
    const base = expectedImprovement(2, 1, 0, 0.01);
    const explore = expectedImprovement(2, 1, 0, 1.0);
    expect(explore).toBeLessThan(base);
  });

  it("UCB rewards both mean and uncertainty", () => {
    expect(upperConfidenceBound(1, 0.5, 2)).toBeCloseTo(2, 6);
    expect(upperConfidenceBound(1, 0, 2)).toBe(1);
    expect(upperConfidenceBound(1, 1, 2)).toBeGreaterThan(upperConfidenceBound(1, 0.5, 2));
  });
});
