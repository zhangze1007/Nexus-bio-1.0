'use client';

import React, { useCallback, useState } from 'react';
import { THEME } from '../../theme';
import ToolShell from './shared/ToolShell';

/* ------------------------------------------------------------------ */
/*  Pricing tiers — mirrors src/services/billing/stripeClient.ts      */
/* ------------------------------------------------------------------ */

interface TierInfo {
  key: 'free' | 'pro' | 'team';
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  limits: { label: string; value: string }[];
  highlight?: boolean;
}

const TIERS: TierInfo[] = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    period: '',
    description: 'Explore Nexus-Bio with basic limits',
    features: [
      'All 14 simulation tools',
      'AI-assisted analysis',
      'Community support',
      'Public project sharing',
    ],
    limits: [
      { label: 'Projects', value: '3' },
      { label: 'AI Queries / day', value: '100' },
      { label: 'FBA Runs / day', value: '50' },
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 29,
    period: '/month',
    description: 'For individual researchers who need more capacity',
    features: [
      'Everything in Free',
      'Priority AI queue',
      'Export to SBML/SBOL',
      'Email support',
      'Advanced visualizations',
    ],
    limits: [
      { label: 'Projects', value: 'Unlimited' },
      { label: 'AI Queries / day', value: '1,000' },
      { label: 'FBA Runs / day', value: '500' },
    ],
    highlight: true,
  },
  {
    key: 'team',
    name: 'Team',
    price: 99,
    period: '/month',
    description: 'For labs and teams collaborating on research',
    features: [
      'Everything in Pro',
      'Unlimited AI queries',
      'Shared workspaces',
      'SSO / institutional auth',
      'Dedicated support',
      'Audit trail & compliance',
    ],
    limits: [
      { label: 'Projects', value: 'Unlimited' },
      { label: 'AI Queries / day', value: 'Unlimited' },
      { label: 'FBA Runs / day', value: 'Unlimited' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Icons (inline SVGs to avoid extra dependency)                      */
/* ------------------------------------------------------------------ */

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CreditCardIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function ExternalLinkIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Tier Card                                                          */
/* ------------------------------------------------------------------ */

function TierCard({
  tier,
  isCurrent,
  onSelect,
  loading,
}: {
  tier: TierInfo;
  isCurrent: boolean;
  onSelect: (key: string) => void;
  loading: boolean;
}) {
  const borderColor = tier.highlight ? THEME.SKY : THEME.BORDER;
  const bgGradient = tier.highlight
    ? `linear-gradient(135deg, ${THEME.PANEL_STRONG} 0%, rgba(81,81,205,0.08) 100%)`
    : THEME.PANEL_STRONG;

  return (
    <div
      style={{
        background: bgGradient,
        border: `1px solid ${borderColor}`,
        borderRadius: THEME.R_LG,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        position: 'relative',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        ...(tier.highlight
          ? { boxShadow: '0 0 24px rgba(81,81,205,0.12)' }
          : {}),
      }}
    >
      {tier.highlight && (
        <div
          style={{
            position: 'absolute',
            top: -1,
            left: '50%',
            transform: 'translateX(-50%)',
            background: THEME.SKY,
            color: '#000',
            fontSize: 11,
            fontFamily: THEME.MONO,
            fontWeight: 600,
            padding: '3px 14px',
            borderRadius: '0 0 8px 8px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Popular
        </div>
      )}

      {/* Header */}
      <div>
        <div
          style={{
            fontSize: 13,
            fontFamily: THEME.MONO,
            color: THEME.LABEL,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 4,
          }}
        >
          {tier.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              fontSize: 36,
              fontFamily: THEME.BRAND,
              fontWeight: 700,
              color: THEME.VALUE,
            }}
          >
            {tier.price === 0 ? 'Free' : `$${tier.price}`}
          </span>
          {tier.period && (
            <span
              style={{
                fontSize: 14,
                fontFamily: THEME.SANS,
                color: THEME.LABEL,
              }}
            >
              {tier.period}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            fontFamily: THEME.SANS,
            color: THEME.LABEL,
            marginTop: 6,
          }}
        >
          {tier.description}
        </div>
      </div>

      {/* Limits */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '14px 0',
          borderTop: `1px solid ${THEME.BORDER}`,
          borderBottom: `1px solid ${THEME.BORDER}`,
        }}
      >
        {tier.limits.map((limit) => (
          <div
            key={limit.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontFamily: THEME.SANS,
                color: THEME.LABEL,
              }}
            >
              {limit.label}
            </span>
            <span
              style={{
                fontSize: 13,
                fontFamily: THEME.MONO,
                color: THEME.VALUE,
                fontWeight: 500,
              }}
            >
              {limit.value}
            </span>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {tier.features.map((feature) => (
          <div
            key={feature}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckIcon color={THEME.MINT} />
            <span
              style={{
                fontSize: 13,
                fontFamily: THEME.SANS,
                color: THEME.LABEL,
              }}
            >
              {feature}
            </span>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      {isCurrent ? (
        <div
          style={{
            padding: '10px 0',
            textAlign: 'center',
            fontSize: 13,
            fontFamily: THEME.MONO,
            color: THEME.DIM,
            border: `1px solid ${THEME.BORDER}`,
            borderRadius: THEME.R_MD,
          }}
        >
          Current Plan
        </div>
      ) : tier.key === 'free' ? (
        <div
          style={{
            padding: '10px 0',
            textAlign: 'center',
            fontSize: 13,
            fontFamily: THEME.MONO,
            color: THEME.DIM,
            border: `1px solid ${THEME.BORDER}`,
            borderRadius: THEME.R_MD,
          }}
        >
          Downgrade
        </div>
      ) : (
        <button
          onClick={() => onSelect(tier.key)}
          disabled={loading}
          style={{
            padding: '10px 0',
            fontSize: 14,
            fontFamily: THEME.SANS,
            fontWeight: 600,
            color: '#000',
            background: tier.highlight ? THEME.SKY : THEME.VALUE,
            border: 'none',
            borderRadius: THEME.R_MD,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {loading ? 'Redirecting...' : `Upgrade to ${tier.name}`}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Billing Page                                                  */
/* ------------------------------------------------------------------ */

export default React.memo(function BillingPage() {
  const [currentTier] = useState<'free' | 'pro' | 'team'>('free');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check URL params for success/cancel on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setSuccess(true);
    }
  }, []);

  const handleSelectTier = useCallback(async (tier: string) => {
    setCheckoutLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setCheckoutLoading(false);
    }
  }, []);

  const handleManageBilling = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to open billing portal');
      }
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, []);

  return (
    <ToolShell
      moduleId="billing"
      title="Billing & Subscription"
      description="Manage your Nexus-Bio plan and billing"
    >
      {/* Status banner */}
      {success && (
        <div
          style={{
            gridColumn: '1 / -1',
            background: 'rgba(147, 203, 82, 0.1)',
            border: `1px solid ${THEME.MINT}`,
            borderRadius: THEME.R_MD,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: THEME.SANS,
            fontSize: 14,
            color: THEME.MINT,
          }}
        >
          <CheckIcon color={THEME.MINT} />
          Subscription activated! Your new plan is now active.
        </div>
      )}

      {error && (
        <div
          style={{
            gridColumn: '1 / -1',
            background: 'rgba(250, 128, 114, 0.1)',
            border: `1px solid ${THEME.CORAL}`,
            borderRadius: THEME.R_MD,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: THEME.SANS,
            fontSize: 14,
            color: THEME.CORAL,
          }}
        >
          {error}
        </div>
      )}

      {/* Billing infrastructure notice */}
      <div
        style={{
          gridColumn: '1 / -1',
          background: 'rgba(81, 81, 205, 0.06)',
          border: '1px solid rgba(81, 81, 205, 0.2)',
          borderRadius: THEME.R_MD,
          padding: '14px 18px',
          fontFamily: THEME.SANS,
          fontSize: 13,
          color: THEME.LABEL,
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: THEME.SKY, fontFamily: THEME.MONO }}>
          Infrastructure Preview
        </strong>
        {' '}&mdash;{' '}
        Billing infrastructure is ready but not yet live. Stripe integration will activate
        once funding is secured. All tools remain free to use in the meantime.
      </div>

      {/* Tier cards */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          padding: '8px 0',
        }}
      >
        {TIERS.map((tier) => (
          <TierCard
            key={tier.key}
            tier={tier}
            isCurrent={currentTier === tier.key}
            onSelect={handleSelectTier}
            loading={checkoutLoading}
          />
        ))}
      </div>

      {/* Manage billing */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 8,
        }}
      >
        <button
          onClick={handleManageBilling}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            fontSize: 13,
            fontFamily: THEME.SANS,
            color: THEME.LABEL,
            background: 'transparent',
            border: `1px solid ${THEME.BORDER}`,
            borderRadius: THEME.R_MD,
            cursor: 'pointer',
            transition: 'color 0.2s, border-color 0.2s',
          }}
        >
          <CreditCardIcon color={THEME.LABEL} />
          Manage Billing
          <ExternalLinkIcon color={THEME.DIM} />
        </button>
      </div>

      {/* Current usage section */}
      <div
        style={{
          gridColumn: '1 / -1',
          background: THEME.PANEL_STRONG,
          border: `1px solid ${THEME.BORDER}`,
          borderRadius: THEME.R_LG,
          padding: 24,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontFamily: THEME.BRAND,
            fontWeight: 600,
            color: THEME.VALUE,
            marginBottom: 18,
          }}
        >
          Current Usage
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {[
            { label: 'Projects Used', current: 1, max: 3 },
            { label: 'AI Queries Today', current: 12, max: 100 },
            { label: 'FBA Runs Today', current: 3, max: 50 },
          ].map((usage) => {
            const pct =
              usage.max === -1
                ? 0
                : Math.min(100, (usage.current / usage.max) * 100);
            return (
              <div key={usage.label}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: THEME.SANS,
                      color: THEME.LABEL,
                    }}
                  >
                    {usage.label}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: THEME.MONO,
                      color: THEME.VALUE,
                    }}
                  >
                    {usage.max === -1
                      ? `${usage.current}`
                      : `${usage.current} / ${usage.max}`}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: THEME.PANEL_BG,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background:
                        pct > 80 ? THEME.CORAL : THEME.MINT,
                      borderRadius: 3,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ToolShell>
  );
});
