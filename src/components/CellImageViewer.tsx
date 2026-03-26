'use client';

import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, Microscope, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface CellImage {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  fullUrl: string;
  source: string;
  organism?: string;
  imagingMethod?: string;
}

interface CellImageViewerProps {
  searchTerm: string;
  height?: number;
}

// ── Source 1: Wikipedia Commons ────────────────────────────────────────
// Most stable, broadest coverage, free API
async function searchWikipediaCommons(query: string): Promise<CellImage[]> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' cell microscopy biology')}&format=json&origin=*&srlimit=3`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error('Wikipedia search failed');
    const data = await res.json();
    const pages = data?.query?.search || [];

    const images: CellImage[] = [];

    for (const page of pages.slice(0, 2)) {
      // Get page images
      const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(page.title)}&prop=pageimages&format=json&origin=*&pithumbsize=400&piprop=thumbnail`;
      const imgRes = await fetch(imgUrl);
      if (!imgRes.ok) continue;
      const imgData = await imgRes.json();
      const pageData = Object.values(imgData?.query?.pages || {})[0] as any;

      if (pageData?.thumbnail?.source) {
        images.push({
          id: `wiki-${page.pageid}`,
          title: page.title,
          description: page.snippet?.replace(/<[^>]*>/g, '').slice(0, 150) || page.title,
          thumbnailUrl: pageData.thumbnail.source,
          fullUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
          source: 'Wikipedia',
          imagingMethod: detectImagingMethod(page.snippet || ''),
        });
      }
    }

    return images;
  } catch {
    return [];
  }
}

// ── Source 2: Cell Image Library ───────────────────────────────────────
async function searchCIL(query: string): Promise<CellImage[]> {
  try {
    const res = await fetch(
      `https://cellimagelibrary.org/images/search.json?simple_search=${encodeURIComponent(query)}&per_page=6&page=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error('CIL failed');
    const data = await res.json();
    if (!data?.images?.length) return [];

    return data.images.slice(0, 4).map((img: any) => {
      const id = img.CIL_CCDB?.CIL?.Image?.Image_ID || String(Math.random());
      return {
        id: `cil-${id}`,
        title: img.CIL_CCDB?.CIL?.Biological_Context?.Organism?.[0] || query,
        description: (img.CIL_CCDB?.CIL?.Image?.Description || '').slice(0, 150),
        thumbnailUrl: `https://cellimagelibrary.org/images/${id}/thumbnail`,
        fullUrl: `https://cellimagelibrary.org/images/${id}`,
        source: 'Cell Image Library',
        organism: img.CIL_CCDB?.CIL?.Biological_Context?.Organism?.[0],
        imagingMethod: img.CIL_CCDB?.CIL?.Image?.Image_Type?.[0],
      };
    });
  } catch {
    return [];
  }
}

// ── Source 3: EMBL-EBI Image Data Resource ─────────────────────────────
async function searchIDR(query: string): Promise<CellImage[]> {
  try {
    const res = await fetch(
      `https://idr.openmicroscopy.org/api/v0/m/images/?name=${encodeURIComponent(query)}&limit=4`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error('IDR failed');
    const data = await res.json();
    if (!data?.data?.length) return [];

    return data.data.slice(0, 3).map((img: any) => ({
      id: `idr-${img['@id']}`,
      title: img.Name || query,
      description: `IDR image dataset — ${img.Name || query}`,
      thumbnailUrl: `https://idr.openmicroscopy.org/webclient/render_thumbnail/${img['@id']}/`,
      fullUrl: `https://idr.openmicroscopy.org/webclient/?show=image-${img['@id']}`,
      source: 'EMBL-EBI IDR',
      imagingMethod: img.AcquisitionDate ? 'Fluorescence' : 'Microscopy',
    }));
  } catch {
    return [];
  }
}

// ── Detect imaging method from text ───────────────────────────────────
function detectImagingMethod(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('electron') || t.includes(' em ') || t.includes('tem') || t.includes('sem')) return 'Electron Microscopy';
  if (t.includes('fluorescen') || t.includes('confocal') || t.includes('gfp')) return 'Fluorescence';
  if (t.includes('cryo')) return 'Cryo-EM';
  if (t.includes('x-ray') || t.includes('crystallog')) return 'X-ray Crystallography';
  if (t.includes('light') || t.includes('brightfield') || t.includes('optical')) return 'Light Microscopy';
  if (t.includes('dic') || t.includes('phase contrast')) return 'DIC';
  if (t.includes('atomic force') || t.includes('afm')) return 'AFM';
  return 'Microscopy';
}

