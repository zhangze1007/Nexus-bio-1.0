
export const meta = {
  name: 'nexus-bio-audit',
  description: 'Comprehensive multi-role audit of Nexus-Bio 1.0',
  phases: [
    { title: 'Architecture', detail: 'Senior Architect reviews structure, duplication, types' },
    { title: 'Security', detail: 'Security Engineer audits APIs, keys, injection' },
    { title: 'UX', detail: 'UX Designer checks a11y, responsive, errors' },
    { title: 'Performance', detail: 'Performance Engineer analyzes bundle, rendering' },
    { title: 'Synthesis', detail: 'PM consolidates all findings' },
  ],
};

phase('Architecture');
const archFindings = await agent(
  "You are a Senior Software Architect reviewing Nexus-Bio 1.0 at /workspaces/Nexus-bio-1.0. " +
  "Perform a THOROUGH architecture and code quality audit covering: " +
  "1) Project structure and circular dependencies " +
  "2) Code duplication across 14 tool pages in src/components/tools/ " +
  "3) TypeScript type safety - any 'any' types, missing interfaces " +
  "4) State management - Zustand stores and XState machines " +
  "5) Component architecture - size, separation of concerns " +
  "6) API routes - error handling, HTTP status codes " +
  "7) Testing coverage in __tests__/ " +
  "Read: src/App.tsx, src/types.ts, src/store/uiStore.ts, src/store/workbenchStore.ts, app/layout.tsx, app/api/analyze/route.ts, and 2-3 tool pages. " +
  "For each issue provide file path, line number, severity (Critical/High/Medium/Low), and concrete fix with code snippet.",
  { label: 'architect', phase: 'Architecture' }
);

phase('Security');
const securityFindings = await agent(
  "You are a Security Engineer reviewing Nexus-Bio 1.0 at /workspaces/Nexus-bio-1.0. " +
  "Perform a THOROUGH security audit covering: " +
  "1) API key exposure - GROQ_API_KEY and GEMINI_API_KEY protection " +
  "2) Input validation in API routes " +
  "3) XSS vectors - dangerouslySetInnerHTML or unsanitized content " +
  "4) CORS on proxy routes (alphafold, pubchem) " +
  "5) Rate limiting on API endpoints " +
  "6) SQL injection in better-sqlite3 usage " +
  "7) Dependency vulnerabilities in package.json " +
  "8) Hardcoded secrets " +
  "Read: app/api/analyze/route.ts, app/api/alphafold/route.ts, app/api/pubchem/route.ts, app/api/workbench/route.ts, src/server/workbenchDb.ts, package.json, next.config.js. " +
  "For each vulnerability provide severity, attack vector, impact, and concrete fix code.",
  { label: 'security-engineer', phase: 'Security' }
);

phase('UX');
const uxFindings = await agent(
  "You are a UX Designer and Accessibility Expert reviewing Nexus-Bio 1.0 at /workspaces/Nexus-bio-1.0. " +
  "Perform a THOROUGH UX and accessibility audit covering: " +
  "1) Accessibility - ARIA labels, keyboard navigation, screen reader support, color contrast " +
  "2) Responsive design - mobile/tablet support " +
  "3) Loading states for async operations " +
  "4) Error states and error boundaries " +
  "5) Navigation and tool discovery " +
  "6) Visual consistency across pages " +
  "7) Dark theme compliance - any light backgrounds (forbidden: #FFFFFF, #F5F7FA) " +
  "8) Empty states " +
  "Read: src/components/Hero.tsx, src/components/NodePanel.tsx, app/page.tsx, src/components/ide/IDEShell.tsx, src/components/ide/tokens.ts, tailwind.config.js, and 2-3 tool pages. " +
  "For each issue describe the problem, who it affects, severity, and provide fix code.",
  { label: 'ux-designer', phase: 'UX' }
);

phase('Performance');
const perfFindings = await agent(
  "You are a Performance Engineer reviewing Nexus-Bio 1.0 at /workspaces/Nexus-bio-1.0. " +
  "Perform a THOROUGH performance audit covering: " +
  "1) Bundle size - heavy deps like Three.js, 3Dmol.js, framer-motion " +
  "2) Code splitting - are tool pages lazy loaded via Next.js dynamic imports? " +
  "3) Rendering - unnecessary re-renders, missing React.memo/useMemo/useCallback " +
  "4) Three.js optimization - geometry disposal, texture management " +
  "5) API performance - batching, waterfall requests " +
  "6) Caching strategy " +
  "7) SSR vs CSR - proper Next.js server/client component usage " +
  "Read: next.config.js, package.json, src/components/ThreeScene.tsx, app/layout.tsx, and check for dynamic() imports. " +
  "For each issue provide impact estimate, priority, and concrete optimization code.",
  { label: 'perf-engineer', phase: 'Performance' }
);

phase('Synthesis');
const synthesis = await agent(
  "You are a Technical Project Manager consolidating audit findings for Nexus-Bio 1.0. " +
  "Here are findings from 4 specialists:\n\n" +
  "=== ARCHITECT FINDINGS ===\n" + archFindings + "\n\n" +
  "=== SECURITY FINDINGS ===\n" + securityFindings + "\n\n" +
  "=== UX FINDINGS ===\n" + uxFindings + "\n\n" +
  "=== PERFORMANCE FINDINGS ===\n" + perfFindings + "\n\n" +
  "Create a comprehensive action plan with: " +
  "1) Executive Summary - top 5 most critical issues " +
  "2) Prioritized Roadmap organized into phases: " +
  "   Phase 1 (Immediate): Critical security + breaking bugs - fix this week " +
  "   Phase 2 (Short-term): High-priority UX + architecture - fix in 2 weeks " +
  "   Phase 3 (Medium-term): Performance + code quality - fix in 1 month " +
  "   Phase 4 (Long-term): Nice-to-haves " +
  "3) Effort Estimates (S/M/L/XL hours) " +
  "4) Dependencies between fixes " +
  "5) Quick Wins - things fixable in under 30 minutes " +
  "Output in clean markdown with tables and checkboxes.",
  { label: 'project-manager', phase: 'Synthesis' }
);

return synthesis;
