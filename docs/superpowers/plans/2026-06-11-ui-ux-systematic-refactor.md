# UI/UX Systematic Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all 14 Nexus-Bio tool pages to Apple HIG standard — unified layout, responsive design, progressive disclosure, consistent typography, and polished interactions.

**Architecture:** Layer-by-layer approach: (1) design tokens & CSS foundation, (2) shared components, (3) legacy page migration, (4) per-tool polish, (5) responsive system, (6) animation & onboarding. Each layer builds on the previous.

**Tech Stack:** React 19, TypeScript, Next.js 15, Framer Motion, Zustand, existing `THEME` tokens + `--nb-*` CSS custom properties, existing `design-system/` component library.

---

## File Map

### Files to Create
| File | Responsibility |
|------|---------------|
| `src/components/shared/Skeleton.tsx` | Shimmer loading placeholder |
| `src/components/shared/ConfirmDialog.tsx` | Destructive action confirmation modal |
| `src/components/shared/OnboardingOverlay.tsx` | First-visit 3-step guide |
| `src/components/shared/WhatIsThis.tsx` | Expandable "What is this?" explanation panel |
| `src/components/tools/shared/ResponsiveContainer.tsx` | ResizeObserver-based responsive wrapper |
| `__tests__/Skeleton.test.tsx` | Skeleton component tests |
| `__tests__/ConfirmDialog.test.tsx` | ConfirmDialog tests |

### Files to Modify (shared infrastructure)
| File | Change |
|------|--------|
| `src/theme/index.ts` | FS_XS→11px, add FS_XXL (✅ done) |
| `src/components/tools/shared/toolDesignSystem.css` | --nb-fs-xs→11px, add --nb-fs-xxl (✅ done) |
| `src/components/tools/shared/ToolShell.tsx` | Font fixes, add `?` help button slot |
| `src/components/tools/shared/ResearchAnswerRenderer.tsx` | 8px/9px→10px/11px (✅ done) |
| `src/components/tools/shared/RuntimeGatingNotice.tsx` | 8px/9px→10px/11px (✅ done) |
| `src/components/tools/shared/toolRegistry.ts` | Add `glossary` + `keyConcepts` fields |
| `src/components/tools/shared/FloatingControlRail.tsx` | Responsive: collapse to bottom sheet on mobile |
| `src/components/tools/shared/ModuleCard.tsx` | Hover micro-interaction polish |
| `src/components/tools/shared/ActionButton.tsx` | Hover lift + active press feedback |
| `app/globals.css` | Add skeleton shimmer keyframes, responsive breakpoints |

### Files to Modify (tool pages — 11 modifiable + 3 FORBIDDEN→now open)
| File | Change |
|------|--------|
| `src/components/tools/CatalystDesignerPage.tsx` | Font fixes, add FloatingControlRail to non-viewer tabs |
| `src/components/tools/CellFreePage.tsx` | Responsive SVG, skeleton loading |
| `src/components/tools/CETHXPage.tsx` | Responsive SVG, skeleton loading |
| `src/components/tools/DBTLflowPage.tsx` | **MAJOR**: Migrate to ToolShell + 5 tabs |
| `src/components/tools/DynConPage.tsx` | Responsive SVG, skeleton loading |
| `src/components/tools/FBASimPage.tsx` | Bezier curves in FluxMap, "Run FBA" CTA |
| `src/components/tools/GECAIRPage.tsx` | **MAJOR**: Migrate to ToolShell + 5 tabs |
| `src/components/tools/GenMIMPage.tsx` | Responsive SVG, skeleton loading |
| `src/components/tools/MetabolicEngPage.tsx` | UI detail polish only (keep XState+WebGL) |
| `src/components/tools/MultiOPage.tsx` | Responsive TriPanel, skeleton loading |
| `src/components/tools/NEXAIPage.tsx` | Font fixes, typing indicator |
| `src/components/tools/PathDPage.tsx` | Inherits MetabolicEng upgrades |
| `src/components/tools/ProEvolPage.tsx` | **MAJOR**: Migrate to ToolShell + 5 tabs |
| `src/components/tools/ScSpatialPage.tsx` | Responsive hex grid, drag-drop enhancement |

---

## Task 1: Fix Remaining Tiny Fonts in Shared Components