// ── Main search: parallel across all 3 sources ─────────────────────────
async function searchAllSources(query: string): Promise<CellImage[]> {
  // Run all 3 in parallel, take whatever succeeds
  const [wiki, cil, idr] = await Promise.allSettled([
    searchWikipediaCommons(query),
    searchCIL(query),
    searchIDR(query),
  ]);

  const results: CellImage[] = [
    ...(wiki.status === 'fulfilled' ? wiki.value : []),
    ...(cil.status === 'fulfilled' ? cil.value : []),
    ...(idr.status === 'fulfilled' ? idr.value : []),
  ];

  // Deduplicate by title similarity
  const seen = new Set<string>();
  return results.filter(img => {
    const key = img.title.toLowerCase().slice(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

// ── Source badges ──────────────────────────────────────────────────────
const SOURCE_COLORS: Record<string, string> = {
  'Wikipedia':          'rgba(200,216,232,0.6)',
  'Cell Image Library': 'rgba(200,224,208,0.6)',
  'EMBL-EBI IDR':       'rgba(221,208,232,0.6)',
};

export default function CellImageViewer({ searchTerm, height = 280 }: CellImageViewerProps) {
  const [images, setImages] = useState<CellImage[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!searchTerm) { setStatus('empty'); return; }
    let cancelled = false;
    setStatus('loading');
    setImages([]);
    setCurrentIdx(0);
    setImgError({});

    searchAllSources(searchTerm).then(results => {
      if (cancelled) return;
      setImages(results);
      setStatus(results.length > 0 ? 'ready' : 'empty');
    });

    return () => { cancelled = true; };
  }, [searchTerm]);

  const current = images[currentIdx];
  const total = images.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Microscope size={12} style={{ color: 'rgba(200,224,208,0.6)' }} />
          <span style={{ color: 'rgba(200,224,208,0.6)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Microscopy Reference
          </span>
        </div>
        {status === 'ready' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Source badges */}
            {['Wikipedia','Cell Image Library','EMBL-EBI IDR'].map(src => {
              const hasSource = images.some(i => i.source === src);
              if (!hasSource) return null;
              return (
                <span key={src} style={{ fontSize: '8px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", padding: '1px 5px', borderRadius: '8px', border: `1px solid ${SOURCE_COLORS[src]}`, color: SOURCE_COLORS[src] }}>
                  {src === 'Cell Image Library' ? 'CIL' : src === 'EMBL-EBI IDR' ? 'IDR' : src}
                </span>
              );
            })}
            {total > 1 && (
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>
                {currentIdx + 1}/{total}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main image */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px`, borderRadius: '20px', overflow: 'hidden', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)' }}>

        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <Loader2 size={16} style={{ color: 'rgba(200,224,208,0.5)', animation: 'spin 1s linear infinite' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 4px' }}>
                Searching 3 databases in parallel...
              </p>
              <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>
                Wikipedia · Cell Image Library · EMBL-EBI IDR
              </p>
            </div>
          </div>
        )}

        {status === 'empty' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '20px' }}>
            <AlertCircle size={18} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', margin: 0 }}>
              No microscopy images found for "{searchTerm}"
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Cell Image Library', url: `https://cellimagelibrary.org/images/search?simple_search=${encodeURIComponent(searchTerm)}` },
                { label: 'EMBL-EBI IDR', url: `https://idr.openmicroscopy.org/search/?query=name:${encodeURIComponent(searchTerm)}` },
              ].map(db => (
                <a key={db.label} href={db.url} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'rgba(200,224,208,0.5)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                  {db.label} <ExternalLink size={9} />
                </a>
              ))}
            </div>
          </div>
        )}

        {status === 'ready' && current && (
          <>
            {imgError[current.id] ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Microscope size={22} style={{ color: 'rgba(255,255,255,0.1)' }} />
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>Preview unavailable</span>
                <a href={current.fullUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'rgba(200,224,208,0.5)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                  View on {current.source} <ExternalLink size={9} />
                </a>
              </div>
            ) : (
              <img src={current.thumbnailUrl} alt={current.title}
                onError={() => setImgError(prev => ({ ...prev, [current.id]: true }))}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }}
              />
            )}

            {/* Bottom overlay */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px', background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 100%)' }}>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', fontWeight: 500, margin: '0 0 3px' }}>
                {current.title}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {current.imagingMethod && (
                  <span style={{ color: SOURCE_COLORS[current.source] || 'rgba(255,255,255,0.4)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", padding: '1px 5px', border: `1px solid ${SOURCE_COLORS[current.source] || 'rgba(255,255,255,0.2)'}`, borderRadius: '8px' }}>
                    {current.imagingMethod}
                  </span>
                )}
                {current.organism && (
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", fontStyle: 'italic' }}>
                    {current.organism}
                  </span>
                )}
              </div>
            </div>

            {/* Navigation */}
            {total > 1 && (
              <>
                <button onClick={() => setCurrentIdx(i => (i - 1 + total) % total)}
                  style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setCurrentIdx(i => (i + 1) % total)}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
                  <ChevronRight size={14} />
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Description + source link */}
      {status === 'ready' && current && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', lineHeight: 1.6, margin: 0, flex: 1 }}>
            {current.description}
          </p>
          <a href={current.fullUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: SOURCE_COLORS[current.source] || 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none', flexShrink: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
            {current.source} <ExternalLink size={8} />
          </a>
        </div>
      )}

      {/* Thumbnail strip */}
      {status === 'ready' && total > 1 && (
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
          {images.map((img, i) => (
            <button key={img.id} onClick={() => setCurrentIdx(i)}
              style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '14px', overflow: 'hidden', border: `2px solid ${i === currentIdx ? (SOURCE_COLORS[img.source] || 'rgba(255,255,255,0.4)') : 'rgba(255,255,255,0.06)'}`, background: '#0a0a0a', cursor: 'pointer', padding: 0, position: 'relative' }}>
              {imgError[img.id]
                ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Microscope size={12} style={{ color: 'rgba(255,255,255,0.2)' }} /></div>
                : <img src={img.thumbnailUrl} alt={img.title} onError={() => setImgError(prev => ({ ...prev, [img.id]: true }))} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              }
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
