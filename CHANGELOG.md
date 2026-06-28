# Changelog

All notable changes to Nexus-Bio 1.0 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- Security: Restrict same-origin trust to GET/HEAD/OPTIONS only (R-04)
- Security: Replace client-controlled actor ID with authenticated session (R-03)
- Security: Add membership verification to workbench PUT handler (R-19)
- Security: Add fetch timeouts to all proxy routes (R-06)
- Security: Add body size limit to AlphaFold POST (R-09)
- Security: Tighten KEGG input regex (R-15)
- Security: Sanitize barcode SVG in LabelGenerator (R-16)
- Security: Remove ignoreBuildErrors from next.config (R-25)
- Science: Fix FBA ATP yield calculation (remove PDH coefficient) (R-07)
- Science: Fix Eyring kinetics unit mismatch (R-29)
- Science: Document Community FBA heuristic scaling factors (R-08)
- Accessibility: Fix PAPER_ELEVATED near-white background (R-20)
- Accessibility: Restore focus indicators in CSS modules (R-21)
- State: Add clearSelectedNode action for route-change cleanup (R-12)
- State: Add localStorage size check in workbenchStore (R-13)
- Compliance: Add GDPR Art. 6 legal basis to privacy policy (R-34)
- 3D: Fix meshPhysicalMaterial type cast (R-38)
- 3D: Add DPR cap to ScSpatialViewport (R-39)
- QA: Raise coverage thresholds (R-23)
- Theme: Unify all sections to #050505 background
- Theme: Replace hardcoded hex/rgba with THEME tokens
- Theme: Fix HomeInteractiveCard font families
- CI: Fix 3 flaky tests (mdIntegrator, ssoService, performanceBenchmark)
- CI: Fix biome formatter errors
- CI: Add NEXUS_API_KEY to E2E environment
- CI: Allow API key auth in workbench GET handler

### Added
- SocialProof section on homepage
- Enterprise audit report (40 findings)
- CHANGELOG.md

### Removed
- /marketing route (sections embedded in homepage)
- MarketingNav and MarketingFooter from active use

## [1.0.0] - 2026-06-20

### Added
- 14 integrated synthetic biology tools
- 3D pathway visualization (Three.js + WebGL)
- AI-powered analysis (Groq + Gemini fallback)
- Flux Balance Analysis engine (simplex LP)
- Protein evolution fitness landscape
- Gene circuit reasoner (Hill functions)
- Dynamic bioreactor control (RK4 ODE)
- Multi-omics integration (VAE/UMAP)
- Single-cell spatial analysis
- Workbench state persistence (SQLite)
- E2E test suite (Playwright)
- WCAG 2.1 AA accessibility baseline
