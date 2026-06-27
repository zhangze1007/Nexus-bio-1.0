# Changelog

## [1.0.0] - 2026-06-27
### Added
- 14 synthetic biology tool pages
- AI-powered research assistant (NEXAI)
- Workbench with experiment ledger and audit trail
- Flux Balance Analysis engine
- Michaelis-Menten kinetics simulator
- Protein structure viewer (AlphaFold + RCSB)
- Single-cell spatial omics visualization

### Fixed
- Security: Workbench API authentication and user isolation
- Security: Error message sanitization across all API routes
- Science: FBA ATP yield formula correction
- Science: Cell-free Km unit conversion (mM to nM)
- GDPR: Table name mapping for data deletion/export
- GDPR: Privacy policy accuracy
- Data: Atomic workbench writes
- Performance: Ref-based fluidPointer to prevent 60Hz re-renders
- Infrastructure: Vercel deployment config, maxDuration, lint
- Accessibility: All light backgrounds replaced with dark theme
- QA: CI jest consolidation, coverage thresholds
