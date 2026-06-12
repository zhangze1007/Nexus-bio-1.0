'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import {
  User, Save, CheckCircle, AlertCircle, Building2, FlaskConical,
  Hash, FileText, ExternalLink, ArrowLeft, Sparkles, BookOpen,
  Microscope, TrendingUp, Clock, Home,
} from 'lucide-react';
import Link from 'next/link';
import { THEME } from '../../src/theme';

/**
 * Profile Page — Research Identity
 *
 * Design direction: Institutional authority meets research precision.
 * The profile page should feel like a researcher's digital identity card,
 * not a generic settings form.
 */

// ─── Map old T tokens to THEME equivalents ────────────────────────────────

const T = {
  ...THEME,
  BG: THEME.PAPER,
  CARD: THEME.PANEL_STRONG,
  CARD_BORDER: THEME.PAPER_BORDER,
  INSET: THEME.PANEL_INSET,
  INK_MID: THEME.LABEL,
  INK_GHOST: THEME.INK_SOFT,
  NEON_SUCCESS: THEME.NEON_SUCCESS,
  NEON_DANGER: THEME.NEON_DANGER,
  SERIF: THEME.BRAND,
  SP_XL: 40,
  SP_2XL: 64,
};

// ─── Types ────────────────────────────────────────────────────────────────

interface ProfileData {
  name: string;
  email: string;
  image: string | null;
  institution: string;
  research_area: string;
  orcid: string;
  bio: string;
}

// ─── Expertise Tags ───────────────────────────────────────────────────────

const EXPERTISE_SUGGESTIONS = [
  'Metabolic Engineering', 'Synthetic Biology', 'CRISPR', 'Protein Engineering',
  'Flux Balance Analysis', 'Pathway Design', 'Cell-Free Systems', 'Fermentation',
  'Multi-Omics', 'Machine Learning', 'Directed Evolution', 'Bioinformatics',
  'Systems Biology', 'Genome Engineering', 'Bioprocess Engineering',
];

function ExpertiseTag({ label, selected, onToggle }: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: '5px 12px',
        borderRadius: 20,
        background: selected ? 'rgba(191, 220, 205, 0.12)' : T.INSET,
        border: `1px solid ${selected ? 'rgba(191, 220, 205, 0.25)' : T.CARD_BORDER}`,
        color: selected ? T.MINT : T.INK_SOFT,
        fontFamily: T.SANS,
        fontSize: '12px',
        fontWeight: selected ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'rgba(191, 220, 205, 0.12)';
          e.currentTarget.style.color = T.INK_MID;
        }
      }}
      onMouseLeave={e => {
        if (!selected) {
          e.currentTarget.style.borderColor = T.CARD_BORDER;
          e.currentTarget.style.color = T.INK_SOFT;
        }
      }}
    >
      {label}
    </button>
  );
}

// ─── Profile Completeness ─────────────────────────────────────────────────

