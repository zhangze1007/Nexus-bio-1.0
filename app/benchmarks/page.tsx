import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import TrustMetricsDashboard from '../../src/components/reports/TrustMetricsDashboard';
import type { TrustFalsificationMetrics } from '../../src/types/trustMetrics';

export const metadata: Metadata = {
  title: 'Trust Metrics | Nexus-Bio',
  description:
    'Local trust-runtime benchmark report for allowed, gated, and blocked claim-surface decisions.',
};

function readLatestReport(): TrustFalsificationMetrics {
  const reportPath = path.join(process.cwd(), 'reports', 'trust-metrics', 'latest.json');
  const parsed: unknown = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  return parsed as TrustFalsificationMetrics;
}

export default function Page() {
  return <TrustMetricsDashboard report={readLatestReport()} />;
}
