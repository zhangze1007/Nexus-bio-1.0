import { type NextRequest, NextResponse } from 'next/server';
import {
  createOrder,
  initVendorSchema,
  listOrders,
  type VendorOrderItem,
} from '../../../../src/services/vendors/vendorService';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';
import { errorResponse } from '../../../../src/utils/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

/**
 * GET /api/vendors/orders?limit=<n>
 *
 * List all vendor orders, most recent first.
 */
export async function GET(req: NextRequest) {
  try {
    await initVendorSchema();
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;
    const orders = await listOrders(limit);
    return NextResponse.json(
      { ok: true, orders, count: orders.length },
      { headers: getCorsHeaders(req) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list orders';
    return errorResponse(message, 500, undefined, getCorsHeaders(req));
  }
}

/**
 * POST /api/vendors/orders
 *
 * Create a new vendor order.
 *
 * Body: { vendor: string, items: VendorOrderItem[], totalCents: number }
 */
export async function POST(req: NextRequest) {
  try {
    await initVendorSchema();
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid JSON body', 400, undefined, getCorsHeaders(req));
    }

    const { vendor, items, totalCents } = body as {
      vendor?: unknown;
      items?: unknown;
      totalCents?: unknown;
    };

    if (typeof vendor !== 'string' || vendor.trim().length === 0) {
      return errorResponse('Missing or invalid "vendor" field', 400, undefined, getCorsHeaders(req));
    }

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse('"items" must be a non-empty array', 400, undefined, getCorsHeaders(req));
    }

    const validItems: VendorOrderItem[] = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        return errorResponse('Each item must be an object', 400, undefined, getCorsHeaders(req));
      }
      const { name, quantity, unitPriceCents } = item as Record<string, unknown>;
      if (typeof name !== 'string' || name.trim().length === 0) {
        return errorResponse('Each item needs a valid "name"', 400, undefined, getCorsHeaders(req));
      }
      if (typeof quantity !== 'number' || quantity < 1) {
        return errorResponse('Each item needs a "quantity" >= 1', 400, undefined, getCorsHeaders(req));
      }
      if (typeof unitPriceCents !== 'number' || unitPriceCents < 0) {
        return errorResponse('Each item needs a non-negative "unitPriceCents"', 400, undefined, getCorsHeaders(req));
      }
      validItems.push({
        name: name.trim(),
        quantity: Math.floor(quantity),
        unitPriceCents: Math.round(unitPriceCents),
      });
    }

    const computedTotal = typeof totalCents === 'number'
      ? Math.round(totalCents)
      : validItems.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0);

    const order = await createOrder(vendor.trim(), validItems, computedTotal);

    return NextResponse.json(
      { ok: true, order },
      { status: 201, headers: getCorsHeaders(req) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create order';
    return errorResponse(message, 500, undefined, getCorsHeaders(req));
  }
}
