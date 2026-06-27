# Contributing to Nexus-Bio

## Development Setup

1. Clone the repository
2. Run `npm ci`
3. Copy `.env.example` to `.env.local`
4. Run `npm run dev`

## Code Style

- TypeScript strict mode
- Dark theme only (no light backgrounds)
- Use `THEME` constants from `src/theme/index.ts`
- Use `meshLambertMaterial` in Three.js

## Testing

- Run `npm test` for unit tests
- Run `npx tsc --noEmit` for type checking
- All tests must pass before PR

## Pull Requests

- Create feature branch from `main`
- Include tests for new features
- Update documentation if needed
