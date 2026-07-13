export const AUDIT_GLOBS = [
  'src/server/**/*.ts',
  'src/services/**/*.ts',
  'src/modules/**/*.ts',
  'src/data/**/*.ts',
  'app/api/**/*.ts',
];

export const EXCLUDE_SUBSTRINGS = ['/__tests__/', '__tests__/', '.test.ts', '.test.tsx', '.d.ts', 'node_modules/', '/.next/'];

// Audit-only; never auto-modify (CLAUDE.md FORBIDDEN list).
export const FORBIDDEN = [
  'components/ide/IDEShell', 'components/ide/IDETopBar', 'components/ide/IDESidebar',
  'components/tools/DBTLflowPage', 'components/tools/GECAIRPage', 'components/tools/ProEvolPage',
];

// Legitimate randomness the integrity audit verified — downgraded to 'excluded'.
export interface Acknowledged { fileIncludes: string; snippetIncludes: string; reason: string; }
export const ACKNOWLEDGED: Acknowledged[] = [
  { fileIncludes: 'digitalCellEngine', snippetIncludes: 'p *= Math.random()', reason: 'Knuth Poisson sampler (textbook-correct)' },
  { fileIncludes: 'ProEvolCampaignEngine', snippetIncludes: 'Math.random()', reason: 'design-diversity injection (legit, seed optional)' },
];

// Identifier fragments that mean "this value is a REPORTED result" → random-derived = fabrication.
export const SCORE_NAMES = /(confidence|score|fitness|efficienc|yield|affinity|probabilit|foldabilit|strength|expression|activity|effect|bystander|sensitiv)/i;
