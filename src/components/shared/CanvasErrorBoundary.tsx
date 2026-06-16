'use client';

import React from 'react';
import { THEME } from '../../theme';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class CanvasErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          padding: '20px',
          borderRadius: 'var(--nb-radius-md)',
          border: `1px solid ${THEME.RISK_HIGH}33`,
          background: 'rgba(232,163,161,0.06)',
          textAlign: 'center',
          display: 'grid',
          gap: '8px',
          alignContent: 'center',
          minHeight: '200px',
        }}>
          <div style={{
            fontFamily: THEME.SANS,
            fontSize: 'var(--nb-fs-sm)',
            color: THEME.RISK_HIGH,
          }}>
            3D visualization failed to load
          </div>
          <div style={{
            fontFamily: THEME.MONO,
            fontSize: 'var(--nb-fs-xs)',
            color: THEME.PAPER_MUTED,
          }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              padding: '6px 16px',
              borderRadius: '999px',
              background: 'rgba(191,220,205,0.12)',
              color: THEME.MINT,
              fontFamily: THEME.MONO,
              fontSize: 'var(--nb-fs-xs)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              border: `1px solid ${THEME.MINT}44`,
              justifySelf: 'center',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
