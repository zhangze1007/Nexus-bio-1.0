/**
 * BRENDA Enzyme Database API Proxy
 *
 * Proxies requests to the BRENDA Python sidecar for real enzyme kinetics
 * parameters (Km, kcat, Ki, temperature/pH optima).
 *
 * Runtime: Node.js (requires Python sidecar with zeep)
 *
 * References:
 *   - BRENDA: Chang et al. (2021) Nucleic Acids Res. 49:D498-D508
 *   - Eyring (1935) J. Chem. Phys. 3:107-115
 */

import { NextRequest, NextResponse } from 'next/server';

// Sidecar configuration
const SIDECAR_URL = process.env.BRENDA_SIDECAR_URL || 'http://localhost:5002';
const SIDECAR_TIMEOUT = 15000; // 15 seconds (BRENDA queries can be slow)

interface BrendaKineticsRequest {
  ecNumber: string;
  organism?: string;
}

interface BrendaKineticsResponse {
  ecNumber: string;
  organism?: string;
  km?: {
    median: number | null;
    values: number[];
    unit: string;
    substrates: string[];
    n_observations: number;
  };
  kcat?: {
    median: number | null;
    values: number[];
    unit: string;
    n_observations: number;
  };
  ki?: {
    median: number | null;
    values: number[];
    unit: string;
    n_observations: number;
  };
  specificActivity?: {
    median: number | null;
    values: number[];
    unit: string;
    n_observations: number;
  };
  source?: string;
  citation?: string;
  error?: string;
}

/**
 * POST /api/brenda/kinetics
 *
 * Request body:
 *   - ecNumber: string (required, e.g., "2.7.1.1")
 *   - organism: string (optional, e.g., "Homo sapiens")
 *
 * Response:
 *   - km: { median, values, unit, substrates, n_observations }
 *   - kcat: { median, values, unit, n_observations }
 *   - ki: { median, values, unit, n_observations }
 *   - specificActivity: { median, values, unit, n_observations }
 *   - source: "BRENDA"
 *   - citation: string
 */
export async function POST(request: NextRequest) {
  try {
    const body: BrendaKineticsRequest = await request.json();

    if (!body.ecNumber) {
      return NextResponse.json(
        { error: 'Missing required field: ecNumber' },
        { status: 400 }
      );
    }

    // Forward to sidecar
    const response = await fetch(`${SIDECAR_URL}/kinetics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SIDECAR_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Sidecar error: ${errorText}` },
        { status: 502 }
      );
    }

    const data: BrendaKineticsResponse = await response.json();

    if (data.error) {
      return NextResponse.json(data, { status: 400 });
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout - BRENDA sidecar may be unavailable' },
        { status: 504 }
      );
    }

    // If sidecar is not running, return helpful error
    return NextResponse.json(
      {
        error: 'BRENDA sidecar not available',
        hint: 'Start the sidecar: python3 src/server/brenda_sidecar.py --port 5002',
        fallback: 'Using default enzyme kinetics parameters'
      },
      { status: 503 }
    );
  }
}

/**
 * GET /api/brenda/health
 *
 * Check if BRENDA sidecar is running
 */
export async function GET() {
  try {
    const response = await fetch(`${SIDECAR_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        status: 'ok',
        sidecar: data,
        source: 'BRENDA (Chang et al. 2021)'
      });
    }

    return NextResponse.json(
      { status: 'unavailable', error: 'Sidecar returned non-OK' },
      { status: 502 }
    );

  } catch {
    return NextResponse.json(
      {
        status: 'offline',
        error: 'BRENDA sidecar not running',
        hint: 'Start: python3 src/server/brenda_sidecar.py --port 5002',
        fallback: 'Using default enzyme kinetics parameters'
      },
      { status: 503 }
    );
  }
}
