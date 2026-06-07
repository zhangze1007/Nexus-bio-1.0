'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { User, Save, CheckCircle, AlertCircle, Building2, FlaskConical, Hash, FileText } from 'lucide-react';
import { T } from '../../src/components/ide/tokens';

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
        background: T.BG_SHELL,
        display: 'grid',
        placeItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: T.SP_SM,
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '2px solid rgba(255,255,255,0.1)',
            borderTopColor: T.MINT,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{
            fontFamily: T.SANS,
            fontSize: T.FS_SM,
            color: T.LABEL,
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
    borderRadius: T.R_SM,
    background: T.PANEL_INSET,
    border: `1px solid ${T.PANEL_BORDER}`,
    color: T.VALUE,
    fontFamily: T.SANS,
    fontSize: T.FS_MD,
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: T.SANS,
    fontSize: T.FS_SM,
    fontWeight: 600,
    color: T.LABEL,
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  };

  const fieldGroup: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: T.SP_SM,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: T.BG_SHELL,
      color: T.VALUE,
    }}>
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: `${T.SP_XL}px ${T.SP_MD}px`,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: T.SP_MD,
          marginBottom: T.SP_XL,
        }}>
          {profile.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.image}
              alt={profile.name}
              width={64}
              height={64}
              style={{
                borderRadius: T.R_MD,
                border: `2px solid ${T.PANEL_BORDER}`,
              }}
            />
          ) : (
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: T.R_MD,
              background: 'rgba(191,220,205,0.12)',
              border: `2px solid ${T.PANEL_BORDER}`,
              display: 'grid',
              placeItems: 'center',
            }}>
              <User size={28} style={{ color: T.MINT }} />
            </div>
          )}
          <div>
            <h1 style={{
              fontFamily: T.SANS,
              fontSize: T.FS_XL,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.92)',
              margin: 0,
            }}>
              {profile.name || 'User'}
            </h1>
            <p style={{
              fontFamily: T.MONO,
              fontSize: T.FS_SM,
              color: T.LABEL,
              margin: '4px 0 0',
            }}>
              {profile.email}
            </p>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: T.PANEL_SURFACE,
          border: `1px solid ${T.PANEL_BORDER}`,
          borderRadius: T.R_LG,
          padding: T.SP_LG,
          display: 'flex',
          flexDirection: 'column',
          gap: T.SP_LG,
        }}>
          <h2 style={{
            fontFamily: T.SANS,
            fontSize: T.FS_LG,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.88)',
            margin: 0,
            paddingBottom: T.SP_SM,
            borderBottom: `1px solid ${T.PANEL_BORDER}`,
          }}>
            Research Profile
          </h2>

          {/* Institution */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              <Building2 size={13} style={{ color: T.SKY }} />
              Institution
            </label>
            <input
              type="text"
              value={profile.institution}
              onChange={e => setProfile(p => ({ ...p, institution: e.target.value }))}
              placeholder="e.g. MIT, Stanford, Max Planck Institute"
              style={fieldStyle}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = T.SKY; }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = T.PANEL_BORDER; }}
            />
          </div>

          {/* Research Area */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              <FlaskConical size={13} style={{ color: T.LILAC }} />
              Research Area
            </label>
            <input
              type="text"
              value={profile.research_area}
              onChange={e => setProfile(p => ({ ...p, research_area: e.target.value }))}
              placeholder="e.g. Synthetic biology, Metabolic engineering"
              style={fieldStyle}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = T.LILAC; }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = T.PANEL_BORDER; }}
            />
          </div>

          {/* ORCID */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              <Hash size={13} style={{ color: T.APRICOT }} />
              ORCID
            </label>
            <input
              type="text"
              value={profile.orcid}
              onChange={e => setProfile(p => ({ ...p, orcid: e.target.value }))}
              placeholder="0000-0000-0000-0000"
              style={{ ...fieldStyle, fontFamily: T.MONO }}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = T.APRICOT; }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = T.PANEL_BORDER; }}
            />
          </div>

          {/* Bio */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              <FileText size={13} style={{ color: T.MINT }} />
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
              onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = T.MINT; }}
              onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = T.PANEL_BORDER; }}
            />
            <span style={{
              fontFamily: T.MONO,
              fontSize: T.FS_XS,
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
            gap: T.SP_SM,
            paddingTop: T.SP_SM,
            borderTop: `1px solid ${T.PANEL_BORDER}`,
          }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                borderRadius: T.R_SM,
                background: saving ? 'rgba(191,220,205,0.15)' : 'rgba(191,220,205,0.2)',
                border: `1px solid ${T.MINT}40`,
                color: T.MINT,
                fontFamily: T.SANS,
                fontSize: T.FS_MD,
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
                fontFamily: T.SANS,
                fontSize: T.FS_SM,
                color: T.NEON_SUCCESS,
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
                fontFamily: T.SANS,
                fontSize: T.FS_SM,
                color: T.NEON_DANGER,
              }}>
                <AlertCircle size={14} />
                {errorMsg}
              </span>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <p style={{
          fontFamily: T.MONO,
          fontSize: T.FS_XS,
          color: 'rgba(255,255,255,0.2)',
          textAlign: 'center',
          marginTop: T.SP_LG,
        }}>
          Profile data is stored securely and used to personalize your Nexus-Bio experience.
        </p>
      </div>
    </div>
  );
}
