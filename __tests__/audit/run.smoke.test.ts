import { runAudit } from '../../scripts/audit/run';
import * as path from 'path';

it('runs the audit over the repo and returns findings + markdown', () => {
  const { markdown, json } = runAudit(path.resolve(__dirname, '../..'));
  expect(markdown).toContain('NEXUS_BIO_INTEGRITY_AUDIT_V2');
  expect(Array.isArray(json)).toBe(true);
  // The scanner must find the module it lives among without crashing.
  expect(markdown).toContain('| Severity | Class | File:Line |');
});
