# Theme Unification Design

**Date:** 2026-06-28
**Status:** Approved
**Goal:** Unify Homepage and Marketing pages to a single B&W (#050505) visual language.

---

## Problem

Homepage and Marketing pages had inconsistent visual styles:

1. **Background colors** — Homepage uses `#050505`, embedded marketing sections use `#0d0f14`, creating visible alternating bands
2. **CTA buttons** — Homepage has white buttons, Marketing has gradient (MINT→SKY) buttons
3. **Footer** — Homepage has compact B&W footer, Marketing has full THEME-tokens footer
4. **Nav** — Homepage uses TopNav, Marketing uses MarketingNav

## Decisions

| Item | Decision |
|------|----------|
| Background | All sections `#050505` (THEME.BG_CANVAS) |
| CTA buttons | White `rgba(255,255,255,0.9)` + dark text |
| Footer | Homepage's compact B&W style, keep as-is |
| Nav | TopNav everywhere |
| Marketing route | Delete `/marketing` route, keep components |

## Changes

### 1. Delete `/marketing` route

**Delete files:**
- `app/marketing/layout.tsx`
- `app/marketing/page.tsx`

**Keep files (used by Homepage):**
- `src/components/marketing/FeatureGrid.tsx`
- `src/components/marketing/PricingTable.tsx`
- `src/components/marketing/TestimonialSection.tsx`
- `src/components/marketing/CTASection.tsx`

**Keep but unused:**
- `src/components/marketing/MarketingNav.tsx`
- `src/components/marketing/MarketingFooter.tsx`
- `src/components/marketing/HeroSection.tsx`

### 2. Add SocialProof to Homepage

Extract `SocialProof` component from `app/marketing/page.tsx` into `src/components/marketing/SocialProof.tsx`.

Insert into `App.tsx` after FeatureGrid, before TestimonialSection:
```
<FeatureGrid />
<SocialProof />    ← NEW
<TestimonialSection />
```

Background: `THEME.BG_CANVAS` (`#050505`).

### 3. Unify background colors

| File | Before | After |
|------|--------|-------|
| `FeatureGrid.tsx` | `THEME.BG_SHELL` | `THEME.BG_CANVAS` |
| `PricingTable.tsx` | `THEME.BG_SHELL` | `THEME.BG_CANVAS` |
| `CTASection.tsx` | `THEME.BG_SHELL` | `THEME.BG_CANVAS` |
| `TestimonialSection.tsx` | Check and unify | `THEME.BG_CANVAS` |
| `SocialProof.tsx` | `#0d0f14` | `THEME.BG_CANVAS` |

### 4. CTA buttons to white

In `CTASection.tsx`:
- Primary button: `background: rgba(255,255,255,0.9)`, `color: THEME.BG_CANVAS`
- Secondary button: keep outline style

### 5. Footer — no changes

Homepage footer stays as-is with B&W minimal style.

## Files Modified

- `app/marketing/layout.tsx` — DELETE
- `app/marketing/page.tsx` — DELETE
- `src/components/marketing/SocialProof.tsx` — NEW (extracted from page.tsx)
- `src/components/marketing/FeatureGrid.tsx` — background color
- `src/components/marketing/PricingTable.tsx` — background color
- `src/components/marketing/CTASection.tsx` — background + button style
- `src/components/marketing/TestimonialSection.tsx` — background color
- `src/App.tsx` — add SocialProof import and section

## Success Criteria

- All homepage sections use `#050505` background
- All CTA buttons use white style
- No `/marketing` route exists
- Homepage includes SocialProof section
- TypeScript compiles, tests pass, biome exits 0
