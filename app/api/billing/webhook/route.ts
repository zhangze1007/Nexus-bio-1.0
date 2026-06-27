import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '../../../../src/services/billing/stripeClient';
import type Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('[billing] Checkout completed:', {
        userId: session.metadata?.userId,
        tier: session.metadata?.tier,
        customerId: session.customer,
        subscriptionId: session.subscription,
      });
      // TODO: Update user tier in database when live billing activates
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log('[billing] Subscription updated:', {
        subscriptionId: subscription.id,
        status: subscription.status,
      });
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log('[billing] Subscription canceled:', {
        subscriptionId: subscription.id,
      });
      // TODO: Downgrade user to free tier when live billing activates
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log('[billing] Payment failed:', {
        invoiceId: invoice.id,
        customerId: invoice.customer,
      });
      // TODO: Notify user and pause access when live billing activates
      break;
    }
    default: {
      console.log('[billing] Unhandled event type:', event.type);
    }
  }

  return NextResponse.json({ received: true });
}
