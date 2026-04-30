import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import TrustShowcaseSummary from '../../src/components/reports/TrustShowcaseSummary';
import type { BlockedShowcaseTrace, ShowcaseTrace } from '../../src/types/showcaseTrace';
import { parseShowcaseTraceDocument } from '../../src/validation/showcaseTraceValidator';

export const metadata: Metadata = {
  title: 'Trust-Gated Showcase | Nexus-Bio',
  description:
    'A narrow local showcase showing safe propagation and blocked claim escalation in the Nexus-Bio trust runtime.',
};

function readJson(relativePath: string): unknown {
  const filePath = path.join(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function loadSafeTrace(): ShowcaseTrace {
  const document = parseShowcaseTraceDocument(readJson('examples/showcase/safe-pathway.json'));
  if (!('steps' in document)) {
    throw new Error('safe-pathway.json must contain showcase steps');
  }
  return document;
}

function loadBlockedTrace(): BlockedShowcaseTrace {
  const document = parseShowcaseTraceDocument(readJson('examples/showcase/blocked-cethx-claim.json'));
  if (!('blockedStep' in document)) {
    throw new Error('blocked-cethx-claim.json must contain blockedStep');
  }
  return document;
}

export default function Page() {
  return (
    <TrustShowcaseSummary
      safeTrace={loadSafeTrace()}
      blockedTrace={loadBlockedTrace()}
    />
  );
}
