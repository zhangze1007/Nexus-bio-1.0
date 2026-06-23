/**
 * SABIO-RK Enzyme Kinetics Proxy
 *
 * Proxies requests to the SABIO-RK REST API (Systems Biology of the
 * Reaction Kinetics) for real enzyme kinetics parameters (Km, kcat, Vmax).
 *
 * Runtime: Edge (no auth required, public REST API)
 *
 * References:
 *   - SABIO-RK: Wittig et al. (2012) Nucleic Acids Res. 40:D790-D796
 *   - https://sabiork.h-its.org/
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { errorResponse } from '../../../src/utils/apiErrors';

export const runtime = 'edge';

const EC_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function GET(req: NextRequest) {
  const ecNumber = req.nextUrl.searchParams.get('ec');
  const corsHeaders = getCorsHeaders(req);

  if (!ecNumber || !EC_PATTERN.test(ecNumber)) {
    return errorResponse(
      'Invalid EC number format (expected x.x.x.x)',
      400,
      undefined,
      corsHeaders,
    );
  }

  try {
    const url =
      `https://sabiork.h-its.org/sabioRestWebServices/searchKineticLaws/booleanSearch?` +
      `q=ECNumber:${encodeURIComponent(ecNumber)}&format=json&fields[]=ECNumber&` +
      `fields[]=Parameter&fields[]=EnzymeType&fields[]=Organism&limit=10`;

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'NexusBio/1.0 (academic-research; contact@nexus-bio.vercel.app)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return errorResponse(
        `SABIO-RK returned ${res.status}`,
        502,
        undefined,
        corsHeaders,
      );
    }

    const data = await res.json();
    const kineticParams = parseSabioKineticLaws(data, ecNumber);

    return NextResponse.json(
      { ok: true, ...kineticParams, source: 'sabio_rk', ecNumber },
      {
        status: 200,
        headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
      },
    );
  } catch (err) {
    return errorResponse(
      'SABIO-RK fetch failed',
      502,
      undefined,
      corsHeaders,
    );
  }
}

interface SabioParseResult {
  km: number;
  kcat: number;
  vmax: number;
  organism?: string;
  entryCount: number;
}

function parseSabioKineticLaws(
  data: unknown,
  _ecNumber: string,
): SabioParseResult {
  if (!Array.isArray(data) || data.length === 0) {
    return { km: NaN, kcat: NaN, vmax: NaN, entryCount: 0 };
  }

  const kmValues: number[] = [];
  const kcatValues: number[] = [];
  const vmaxValues: number[] = [];

  for (const entry of data) {
    if (!Array.isArray(entry?.Parameter)) continue;
    for (const param of entry.Parameter) {
      const name: string = (param.Name || '').toLowerCase();
      const val = parseFloat(param.StartValue || param.Value || '');
      if (isNaN(val) || val <= 0) continue;

      if (name.includes('km') || name.includes('michaelis')) {
        kmValues.push(val);
      } else if (
        name.includes('kcat') ||
        name === 'catalytic rate constant'
      ) {
        kcatValues.push(val);
      } else if (
        name.includes('vmax') ||
        name.includes('maximum velocity')
      ) {
        vmaxValues.push(val);
      }
    }
  }

  const median = (arr: number[]): number => {
    if (arr.length === 0) return NaN;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const organism = data[0]?.Organism || undefined;

  return {
    km: Math.round(median(kmValues) * 1000) / 1000,
    kcat: Math.round(median(kcatValues) * 1000) / 1000,
    vmax: Math.round(median(vmaxValues) * 1000) / 1000,
    organism,
    entryCount: data.length,
  };
}
