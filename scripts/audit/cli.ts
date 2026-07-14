import * as fs from 'fs';
import * as path from 'path';
import { runAudit } from './run';

const root = process.cwd();
const { markdown, json } = runAudit(root);
fs.writeFileSync(path.join(root, 'NEXUS_BIO_INTEGRITY_AUDIT_V2.md'), markdown);
fs.writeFileSync(path.join(root, 'scripts/audit/audit-findings.json'), JSON.stringify(json, null, 2));
console.log(`Audit complete: ${json.length} suspects → NEXUS_BIO_INTEGRITY_AUDIT_V2.md`);
