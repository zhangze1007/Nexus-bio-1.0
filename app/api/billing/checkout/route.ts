import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../src/lib/auth';
import { getStripe, PRICING_TIERS } from '../../../../src/services/billing/stripeClient';
import type { Tier } from '../../../../src/services/billing/stripeClient';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let rawTier: unknown;
  try {
    const body = await request.json();
    rawTier = body.tier;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    !rawTier ||
    typeof rawTier !== 'string' ||
    !(rawTier in PRICING_TIERS) ||
    rawTier === 'free'
  ) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }

  const selectedTier = rawTier as Tier;
  const tierConfig = PRICING_TIERS[selectedTier];
  const priceId = 'stripePriceId' in tierConfig ? tierConfig.stripePriceId : '';
  if (!priceId) {
    return NextResponse.json({ error: 'Price not configured' }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/tools/billing?success=true`,
    cancel_url: `${appUrl}/tools/billing?canceled=true`,
    metadata: { userId: session.user.id, tier: selectedTier },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