**Files:**
- Modify: `src/components/tools/shared/ToolShell.tsx`
- Modify: `src/components/tools/shared/ResearchAnswerRenderer.tsx` (✅ done)
- Modify: `src/components/tools/shared/RuntimeGatingNotice.tsx` (✅ done)

- [ ] **Step 1: Verify already-fixed files compile**

Run: `npx tsc --noEmit`
Expected: No new errors from the 3 already-fixed files.

- [ ] **Step 2: Fix remaining 8px/9px in tool pages (batch)**

These files have `fontSize: '8px'` or `fontSize: '9px'`:
- `NEXAIPage.tsx:691` — `'8px'` → `'11px'`
- `NEXAIPage.tsx:647` — `'9px'` → `'11px'`
- `NEXAIPage.tsx:706` — `'8px'` → `'11px'`

Read each file at the relevant lines, fix the fontSize values.

- [ ] **Step 3: Commit font fixes**

```bash
git add -A
git commit -m "fix: raise minimum font size to 11px (Apple HIG compliance)"
```

---

## Task 2: Create Skeleton Component

**Files:**
- Create: `src/components/shared/Skeleton.tsx`
- Test: `__tests__/Skeleton.test.tsx`

- [ ] **Step 1: Create Skeleton component**

```tsx
// src/components/shared/Skeleton.tsx
'use client';
import { THEME } from '@/theme';

interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: 'text' | 'rect' | 'circle';
  count?: number;
  style?: React.CSSProperties;
}

export default function Skeleton({
  width = '100%',
  height = '20px',
  variant = 'rect',
  count = 1,
  style,
}: SkeletonProps) {
  const baseStyle: React.CSSProperties = {
    width,
    height,
    borderRadius: variant === 'circle' ? '50%' : variant === 'text' ? '4px' : THEME.R_SM,
    background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`,
    backgroundSize: '200% 100%',
    animation: 'nb-shimmer 1.5s ease-in-out infinite',
    ...style,
  };

  if (count > 1) {
    return (
      <div style={{ display: 'grid', gap: '8px' }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} style={baseStyle} />
        ))}
      </div>
    );
  }

  return <div style={baseStyle} />;
}
```

- [ ] **Step 2: Add shimmer keyframes to globals.css**

In `app/globals.css`, add after existing `@keyframes`:
```css
@keyframes nb-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 3: Write test**

```tsx
// __tests__/Skeleton.test.tsx
import { render, screen } from '@testing-library/react';
import Skeleton from '@/components/shared/Skeleton';

describe('Skeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('20px');
  });

  it('renders multiple items when count > 1', () => {
    const { container } = render(<Skeleton count={3} />);
    expect(container.querySelectorAll('div > div')).toHaveLength(3);
  });

  it('applies circle variant', () => {
    const { container } = render(<Skeleton variant="circle" width="40px" height="40px" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.borderRadius).toBe('50%');
  });
});
```

- [ ] **Step 4: Run test**

