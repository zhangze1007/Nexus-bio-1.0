import Stripe from 'stripe';

/**
 * Returns a Stripe client instance, or null if STRIPE_SECRET_KEY is not configured.
 * Graceful degradation: all billing features silently disable when the key is absent.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    if (typeof console !== 'undefined') {
      console.warn('STRIPE_SECRET_KEY not set — billing disabled');
    }
    return null;
  }
  return new Stripe(key, { apiVersion: '2026-06-24.dahlia' });
}

export const PRICING_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    limits: { projects: 3, aiQueries: 100, fbaRuns: 50 },
  },
  pro: {
    name: 'Pro',
    price: 29,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || '',
    limits: { projects: -1, aiQueries: 1000, fbaRuns: 500 },
  },
  team: {
    name: 'Team',
    price: 99,
    stripePriceId: process.env.STRIPE_TEAM_PRICE_ID || '',
    limits: { projects: -1, aiQueries: -1, fbaRuns: -1 },
  },
} as const;

export type Tier = keyof typeof PRICING_TIERS;
