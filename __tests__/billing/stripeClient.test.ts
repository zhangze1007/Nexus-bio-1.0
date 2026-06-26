/** @jest-environment node */

// Mock the stripe module to avoid requiring a real API key
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
    billingPortal: { sessions: { create: jest.fn() } },
  }));
});

import { PRICING_TIERS, getStripe } from '../../src/services/billing/stripeClient';

const originalEnv = process.env;

beforeEach(() => {
  jest.restoreAllMocks();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('PRICING_TIERS', () => {
  it('defines exactly three tiers: free, pro, team', () => {
    const keys = Object.keys(PRICING_TIERS);
    expect(keys).toEqual(['free', 'pro', 'team']);
  });

  it('has free tier at $0', () => {
    expect(PRICING_TIERS.free.price).toBe(0);
    expect(PRICING_TIERS.free.name).toBe('Free');
  });

  it('has pro tier at $29', () => {
    expect(PRICING_TIERS.pro.price).toBe(29);
    expect(PRICING_TIERS.pro.name).toBe('Pro');
  });

  it('has team tier at $99', () => {
    expect(PRICING_TIERS.team.price).toBe(99);
    expect(PRICING_TIERS.team.name).toBe('Team');
  });

  it('free tier has finite limits', () => {
    expect(PRICING_TIERS.free.limits.projects).toBe(3);
    expect(PRICING_TIERS.free.limits.aiQueries).toBe(100);
    expect(PRICING_TIERS.free.limits.fbaRuns).toBe(50);
  });

  it('team tier has unlimited limits (-1)', () => {
    expect(PRICING_TIERS.team.limits.projects).toBe(-1);
    expect(PRICING_TIERS.team.limits.aiQueries).toBe(-1);
    expect(PRICING_TIERS.team.limits.fbaRuns).toBe(-1);
  });

  it('pro tier has intermediate limits', () => {
    expect(PRICING_TIERS.pro.limits.projects).toBe(-1); // unlimited
    expect(PRICING_TIERS.pro.limits.aiQueries).toBe(1000);
    expect(PRICING_TIERS.pro.limits.fbaRuns).toBe(500);
  });

  it('free tier has no stripePriceId', () => {
    expect('stripePriceId' in PRICING_TIERS.free).toBe(false);
  });

  it('pro and team tiers have stripePriceId field', () => {
    expect('stripePriceId' in PRICING_TIERS.pro).toBe(true);
    expect('stripePriceId' in PRICING_TIERS.team).toBe(true);
  });
});

describe('getStripe', () => {
  it('returns null when STRIPE_SECRET_KEY is not set', () => {
    delete process.env.STRIPE_SECRET_KEY;
    const stripe = getStripe();
    expect(stripe).toBeNull();
  });

  it('returns null when STRIPE_SECRET_KEY is empty string', () => {
    process.env.STRIPE_SECRET_KEY = '';
    const stripe = getStripe();
    expect(stripe).toBeNull();
  });

  it('returns a Stripe instance when STRIPE_SECRET_KEY is set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
    const stripe = getStripe();
    expect(stripe).not.toBeNull();
  });

  it('logs a warning when STRIPE_SECRET_KEY is not set', () => {
    delete process.env.STRIPE_SECRET_KEY;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    getStripe();
    expect(warnSpy).toHaveBeenCalledWith(
      'STRIPE_SECRET_KEY not set — billing disabled',
    );
    warnSpy.mockRestore();
  });
});