Run: `npx jest __tests__/Skeleton.test.tsx --no-cache`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/Skeleton.tsx __tests__/Skeleton.test.tsx app/globals.css
git commit -m "feat: add Skeleton loading component with shimmer animation"
```

---

## Task 3: Create ConfirmDialog Component

**Files:**
- Create: `src/components/shared/ConfirmDialog.tsx`
- Test: `__tests__/ConfirmDialog.test.tsx`

- [ ] **Step 1: Create ConfirmDialog component**

```tsx
// src/components/shared/ConfirmDialog.tsx
'use client';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '@/theme';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
            style={{
              background: THEME.PANEL_STRONG,
              border: `1px solid ${THEME.BORDER_ACTIVE}`,
              borderRadius: THEME.R_LG,
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: THEME.SHADOW_HIGH,
            }}
          >
            <h3 style={{
              margin: 0, marginBottom: '8px',
              fontFamily: THEME.SANS, fontSize: THEME.FS_LG,
              color: THEME.VALUE, fontWeight: 600,
            }}>
              {title}
            </h3>
            <p style={{
              margin: 0, marginBottom: '20px',
              fontFamily: THEME.SANS, fontSize: THEME.FS_SM,
              color: THEME.LABEL, lineHeight: 1.6,
            }}>
              {message}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={onCancel}
                style={{
                  height: '36px', padding: '0 16px',
                  borderRadius: THEME.R_MD,
                  border: `1px solid ${THEME.BORDER}`,
                  background: 'transparent',
                  color: THEME.LABEL,
                  fontFamily: THEME.SANS, fontSize: THEME.FS_SM,
                  cursor: 'pointer',
                }}
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmRef}
                onClick={onConfirm}
                style={{
                  height: '36px', padding: '0 16px',
                  borderRadius: THEME.R_MD,
                  border: 'none',
                  background: variant === 'destructive' ? THEME.CORAL : THEME.MINT,
                  color: '#0a0a0a',
                  fontFamily: THEME.SANS, fontSize: THEME.FS_SM, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Write test**

```tsx
// __tests__/ConfirmDialog.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

const defaultProps = {
  open: true,
  title: 'Delete item?',
  message: 'This cannot be undone.',
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe('ConfirmDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders title and message when open', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Delete item?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Delete item?')).toBeNull();
  });

  it('calls onConfirm when confirm button clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders custom labels', () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Yes" cancelLabel="No" />);
    expect(screen.getByText('Yes')).toBeTruthy();
    expect(screen.getByText('No')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx jest __tests__/ConfirmDialog.test.tsx --no-cache`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/ConfirmDialog.tsx __tests__/ConfirmDialog.test.tsx
git commit -m "feat: add ConfirmDialog component for destructive actions"
```

---

## Task 4: Add Glossary Data to Tool Registry

**Files:**
- Modify: `src/components/tools/shared/toolRegistry.ts`

- [ ] **Step 1: Read current toolRegistry.ts and add glossary fields**

Add to each `ToolDefinition` type:
```typescript
glossary?: string;      // 1-2 sentence explanation of what the tool does
keyConcepts?: Array<{ term: string; definition: string }>;
```

Add data for all 14 tools. Example for FBASim:
```typescript
{
  id: 'fbasim',
  // ... existing fields ...
  glossary: 'Flux Balance Analysis (FBA) uses linear programming to predict metabolic fluxes. It finds the optimal distribution of reaction rates that maximizes growth while respecting mass balance constraints.',
  keyConcepts: [
    { term: 'Flux', definition: 'Rate of a metabolic reaction (mmol/gDW/h)' },
    { term: 'Objective', definition: 'What to maximize, usually biomass growth' },
    { term: 'Constraint', definition: 'Mass balance and capacity limits on reactions' },
  ],
}
```

Repeat for all 14 tools with accurate scientific descriptions.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/shared/toolRegistry.ts
git commit -m "feat: add glossary and keyConcepts to all 14 tool definitions"
```

---

## Task 5: Create WhatIsThis Component

**Files:**
- Create: `src/components/shared/WhatIsThis.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/shared/WhatIsThis.tsx
'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X } from 'lucide-react';
import { THEME } from '@/theme';

interface WhatIsThisProps {
  title: string;
  description: string;
  keyConcepts?: Array<{ term: string; definition: string }>;
}

export default function WhatIsThis({ title, description, keyConcepts }: WhatIsThisProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: THEME.LABEL, fontFamily: THEME.SANS, fontSize: THEME.FS_XS,
          padding: '4px', borderRadius: THEME.R_SM,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = THEME.VALUE)}
        onMouseLeave={e => (e.currentTarget.style.color = THEME.LABEL)}
        aria-label={`What is ${title}?`}
      >
        <HelpCircle size={14} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100,
              marginTop: '4px',
              width: '340px',
              background: THEME.PANEL_STRONG,
              border: `1px solid ${THEME.BORDER_ACTIVE}`,
              borderRadius: THEME.R_LG,
              padding: '16px',
              boxShadow: THEME.SHADOW_HIGH,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h4 style={{
                margin: 0, fontFamily: THEME.SANS, fontSize: THEME.FS_MD,
                color: THEME.VALUE, fontWeight: 600,
              }}>
                What is {title}?
              </h4>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: THEME.LABEL, padding: '2px',
                }}
              >
                <X size={14} />
              </button>
            </div>
            <p style={{
              margin: 0, marginBottom: keyConcepts?.length ? '12px' : 0,
              fontFamily: THEME.SANS, fontSize: THEME.FS_SM,
              color: THEME.LABEL, lineHeight: 1.6,
            }}>
              {description}
            </p>
            {keyConcepts && keyConcepts.length > 0 && (
              <div style={{ display: 'grid', gap: '6px' }}>
                {keyConcepts.map(({ term, definition }) => (
                  <div key={term} style={{ display: 'flex', gap: '8px' }}>
                    <span style={{
                      fontFamily: THEME.MONO, fontSize: THEME.FS_XS,
                      color: THEME.SKY, fontWeight: 600, flexShrink: 0,
                    }}>
                      {term}
                    </span>
                    <span style={{
                      fontFamily: THEME.SANS, fontSize: THEME.FS_XS,
                      color: THEME.LABEL, lineHeight: 1.5,
                    }}>
                      {definition}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/WhatIsThis.tsx
git commit -m "feat: add WhatIsThis expandable help panel component"
```

---

## Task 6: Create OnboardingOverlay Component

**Files:**
- Create: `src/components/shared/OnboardingOverlay.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/shared/OnboardingOverlay.tsx
'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Beaker, BarChart3, Cpu, FlaskConical } from 'lucide-react';
import { THEME } from '@/theme';
import { usePersistedState } from '@/components/ide/shared/usePersistedState';

const STEPS = [
  {
    icon: Beaker,
    title: 'Welcome to Nexus-Bio',
    body: 'A 4-stage synthetic biology AI research platform. Design pathways, simulate metabolism, engineer genomes, and iterate experiments — all in one place.',
  },
  {
    icon: BarChart3,
    title: '14 Scientific Tools',
    body: 'Each tool implements real algorithms — FBA linear programming, Michaelis-Menten kinetics, thermodynamic ΔG calculations, and more. No placeholder math.',
  },
  {
    icon: Cpu,
    title: 'Ask Axon Anytime',
    body: 'Press Ctrl+K or click the floating button to open the AI copilot. It can analyze data, explain results, and suggest next steps.',
  },
];

export default function OnboardingOverlay() {
  const [done, setDone] = usePersistedState('nexus-bio-onboarding-done', false);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(!done);

  useEffect(() => {
    if (done) setVisible(false);
  }, [done]);

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setDone(true);
      setVisible(false);
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        }}
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: THEME.PANEL_STRONG,
            border: `1px solid ${THEME.BORDER_ACTIVE}`,
            borderRadius: THEME.R_XL,
            padding: '40px',
            maxWidth: '440px',
            width: '90%',
            textAlign: 'center',
            boxShadow: THEME.SHADOW_HIGH,
          }}
        >
          <div style={{
            width: '56px', height: '56px', margin: '0 auto 20px',
            borderRadius: THEME.R_LG,
            background: 'rgba(191,220,205,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={28} color={THEME.MINT} />
          </div>
          <h2 style={{
            margin: '0 0 12px', fontFamily: THEME.SANS,
            fontSize: THEME.FS_XL, color: THEME.VALUE, fontWeight: 700,
          }}>
            {current.title}
          </h2>
          <p style={{
            margin: '0 0 28px', fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM, color: THEME.LABEL, lineHeight: 1.7,
          }}>
            {current.body}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === step ? '24px' : '8px', height: '8px',
                borderRadius: '4px',
                background: i === step ? THEME.MINT : 'rgba(255,255,255,0.15)',
                transition: 'all 0.25s ease',
              }} />
            ))}
          </div>
          <button
            onClick={handleNext}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              height: '44px', padding: '0 28px',
              borderRadius: THEME.R_MD,
              border: 'none',
              background: THEME.MINT,
              color: '#0a0a0a',
              fontFamily: THEME.SANS, fontSize: THEME.FS_MD, fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.1s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {isLast ? 'Get Started' : 'Next'}
            <ArrowRight size={16} />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Integrate into ToolsLayoutShell**

In `src/components/ide/ToolsLayoutShell.tsx`, add import and render:
```tsx
import OnboardingOverlay from '@/components/shared/OnboardingOverlay';
// Inside the return JSX, before closing </>:
<OnboardingOverlay />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/OnboardingOverlay.tsx src/components/ide/ToolsLayoutShell.tsx
git commit -m "feat: add 3-step onboarding overlay for first-visit users"
```

---

## Task 7: Add ResponsiveContainer Utility

**Files:**
- Create: `src/components/tools/shared/ResponsiveContainer.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/tools/shared/ResponsiveContainer.tsx
'use client';
import { useRef, useState, useEffect, type ReactNode } from 'react';

interface ResponsiveContainerProps {
  children: (width: number, height: number) => ReactNode;
  style?: React.CSSProperties;
  minHeight?: number;
}

export default function ResponsiveContainer({
  children,
  style,
  minHeight = 200,
}: ResponsiveContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 520, height: minHeight });

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: Math.floor(entry.contentRect.width),
          height: Math.max(minHeight, Math.floor(entry.contentRect.height)),
        });
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [minHeight]);

  return (
    <div ref={ref} style={{ width: '100%', minHeight, ...style }}>
      {children(size.width, size.height)}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tools/shared/ResponsiveContainer.tsx
git commit -m "feat: add ResponsiveContainer with ResizeObserver for fluid SVG charts"
```

---

## Task 8: Migrate DBTLflowPage to ToolShell

**Files:**
- Modify: `src/components/tools/DBTLflowPage.tsx`
- Modify: `src/components/tools/shared/toolDesignSystem.css` (if needed)

This is the largest single task. DBTLflowPage is ~1300 lines using the old 3-column layout with PATHD_THEME.

- [ ] **Step 1: Read full DBTLflowPage.tsx to understand current structure**

Read the file completely. Map the 3 columns:
- Left sidebar (260px): hypothesis textarea, result inputs, pass/fail toggles, add iteration
- Center: CycleProgressRing, Timeline SVG, iteration history
- Right sidebar (260px): protocol generation, SBOL export, Gibson assembly, delta pack, provenance

- [ ] **Step 2: Define ToolShell tabs**

```typescript
const tabs: ToolTab[] = [
  { id: 'cycle', label: 'Cycle' },
  { id: 'iterations', label: 'Iterations' },
  { id: 'protocol', label: 'Protocol' },
  { id: 'deltapack', label: 'Delta Pack' },
  { id: 'gibson', label: 'Gibson Assembly' },
];
```

- [ ] **Step 3: Restructure as ToolShell**

Replace the outer `<div className="nb-tool-page">` with:
```tsx
<ToolShell
  moduleId="dbtlflow"
  title="DBTL Cycle Tracker"
  description="Design-Build-Test-Learn cycle management with protocol generation and SBOL export"
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  advancedTabIds={['protocol', 'gibson']}
>
  {/* Tab content using ToolTabPanel */}
</ToolShell>
```

- [ ] **Step 4: Move left sidebar content to FloatingControlRail**

The hypothesis textarea, result inputs, and pass/fail toggles go into a FloatingControlRail that appears on the cycle tab.

- [ ] **Step 5: Replace PATHD_THEME/T imports with THEME**

```typescript
// Before
import { PATHD_THEME, T } from '@/theme';
// After
import { THEME } from '@/theme';
```

Replace all `PATHD_THEME.xxx` → `THEME.XXX` and `T.xxx` → `THEME.XXX`.

- [ ] **Step 6: Verify with type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Manual test**

Run: `npm run dev`
Navigate to `/tools/dbtlflow`. Verify:
- All 5 tabs render
- Cycle progress ring displays
- Timeline SVG renders
- Iteration history shows
- Delta pack approval buttons work
- SBOL export works
- Responsive to different widths

- [ ] **Step 8: Commit**

```bash
git add src/components/tools/DBTLflowPage.tsx
git commit -m "refactor(dbtlflow): migrate to ToolShell layout with THEME tokens"
```

---

## Task 9: Migrate GECAIRPage to ToolShell

**Files:**
- Modify: `src/components/tools/GECAIRPage.tsx`

Same approach as Task 8 but for GECAIR.

- [ ] **Step 1: Read full GECAIRPage.tsx**

Map the 3 columns:
- Left sidebar (240px): input A/B sliders, gate type selector, circuit type selector
- Center: CircuitSVG (720x500), phase space heatmap, transfer curves
- Right sidebar (240px): truth table, ODE dynamics, recommendations

- [ ] **Step 2: Define tabs and restructure**

```typescript
const tabs: ToolTab[] = [
  { id: 'circuit', label: 'Circuit' },
  { id: 'phasespace', label: 'Phase Space' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'dynamics', label: 'Dynamics' },
  { id: 'truth', label: 'Truth Table' },
];
```

- [ ] **Step 3: Move sidebar controls to FloatingControlRail**

- [ ] **Step 4: Replace PATHD_THEME/T → THEME**

- [ ] **Step 5: Type check + manual test**

- [ ] **Step 6: Commit**

```bash
git add src/components/tools/GECAIRPage.tsx
git commit -m "refactor(gecair): migrate to ToolShell layout with THEME tokens"
```

---

## Task 10: Migrate ProEvolPage to ToolShell

**Files:**
- Modify: `src/components/tools/ProEvolPage.tsx`

- [ ] **Step 1: Read full ProEvolPage.tsx**

Map the current custom layout:
- Campaign builder, variant library, lineage trace, activity landscape

- [ ] **Step 2: Define tabs and restructure**

```typescript
const tabs: ToolTab[] = [
  { id: 'landscape', label: 'Landscape' },
  { id: 'trajectory', label: 'Trajectory' },
  { id: 'library', label: 'Library' },
  { id: 'lineage', label: 'Lineage' },
  { id: 'campaign', label: 'Campaign' },
];
```

- [ ] **Step 3: Replace PROEVOL_THEME → THEME**

- [ ] **Step 4: Type check + manual test**

- [ ] **Step 5: Commit**

```bash
git add src/components/tools/ProEvolPage.tsx
git commit -m "refactor(proevol): migrate to ToolShell layout with THEME tokens"
```

---

## Task 11: Add Skeleton Loading to All Tool Pages

**Files:**
- Modify: `src/components/tools/FBASimPage.tsx`
- Modify: `src/components/tools/CETHXPage.tsx`
- Modify: `src/components/tools/CellFreePage.tsx`
- Modify: `src/components/tools/DynConPage.tsx`
- Modify: `src/components/tools/GenMIMPage.tsx`
- Modify: `src/components/tools/MultiOPage.tsx`
- Modify: `src/components/tools/ScSpatialPage.tsx`
- Modify: `src/components/tools/CatalystDesignerPage.tsx`

For each tool page that does computation (FBA solve, eQuilibrator API, VAE training, ODE simulation):

- [ ] **Step 1: Add loading state to each tool**

Example for FBASimPage:
```tsx
import Skeleton from '@/components/shared/Skeleton';

// In the render, when loading:
{loading ? (
  <div style={{ display: 'grid', gap: '12px' }}>
    <Skeleton height="300px" />
    <div style={{ display: 'flex', gap: '8px' }}>
      <Skeleton width="120px" height="80px" />
      <Skeleton width="120px" height="80px" />
      <Skeleton width="120px" height="80px" />
    </div>
  </div>
) : (
  /* normal content */
)}
```

- [ ] **Step 2: Repeat for each tool page**

- [ ] **Step 3: Type check + commit**

```bash
git add src/components/tools/
git commit -m "feat: add skeleton loading states to all computation-heavy tools"
```

---

## Task 12: Make SVG Charts Responsive

**Files:**
- Modify: `src/components/tools/CellFreePage.tsx`
- Modify: `src/components/tools/CETHXPage.tsx`
- Modify: `src/components/tools/DynConPage.tsx`
- Modify: `src/components/tools/GenMIMPage.tsx`
- Modify: `src/components/tools/MultiOPage.tsx`

For each tool with hardcoded SVG viewBox dimensions:

- [ ] **Step 1: Replace fixed viewBox with ResponsiveContainer**

Example for CETHXPage waterfall chart:
```tsx
import ResponsiveContainer from '@/components/tools/shared/ResponsiveContainer';

// Before:
<svg viewBox="0 0 520 356" width={520} height={356}>

// After:
<ResponsiveContainer minHeight={356}>
  {(w, h) => (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="xMidYMid meet">
      {/* chart content using w/h for calculations */}
    </svg>
  )}
</ResponsiveContainer>
```

- [ ] **Step 2: Repeat for each chart**

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/
git commit -m "feat: make all SVG charts responsive with ResponsiveContainer"
```

---

## Task 13: Add Micro-Interactions to Shared Components

**Files:**
- Modify: `src/components/tools/shared/ActionButton.tsx`
- Modify: `src/components/tools/shared/ModuleCard.tsx`
- Modify: `src/components/tools/shared/toolDesignSystem.css`

- [ ] **Step 1: Add hover lift to ActionButton**

In the button's style, add:
```css
transition: transform 0.12s ease, box-shadow 0.12s ease, background 80ms, border-color 80ms;
```
On hover:
```css
transform: translateY(-1px);
box-shadow: var(--nb-shadow-low);
```
On active:
```css
transform: translateY(0);
box-shadow: none;
```

- [ ] **Step 2: Add hover lift to ModuleCard**

Already has framer-motion layout. Add to hover state:
```css
boxShadow: THEME.SHADOW_LOW
```

- [ ] **Step 3: Add .nb-btn hover lift to CSS**

In `toolDesignSystem.css`, update `.nb-btn:hover`:
```css
.nb-btn:hover:not(:disabled) {
  background: var(--nb-hover-bg);
  border-color: var(--nb-border-hover);
  color: var(--nb-text-value);
  transform: translateY(-1px);
  box-shadow: var(--nb-shadow-low);
}
.nb-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: none;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tools/shared/ActionButton.tsx src/components/tools/shared/ModuleCard.tsx src/components/tools/shared/toolDesignSystem.css
git commit -m "feat: add hover lift and active press micro-interactions"
```

---

## Task 14: Upgrade MetabolicEngPage UI Details

**Files:**
- Modify: `src/components/tools/MetabolicEngPage.tsx`

Keep XState + WebGL architecture. Only upgrade UI details.

- [ ] **Step 1: Fix any 8px/9px fonts**

- [ ] **Step 2: Replace any hardcoded colors with THEME tokens**

- [ ] **Step 3: Replace any ad-hoc buttons with ActionButton**

- [ ] **Step 4: Commit**

```bash
git add src/components/tools/MetabolicEngPage.tsx
git commit -m "polish(metabolic-eng): upgrade UI details to design system tokens"
```

---

## Task 15: Upgrade Remaining Tool Pages (Polish Pass)

**Files:**
- Modify: `src/components/tools/NEXAIPage.tsx`
- Modify: `src/components/tools/PathDPage.tsx`
- Modify: `src/components/tools/ScSpatialPage.tsx`

- [ ] **Step 1: NEXAI font fixes + typing indicator**

Fix 8px fonts. Add a typing indicator skeleton when AI is responding.

- [ ] **Step 2: PathDPage inherits MetabolicEng upgrades**

PathDPage is a 7-line wrapper — verify it picks up MetabolicEng changes.

- [ ] **Step 3: ScSpatial drag-drop enhancement**

Enhance file upload with visual drag-drop feedback.

- [ ] **Step 4: Commit**

```bash
git add src/components/tools/NEXAIPage.tsx src/components/tools/PathDPage.tsx src/components/tools/ScSpatialPage.tsx
git commit -m "polish: upgrade NEXAI, PathD, ScSpatial UI details"
```

---

## Task 16: Enhance Tools Directory Page

**Files:**
- Modify: `src/components/tools/ToolsDirectoryPage.tsx`

- [ ] **Step 1: Add "Recommended" section**

Add a recommended workflow section at the top:
```
🚀 Recommended for you
[PathD] → [FBASim] → [CATDES] → [DBTL]
 Start     Simulate    Design     Track
```

- [ ] **Step 2: Organize tools by stage**

Group the 14 tools by their 4 stages (from workbenchConfig):
- Stage 1: Design (PathD, LAB)
- Stage 2: Simulate (FBASim, CETHX, CATDES, ProEvol, CellFree)
- Stage 3: Engineer (GenMIM, GECAIR, DynCon)
- Stage 4: Test (DBTLflow, MultiO, ScSpatial)
- Cross-cutting: NEXAI

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/ToolsDirectoryPage.tsx
git commit -m "feat: enhance tools directory with recommended workflow and stage grouping"
```

---

## Task 17: Final Verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Successful build

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
Navigate through all 14 tool pages and verify:
- All pages render without errors
- Tabs work
- FloatingControlRail opens/closes
- Skeleton loading appears during computation
- WhatIsThis help panels open
- Onboarding overlay shows on first visit
- Responsive at different widths (resize browser)
- No 8px/9px text visible

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete UI/UX systematic refactor — Apple HIG compliance"
```
