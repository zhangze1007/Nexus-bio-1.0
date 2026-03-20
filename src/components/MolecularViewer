import { useEffect, useMemo, useRef, useState } from 'react';
import * as $3Dmol from '3dmol';

type ViewerStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface MoleculeViewerProps {
  title?: string;
  smiles?: string;
  molecule3dUrl?: string;
  molBlock?: string;
  className?: string;
}

function inferFormat(source?: string): 'sdf' | 'mol' | 'pdb' | 'mol2' | 'xyz' {
  if (!source) return 'sdf';
  const lower = source.toLowerCase();
  if (lower.endsWith('.pdb')) return 'pdb';
  if (lower.endsWith('.mol2')) return 'mol2';
  if (lower.endsWith('.mol')) return 'mol';
  if (lower.endsWith('.xyz')) return 'xyz';
  return 'sdf';
}

export default function MoleculeViewer({
  title,
  smiles,
  molecule3dUrl,
  molBlock,
  className,
}: MoleculeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<ViewerStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const sourceLabel = useMemo(() => {
    if (molecule3dUrl) return molecule3dUrl.split('/').pop() || molecule3dUrl;
    if (molBlock) return 'Inline molecular block';
    if (smiles) return 'SMILES metadata only';
    return null;
  }, [molecule3dUrl, molBlock, smiles]);

  useEffect(() => {
    let mounted = true;

    const cleanup = () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.clear();
          viewerRef.current.render();
        } catch {
          // no-op
        }
        viewerRef.current = null;
      }
    };

    const run = async () => {
      if (!containerRef.current) return;

      cleanup();
      setError(null);

      if (!molecule3dUrl && !molBlock) {
        setStatus('empty');
        return;
      }

      setStatus('loading');

      try {
        const container = containerRef.current;
        const viewer = $3Dmol.createViewer(container, {
          backgroundColor: '#0b0f14',
          defaultcolors: $3Dmol.elementColors.defaultJmolColors,
        });

        viewerRef.current = viewer;

        let modelText = molBlock || '';
        let format: 'sdf' | 'mol' | 'pdb' | 'mol2' | 'xyz' = 'sdf';

        if (!modelText && molecule3dUrl) {
          format = inferFormat(molecule3dUrl);
          const response = await fetch(molecule3dUrl);
          if (!response.ok) {
            throw new Error(`Failed to load 3D model (${response.status})`);
          }
          modelText = await response.text();
        } else if (molBlock) {
          format = 'sdf';
        }

        if (!modelText.trim()) {
          throw new Error('Empty molecular data');
        }

        const model = viewer.addModel(modelText, format);

        // 专业、克制、适合科研软件的默认样式
        model.setStyle({}, {
          stick: {
            radius: 0.18,
          },
          sphere: {
            scale: 0.25,
          },
        });

        // 轻微强化杂原子与骨架层次
        viewer.zoomTo();
        viewer.setBackgroundColor('#0b0f14');
        viewer.render();

        if (!mounted) return;
        setStatus('ready');
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Unable to render molecule');
        setStatus('error');
      }
    };

    run();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [molecule3dUrl, molBlock]);

  if (status === 'empty') {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          minHeight: 280,
          borderRadius: 14,
          border: '1px solid rgba(180,190,200,0.10)',
          background: 'linear-gradient(180deg, rgba(13,18,24,0.96), rgba(8,11,16,0.98))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 18,
        }}
      >
        <div style={{ color: 'rgba(235,241,247,0.90)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          {title || 'Molecular structure'}
        </div>
        <div style={{ color: 'rgba(220,228,236,0.55)', fontSize: 12, lineHeight: 1.7 }}>
          当前节点还没有可渲染的 3D conformer 文件。  
          你可以把对应的 <span style={{ fontFamily: 'monospace' }}>SDF / MOL / PDB</span> 文件放进 <span style={{ fontFamily: 'monospace' }}>public/molecules/</span>，然后把路径写进 <span style={{ fontFamily: 'monospace' }}>molecule3dUrl</span>。
        </div>
        {smiles && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(74,144,217,0.08)',
              border: '1px solid rgba(74,144,217,0.16)',
              color: 'rgba(230,238,246,0.75)',
              fontSize: 11,
              fontFamily: 'monospace',
              lineHeight: 1.6,
            }}
          >
            SMILES: {smiles}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: '100%',
        minHeight: 320,
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(180,190,200,0.10)',
        background: 'linear-gradient(180deg, rgba(11,15,20,0.98), rgba(7,10,14,0.98))',
        boxShadow: '0 18px 50px rgba(0,0,0,0.22)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          pointerEvents: 'none',
        }}
      >
        <div style={{ color: 'rgba(235,241,247,0.95)', fontSize: 12, fontWeight: 650 }}>
          {title || 'Molecular structure'}
        </div>
        {sourceLabel && (
          <div style={{ color: 'rgba(220,228,236,0.40)', fontSize: 10, fontFamily: 'monospace' }}>
            {sourceLabel}
          </div>
        )}
      </div>

      {status === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(220,228,236,0.58)',
            fontSize: 12,
            letterSpacing: '0.02em',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          Loading molecular conformer…
        </div>
      )}

      {status === 'error' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
            color: 'rgba(255,170,170,0.80)',
            fontSize: 12,
            lineHeight: 1.7,
            textAlign: 'center',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: 320,
          display: status === 'loading' || status === 'error' ? 'block' : 'block',
        }}
      />
    </div>
  );
}
