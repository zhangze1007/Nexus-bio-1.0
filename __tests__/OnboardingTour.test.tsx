/**
 * OnboardingTour + TemplateSelector tests
 */
import { fireEvent, render, screen } from "@testing-library/react";
import OnboardingTour, { TOUR_STEPS } from "../src/components/onboarding/OnboardingTour";
import TemplateSelector, { TEMPLATES } from "../src/components/onboarding/TemplateSelector";

/* Mock IntersectionObserver for jsdom (framer-motion useInView) */
beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
});

/* ------------------------------------------------------------------ */
/*  OnboardingTour                                                     */
/* ------------------------------------------------------------------ */

describe("OnboardingTour", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onComplete: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders nothing when isOpen is false", () => {
    const { container } = render(<OnboardingTour {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the overlay when isOpen is true", () => {
    render(<OnboardingTour {...defaultProps} />);
    expect(screen.getByTestId("onboarding-overlay")).toBeTruthy();
  });

  it("displays the first step title and text", () => {
    render(<OnboardingTour {...defaultProps} />);
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeTruthy();
    expect(screen.getByText(TOUR_STEPS[0].text)).toBeTruthy();
  });

  it("shows step counter as 1 / N", () => {
    render(<OnboardingTour {...defaultProps} />);
    expect(screen.getByText(`1 / ${TOUR_STEPS.length}`)).toBeTruthy();
  });

  it("advances to the next step when Next is clicked", () => {
    render(<OnboardingTour {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tour-next"));
    expect(screen.getByText(TOUR_STEPS[1].title)).toBeTruthy();
    expect(screen.getByText(`2 / ${TOUR_STEPS.length}`)).toBeTruthy();
  });

  it("goes back to the previous step when Back is clicked", () => {
    render(<OnboardingTour {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tour-next")); // go to step 2
    fireEvent.click(screen.getByTestId("tour-prev")); // go back to step 1
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeTruthy();
  });

  it("disables the Back button on the first step", () => {
    render(<OnboardingTour {...defaultProps} />);
    const prevBtn = screen.getByTestId("tour-prev") as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
  });

  it("calls onClose when the close button is clicked", () => {
    render(<OnboardingTour {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tour-close"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onComplete and onClose when Get Started is clicked on the last step", () => {
    render(<OnboardingTour {...defaultProps} />);
    // Navigate to the last step
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByTestId("tour-next"));
    }
    expect(screen.getByText("Get Started")).toBeTruthy();
    fireEvent.click(screen.getByTestId("tour-next"));
    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("renders progress dots matching the number of steps", () => {
    render(<OnboardingTour {...defaultProps} />);
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      expect(screen.getByTestId(`progress-dot-${i}`)).toBeTruthy();
    }
  });

  it("renders custom steps when provided", () => {
    const custom = [
      { id: "a", title: "Step A", text: "Alpha", target: "body", position: "bottom" as const, icon: TOUR_STEPS[0].icon },
      { id: "b", title: "Step B", text: "Beta", target: "body", position: "bottom" as const, icon: TOUR_STEPS[0].icon },
    ];
    render(<OnboardingTour {...defaultProps} steps={custom} />);
    expect(screen.getByText("Step A")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("calls onClose when backdrop is clicked", () => {
    render(<OnboardingTour {...defaultProps} />);
    fireEvent.click(screen.getByTestId("onboarding-backdrop"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ */
/*  TemplateSelector                                                   */
/* ------------------------------------------------------------------ */

describe("TemplateSelector", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the section heading", () => {
    render(<TemplateSelector />);
    expect(screen.getByText("Start with a Template")).toBeTruthy();
  });

  it("renders all template cards", () => {
    render(<TemplateSelector />);
    for (const t of TEMPLATES) {
      expect(screen.getByText(t.name)).toBeTruthy();
    }
  });

  it("renders tool badges for each template", () => {
    render(<TemplateSelector />);
    expect(screen.getByText("PathD")).toBeTruthy();
    // FBASim appears in both Artemisinin and E. coli templates
    expect(screen.getAllByText("FBASim").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("GECAIR")).toBeTruthy();
  });

  it("renders estimated time for each template", () => {
    render(<TemplateSelector />);
    for (const t of TEMPLATES) {
      expect(screen.getByText(t.estimatedTime)).toBeTruthy();
    }
  });

  it("calls onSelect with the template id when a card is clicked", () => {
    const onSelect = jest.fn();
    render(<TemplateSelector onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId(`template-card-${TEMPLATES[0].id}`));
    expect(onSelect).toHaveBeenCalledWith(TEMPLATES[0].id);
  });

  it("renders a custom title and subtitle", () => {
    render(<TemplateSelector title="Pick One" subtitle="Your call." />);
    expect(screen.getByText("Pick One")).toBeTruthy();
    expect(screen.getByText("Your call.")).toBeTruthy();
  });
});
