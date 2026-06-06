# Contributing to Nexus-Bio 1.0

## Getting Started

```bash
git clone https://github.com/zhangze1007/Nexus-bio-1.0.git
cd Nexus-bio-1.0
npm ci
cp .env.example .env.local
npm run dev
```

## Development Workflow

1. Create a branch from `main`: `git checkout -b feature/your-feature`
2. Make your changes
3. Run quality checks: `npx tsc --noEmit && npm test && npm run build`
4. Commit with conventional format (see below)
5. Push and create a PR to `main`

## Commit Message Format

This project uses conventional commits with a scope tag:

```
type(scope): description
```

**Types**: `fix`, `feat`, `docs`, `refactor`, `test`, `ci`, `chore`

**Scopes** (optional but encouraged): `L1`-`L12` (lint), `H1`-`H14` (hygiene), `C1`-`C10` (correctness), `M1`-`M12` (maintenance)

**Examples**:
```
fix(L12): Add 132 unit tests for core solvers
fix(H14): Enable TypeScript strict mode
docs(M11): Document SQLite ephemeral limitation
feat: Add multi-omics VAE embedding worker
```

## Code Style

- **TypeScript**: `strict: true` (fully enforced)
- **Framework**: React 19 + Next.js 15 App Router
- **State**: Zustand for UI state, XState for FSM workflows
- **Testing**: Jest with ts-jest + jsdom environment
- **No light backgrounds**: Dark theme only (`#050505`, `#0d0f14`, `#10131a`)
- **Real algorithms only**: No placeholder math in tool pages

## Testing

```bash
npm test              # Run all unit tests
npm run test:e2e      # Run Playwright E2E tests
npm run analyze       # Bundle size analysis
```

## FORBIDDEN Files

The following files must not be modified without explicit approval:
- `src/components/ide/IDEShell.tsx`, `IDETopBar.tsx`, `IDESidebar.tsx`
- `src/components/tools/DBTLflowPage.tsx`, `GECAIRPage.tsx`, `ProEvolPage.tsx`

See CLAUDE.md for the rationale behind each FORBIDDEN file.

## Pull Request Checklist

- [ ] `npx tsc --noEmit` passes (zero errors)
- [ ] `npm test` passes (no new failures)
- [ ] `npm run build` succeeds
- [ ] No light backgrounds introduced
- [ ] No hardcoded mock responses
- [ ] No `as any` casts without documented justification
- [ ] FORBIDDEN files not modified

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
