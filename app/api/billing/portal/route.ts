import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../src/lib/auth';
import { getStripe } from '../../../../src/services/billing/stripeClient';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }

  // TODO: Look up the user's Stripe customer ID from the database
  // For now, this endpoint exists as infrastructure — it will be wired
  // to a real customer ID once billing activates and users have subscriptions.
  const customerId = '';
  if (!customerId) {
    return NextResponse.json(
      { error: 'No billing account found. Please subscribe first.' },
      { status: 404 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/tools/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
