import { EXCLUDE_SUBSTRINGS, FORBIDDEN } from './config';

export function filterTargets(paths: string[]): { audit: string[]; forbidden: string[] } {
  const audit: string[] = [];
  const forbidden: string[] = [];
  for (const raw of paths) {
    const p = raw.replace(/\\/g, '/');
    if (EXCLUDE_SUBSTRINGS.some((s) => p.includes(s))) continue;
    if (FORBIDDEN.some((f) => p.includes(f))) { forbidden.push(p); continue; }
    audit.push(p);
  }
  return { audit, forbidden };
}
