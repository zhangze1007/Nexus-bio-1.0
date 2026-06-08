'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { User, Save, CheckCircle, AlertCircle, Building2, FlaskConical, Hash, FileText } from 'lucide-react';
import { THEME } from '../../src/theme';
interface ProfileData {
  name: string;
  email: string;
  image: string | null;
  institution: string;
  research_area: string;
  orcid: string;
  bio: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    email: '',
    image: null,
    institution: '',
    research_area: '',
    orcid: '',
    bio: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

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
        background: THEME.BG_SHELL,
        display: 'grid',
        placeItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: THEME.SP_SM,
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '2px solid rgba(255,255,255,0.1)',
            borderTopColor: THEME.MINT,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            color: THEME.LABEL,
          }}>
            Loading profile...
          </span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!session) return null;

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: THEME.R_SM,
    background: THEME.PANEL_INSET,
    border: `1px solid ${THEME.PANEL_BORDER}`,
    color: THEME.VALUE,
    fontFamily: THEME.SANS,
    fontSize: THEME.FS_MD,
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: THEME.SANS,
    fontSize: THEME.FS_SM,
    fontWeight: 600,
    color: THEME.LABEL,
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  };

  const fieldGroup: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: THEME.SP_SM,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: THEME.BG_SHELL,
      color: THEME.VALUE,
    }}>
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: `${THEME.SP_XL}px ${THEME.SP_MD}px`,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: THEME.SP_MD,
          marginBottom: THEME.SP_XL,
        }}>
          {profile.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.image}
              alt={profile.name}
              width={64}
              height={64}
              style={{
                borderRadius: THEME.R_MD,
                border: `2px solid ${THEME.PANEL_BORDER}`,
              }}
            />
          ) : (
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: THEME.R_MD,
              background: 'rgba(191,220,205,0.12)',
              border: `2px solid ${THEME.PANEL_BORDER}`,
              display: 'grid',
              placeItems: 'center',
            }}>
              <User size={28} style={{ color: THEME.MINT }} />
            </div>
          )}
          <div>
            <h1 style={{
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_XL,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.92)',
              margin: 0,
            }}>
              {profile.name || 'User'}
            </h1>
            <p style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_SM,
              color: THEME.LABEL,
              margin: '4px 0 0',
            }}>
              {profile.email}
            </p>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: THEME.PANEL_SURFACE,
          border: `1px solid ${THEME.PANEL_BORDER}`,
          borderRadius: THEME.R_LG,
          padding: THEME.SP_LG,
          display: 'flex',
          flexDirection: 'column',
          gap: THEME.SP_LG,
        }}>
          <h2 style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_LG,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.88)',
            margin: 0,
            paddingBottom: THEME.SP_SM,
            borderBottom: `1px solid ${THEME.PANEL_BORDER}`,
          }}>
            Research Profile
          </h2>

          {/* Institution */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              <Building2 size={13} style={{ color: THEME.SKY }} />
              Institution
            </label>
            <input
              type="text"
              value={profile.institution}
              onChange={e => setProfile(p => ({ ...p, institution: e.target.value }))}
              placeholder="e.g. MIT, Stanford, Max Planck Institute"
              style={fieldStyle}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = THEME.SKY; }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = THEME.PANEL_BORDER; }}
            />
          </div>

          {/* Research Area */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              <FlaskConical size={13} style={{ color: THEME.LILAC }} />
              Research Area
            </label>
            <input
              type="text"
              value={profile.research_area}
              onChange={e => setProfile(p => ({ ...p, research_area: e.target.value }))}
              placeholder="e.g. Synthetic biology, Metabolic engineering"
              style={fieldStyle}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = THEME.LILAC; }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = THEME.PANEL_BORDER; }}
            />
          </div>

          {/* ORCID */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              <Hash size={13} style={{ color: THEME.APRICOT }} />
              ORCID
            </label>
            <input
              type="text"
              value={profile.orcid}
              onChange={e => setProfile(p => ({ ...p, orcid: e.target.value }))}
              placeholder="0000-0000-0000-0000"
              style={{ ...fieldStyle, fontFamily: THEME.MONO }}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = THEME.APRICOT; }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = THEME.PANEL_BORDER; }}
            />
          </div>

          {/* Bio */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              <FileText size={13} style={{ color: THEME.MINT }} />
              Bio
            </label>
            <textarea
              value={profile.bio}
              onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
              placeholder="Brief description of your research interests..."
              rows={4}
              maxLength={500}
              style={{
                ...fieldStyle,
                resize: 'vertical' as const,
                minHeight: '80px',
              }}
              onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = THEME.MINT; }}
              onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = THEME.PANEL_BORDER; }}
            />
            <span style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: 'rgba(255,255,255,0.3)',
              textAlign: 'right',
            }}>
              {profile.bio.length}/500
            </span>
          </div>

          {/* Save button + status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: THEME.SP_SM,
            paddingTop: THEME.SP_SM,
            borderTop: `1px solid ${THEME.PANEL_BORDER}`,
          }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                borderRadius: THEME.R_SM,
                background: saving ? 'rgba(191,220,205,0.15)' : 'rgba(191,220,205,0.2)',
                border: `1px solid ${THEME.MINT}40`,
                color: THEME.MINT,
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_MD,
                fontWeight: 600,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'background 0.15s, opacity 0.15s',
              }}
              onMouseEnter={e => {
                if (!saving) (e.currentTarget as HTMLElement).style.background = 'rgba(191,220,205,0.3)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = saving
                  ? 'rgba(191,220,205,0.15)'
                  : 'rgba(191,220,205,0.2)';
              }}
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>

            {saveStatus === 'success' && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_SM,
                color: THEME.NEON_SUCCESS,
              }}>
                <CheckCircle size={14} />
                Saved
              </span>
            )}

            {saveStatus === 'error' && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_SM,
                color: THEME.NEON_DANGER,
              }}>
                <AlertCircle size={14} />
                {errorMsg}
              </span>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <p style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_XS,
          color: 'rgba(255,255,255,0.2)',
          textAlign: 'center',
          marginTop: THEME.SP_LG,
        }}>
          Profile data is stored securely and used to personalize your Nexus-Bio experience.
        </p>
      </div>
    </div>
  );
}
