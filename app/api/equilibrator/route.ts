/**
 * eQuilibrator API Proxy — Condition-aware thermodynamic calculations
 *
 * Proxies requests to the eQuilibrator Python sidecar for real ΔG' calculations
 * with Alberty transform (pH, ionic strength, temperature corrections).
 *
 * Runtime: Node.js (requires Python sidecar)
 *
 * References:
 *   - eQuilibrator 3 (Beber et al. 2022, Nucleic Acids Research)
 *   - Alberty (2003) Thermodynamics of Biochemical Reactions
 */

import { NextRequest, NextResponse } from 'next/server';

// Sidecar configuration
const SIDECAR_URL = process.env.EQUILIBRATOR_SIDECAR_URL || 'http://localhost:5001';
const SIDECAR_TIMEOUT = 10000; // 10 seconds

interface EquilibratorRequest {
  reaction: string;
  pH?: number;
  ionic_strength?: number;
  temperature?: number;
  pMg?: number;
}

interface EquilibratorResponse {
  dG_prime?: number;
  dG_prime_uncertainty?: number;
  dG_prime_units?: string;
  dG_physiological?: number;
  dG_physiological_uncertainty?: number;
  conditions?: {
    pH: number;
    ionic_strength_M: number;
    temperature_K: number;
    pMg: number;
  };
  balanced?: boolean;
  source?: string;
  error?: string;
}

/**
 * POST /api/equilibrator
 *
 * Request body:
 *   - reaction: string (e.g., "kegg:C00002 + kegg:C00001 = kegg:C00008 + kegg:C00009")
 *   - pH: number (optional, default 7.0)
 *   - ionic_strength: number (optional, default 0.25 M)
 *   - temperature: number (optional, default 298.15 K)
 *   - pMg: number (optional, default 3.0)
 *
 * Response:
 *   - dG_prime: number (kJ/mol)
 *   - dG_prime_uncertainty: number (kJ/mol)
 *   - dG_physiological: number (kJ/mol)
 *   - conditions: object
 *   - balanced: boolean
 *   - source: string
 */
export async function POST(request: NextRequest) {
  try {
    const body: EquilibratorRequest = await request.json();

    if (!body.reaction) {
      return NextResponse.json(
        { error: 'Missing required field: reaction' },
        { status: 400 }
      );
    }

    // Forward to sidecar
    const response = await fetch(`${SIDECAR_URL}/calculate`, {
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

    const data: EquilibratorResponse = await response.json();

    if (data.error) {
      return NextResponse.json(data, { status: 400 });
    }

    return NextResponse.json(data);

  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout - eQuilibrator sidecar may be unavailable' },
        { status: 504 }
      );
    }

    // If sidecar is not running, return helpful error
    return NextResponse.json(
      {
        error: 'eQuilibrator sidecar not available',
        hint: 'Start the sidecar: python3 src/server/equilibrator_sidecar.py --port 5001',
        fallback: 'Using reference ΔG° values from Lehninger/NIST'
      },
      { status: 503 }
    );
  }
}

/**
 * GET /api/equilibrator/health
 *
 * Check if eQuilibrator sidecar is running
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
        source: 'eQuilibrator 3 (ComponentContribution)'
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
        error: 'eQuilibrator sidecar not running',
        hint: 'Start: python3 src/server/equilibrator_sidecar.py --port 5001',
        fallback: 'Using reference ΔG° values from Lehninger/NIST'
      },
      { status: 503 }
    );
  }
}