function CompletenessRing({ percent }: { percent: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: T.SP_SM,
    }}>
      <div style={{ position: 'relative', width: 68, height: 68 }}>
        <svg width={68} height={68} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background ring */}
          <circle
            cx={34} cy={34} r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth={4}
          />
          {/* Progress ring */}
          <circle
            cx={34} cy={34} r={radius}
            fill="none"
            stroke={percent >= 80 ? T.NEON_SUCCESS : percent >= 40 ? T.MINT : T.APRICOT}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        {/* Center text */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: T.MONO,
          fontSize: '14px',
          fontWeight: 600,
          color: T.INK,
        }}>
          {percent}%
        </div>
      </div>
      <span style={{
        fontFamily: T.MONO,
        fontSize: '10px',
        color: T.INK_GHOST,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        Complete
      </span>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, value, label, color }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div style={{
      flex: 1,
      padding: T.SP_MD,
      borderRadius: T.R_MD,
      background: T.INSET,
      border: `1px solid ${T.CARD_BORDER}`,
      textAlign: 'center',
    }}>
      <Icon size={16} style={{ color, marginBottom: T.SP_SM }} />
      <div style={{
        fontFamily: T.SERIF,
        fontSize: '20px',
        fontWeight: 600,
        color: T.INK,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: T.MONO,
        fontSize: '10px',
        color: T.INK_GHOST,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        marginTop: 4,
      }}>
        {label}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData>({
    name: '', email: '', image: null,
    institution: '', research_area: '', orcid: '', bio: '',
  });
  const [expertise, setExpertise] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user/profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      if (data.user) {
        setProfile({
          name: data.user.name || '',
          email: data.user.email || '',
          image: data.user.image || null,
          institution: data.user.institution || '',
          research_area: data.user.research_area || '',
          orcid: data.user.orcid || '',
          bio: data.user.bio || '',
        });
        if (data.user.expertise) {
          setExpertise(data.user.expertise);
        }
      }
    } catch {
      // Profile fetch failed — leave fields empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProfile();
    }
  }, [status, fetchProfile]);

  // Calculate completeness
  const completeness = Math.round(
    ((profile.name ? 15 : 0) +
     (profile.institution ? 20 : 0) +
     (profile.research_area ? 20 : 0) +
     (profile.orcid ? 15 : 0) +
     (profile.bio ? 15 : 0) +
     (expertise.length > 0 ? 15 : 0))
  );

  // Save profile
  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    setErrorMsg('');

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution: profile.institution,
          research_area: profile.research_area,
          orcid: profile.orcid,
          bio: profile.bio,
          expertise,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: T.BG,
        display: 'grid',
        placeItems: 'center',
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: `2px solid ${T.INK_GHOST}`,
          borderTopColor: T.MINT,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!session) return null;

  // Input field styles
  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: T.R_SM,
    background: T.INSET,
    border: `1px solid ${T.CARD_BORDER}`,
    color: T.INK,
    fontFamily: T.SANS,
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: T.MONO,
    fontSize: '11px',
    fontWeight: 500,
    color: T.INK_SOFT,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: T.SP_SM,
  };

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: T.BG,
        color: T.INK,
      }}>
        <div style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: `${T.SP_XL}px ${T.SP_MD}px`,
        }}>
          {/* ─── Breadcrumb nav ─── */}
          <nav style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: T.SP_XL,
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                color: T.PAPER_LABEL,
                fontFamily: T.SANS, fontSize: '11px',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = T.INK; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.PAPER_LABEL; }}
            >
              <Home size={12} />
              Home
            </Link>
            <span style={{
              color: T.PAPER_MUTED,
              fontFamily: T.MONO, fontSize: '11px',
              userSelect: 'none',
            }}>/</span>
            <span style={{
              fontFamily: T.MONO, fontSize: '11px',
              color: T.INK,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}>
              PROFILE
            </span>
          </nav>

          {/* ─── Profile Header ─── */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: T.SP_LG,
            marginBottom: T.SP_XL,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
          }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {profile.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.image}
                  alt={profile.name}
                  width={80}
                  height={80}
                  style={{
                    borderRadius: T.R_LG,
                    border: `2px solid ${T.CARD_BORDER}`,
                  }}
                />
              ) : (
                <div style={{
                  width: 80,
                  height: 80,
                  borderRadius: T.R_LG,
                  background: 'linear-gradient(135deg, rgba(191, 220, 205, 0.12), rgba(207, 196, 227, 0.08))',
                  border: `2px solid ${T.CARD_BORDER}`,
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <User size={32} style={{ color: T.MINT, opacity: 0.6 }} />
                </div>
              )}
              {/* Provider badge */}
              <div style={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: T.BG,
                border: `2px solid ${T.CARD_BORDER}`,
                display: 'grid',
                placeItems: 'center',
              }}>
                <Sparkles size={10} style={{ color: T.LILAC }} />
              </div>
            </div>

            {/* Name + Email */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontFamily: T.SERIF,
                fontSize: '28px',
                fontWeight: 600,
                color: T.INK,
                letterSpacing: '-0.02em',
                margin: 0,
                lineHeight: 1.2,
              }}>
                {profile.name || 'Researcher'}
              </h1>
              <p style={{
                fontFamily: T.MONO,
                fontSize: '12px',
                color: T.INK_SOFT,
                margin: '6px 0 0',
              }}>
                {profile.email}
              </p>
              {profile.institution && (
                <p style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: T.SANS,
                  fontSize: '13px',
                  color: T.INK_MID,
                  margin: '8px 0 0',
                }}>
                  <Building2 size={13} style={{ color: T.SKY }} />
                  {profile.institution}
                </p>
              )}
            </div>

            {/* Completeness */}
            <CompletenessRing percent={completeness} />
          </div>

          {/* ─── Stats Row ─── */}
          <div style={{
            display: 'flex',
            gap: T.SP_SM,
            marginBottom: T.SP_XL,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s',
          }}>
            <StatCard icon={FlaskConical} value="--" label="Pathways" color={T.MINT} />
            <StatCard icon={Microscope} value="--" label="Simulations" color={T.LILAC} />
            <StatCard icon={TrendingUp} value="--" label="DBTL Iterations" color={T.SKY} />
            <StatCard icon={Clock} value="--" label="Hours Active" color={T.APRICOT} />
          </div>

          {/* ─── Research Profile Card ─── */}
          <div style={{
            background: T.CARD,
            border: `1px solid ${T.CARD_BORDER}`,
            borderRadius: T.R_LG,
            padding: T.SP_LG,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s',
          }}>
            {/* Section header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: T.SP_SM,
              paddingBottom: T.SP_MD,
              borderBottom: `1px solid ${T.CARD_BORDER}`,
              marginBottom: T.SP_LG,
            }}>
              <BookOpen size={16} style={{ color: T.LILAC }} />
              <h2 style={{
                fontFamily: T.SERIF,
                fontSize: '18px',
                fontWeight: 600,
                color: T.INK,
                margin: 0,
              }}>
                Research Identity
              </h2>
            </div>

            {/* Fields */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: T.SP_LG,
            }}>
              {/* Institution */}
              <div>
                <label style={labelStyle}>
                  <Building2 size={12} style={{ color: T.SKY }} />
                  Institution
                </label>
                <input
                  type="text"
                  value={profile.institution}
                  onChange={e => setProfile(p => ({ ...p, institution: e.target.value }))}
                  placeholder="e.g. MIT, Stanford, Max Planck Institute"
                  style={fieldStyle}
                  onFocus={e => {
                    e.target.style.borderColor = T.SKY;
                    e.target.style.boxShadow = `0 0 0 3px ${T.SKY}15`;
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = T.CARD_BORDER;
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Research Area */}
              <div>
                <label style={labelStyle}>
                  <FlaskConical size={12} style={{ color: T.LILAC }} />
                  Research Area
                </label>
                <input
                  type="text"
                  value={profile.research_area}
                  onChange={e => setProfile(p => ({ ...p, research_area: e.target.value }))}
                  placeholder="e.g. Synthetic biology, Metabolic engineering"
                  style={fieldStyle}
                  onFocus={e => {
                    e.target.style.borderColor = T.LILAC;
                    e.target.style.boxShadow = `0 0 0 3px ${T.LILAC}15`;
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = T.CARD_BORDER;
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* ORCID */}
              <div>
                <label style={labelStyle}>
                  <Hash size={12} style={{ color: T.APRICOT }} />
                  ORCID
                  <a
                    href="https://orcid.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      marginLeft: 'auto',
                      fontFamily: T.MONO,
                      fontSize: '10px',
                      color: T.INK_GHOST,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    orcid.org <ExternalLink size={9} />
                  </a>
                </label>
                <input
                  type="text"
                  value={profile.orcid}
                  onChange={e => setProfile(p => ({ ...p, orcid: e.target.value }))}
                  placeholder="0000-0000-0000-0000"
                  style={{ ...fieldStyle, fontFamily: T.MONO }}
                  onFocus={e => {
                    e.target.style.borderColor = T.APRICOT;
                    e.target.style.boxShadow = `0 0 0 3px ${T.APRICOT}15`;
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = T.CARD_BORDER;
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Bio */}
              <div>
                <label style={labelStyle}>
                  <FileText size={12} style={{ color: T.MINT }} />
                  Bio
                </label>
                <textarea
                  value={profile.bio}
                  onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Brief description of your research interests and expertise..."
                  rows={4}
                  maxLength={500}
                  style={{
                    ...fieldStyle,
                    resize: 'vertical',
                    minHeight: 100,
                    lineHeight: 1.6,
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = T.MINT;
                    e.target.style.boxShadow = `0 0 0 3px ${T.MINT}15`;
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = T.CARD_BORDER;
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: T.SP_XS,
                }}>
                  <span style={{
                    fontFamily: T.MONO,
                    fontSize: '10px',
                    color: profile.bio.length > 450 ? T.CORAL : T.INK_GHOST,
                  }}>
                    {profile.bio.length}/500
                  </span>
                </div>
              </div>

              {/* Expertise Tags */}
              <div>
                <label style={labelStyle}>
                  <Sparkles size={12} style={{ color: T.LILAC }} />
                  Expertise Tags
                </label>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: T.SP_SM,
                }}>
                  {EXPERTISE_SUGGESTIONS.map(tag => (
                    <ExpertiseTag
                      key={tag}
                      label={tag}
                      selected={expertise.includes(tag)}
                      onToggle={() => {
                        setExpertise(prev =>
                          prev.includes(tag)
                            ? prev.filter(t => t !== tag)
                            : [...prev, tag]
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ─── Save Button ─── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: T.SP_MD,
              marginTop: T.SP_XL,
              paddingTop: T.SP_LG,
              borderTop: `1px solid ${T.CARD_BORDER}`,
            }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: T.SP_SM,
                  padding: '12px 28px',
                  borderRadius: T.R_MD,
                  background: saving ? 'rgba(191, 220, 205, 0.1)' : 'rgba(191, 220, 205, 0.15)',
                  border: `1px solid rgba(191, 220, 205, 0.25)`,
                  color: T.MINT,
                  fontFamily: T.SANS,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.2s',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={e => {
                  if (!saving) {
                    e.currentTarget.style.background = 'rgba(191, 220, 205, 0.2)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = saving ? 'rgba(191, 220, 205, 0.1)' : 'rgba(191, 220, 205, 0.15)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Save size={15} />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>

              {saveStatus === 'success' && (
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: T.SANS,
                  fontSize: '13px',
                  color: T.NEON_SUCCESS,
                  animation: 'fadeInUp 0.3s ease',
                }}>
                  <CheckCircle size={14} />
                  Saved successfully
                </span>
              )}

              {saveStatus === 'error' && (
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: T.SANS,
                  fontSize: '13px',
                  color: T.NEON_DANGER,
                  animation: 'fadeInUp 0.3s ease',
                }}>
                  <AlertCircle size={14} />
                  {errorMsg}
                </span>
              )}
            </div>
          </div>

          {/* ─── Footer ─── */}
          <p style={{
            fontFamily: T.MONO,
            fontSize: '10px',
            color: T.INK_GHOST,
            textAlign: 'center',
            marginTop: T.SP_XL,
            lineHeight: 1.6,
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.5s ease 0.5s',
          }}>
            Profile data is stored securely and used to personalize your Nexus-Bio experience.
          </p>
        </div>
      </div>
    </>
  );
}
