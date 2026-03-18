import { useState } from 'react';
import { Search, Dna, ExternalLink, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const PLDDT_LEVELS = [
  { color: '#0053D6', label: 'Very high', range: '>90', desc: 'Expected to be modelled well' },
  { color: '#65CBF3', label: 'Confident', range: '70–90', desc: 'Generally accurate backbone' },
  { color: '#FFDB13', label: 'Medium', range: '50–70', desc: 'Flexible or disordered region' },
  { color: '#FF7D45', label: 'Low', range: '<50', desc: 'Unreliable — intrinsically disordered' },
];

const EXAMPLE_STRUCTURES = [
  { id: '2ONH', name: 'Amorphadiene Synthase', organism: 'Artemisia annua', relevance: 'Artemisinin biosynthesis — key enzyme in malaria drug production' },
  { id: '1DQA', name: 'HMG-CoA Reductase', organism: 'Homo sapiens', relevance: 'Mevalonate pathway — cholesterol and isoprenoid biosynthesis' },
  { id: '1YNT', name: 'Pyruvate Kinase', organism: 'E. coli', relevance: 'Glycolysis — central metabolic enzyme' },
  { id: '3HHO', name: 'Alcohol Dehydrogenase', organism: 'S. cerevisiae', relevance: 'Ethanol fermentation pathway' },
];

interface PDBViewerProps {
  pdbId: string;
  name?: string;
}

function StructureViewer({ pdbId, name }: PDBViewerProps) {
  const [loading, setLoading] = useState(true);

  return (
    <div style={{ position: 'relative', width: '100%', height: '320px', borderRadius: '12px', overflow: 'hidden', background: '#050505', border: '1px solid rgba(255,255,255,0.08)' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', zIndex: 1 }}>
          <div style={{ width: '22px', height: '22px', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: 'rgba(100,149,237,0.7)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: 'monospace' }}>
            Fetching {pdbId} from RCSB PDB...
          </span>
        </div>
      )}
      <iframe
        src={`https://www.rcsb.org/3d-view/${pdbId}`}
        style={{ width: '100%', height: '100%', border: 'none', opacity: loading ? 0 : 1, transition: 'opacity 0.4s' }}
        onLoad={() => setLoading(false)}
        title={`${name || pdbId} 3D Structure`}
        sandbox="allow-scripts allow-same-origin"
      />
      {/* Overlay labels */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', pointerEvents: 'none' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(0,0,0,0.75)', borderRadius: '8px', backdropFilter: 'blur(8px)' }}>
          <Dna size={11} style={{ color: '#6495ED' }} />
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>{pdbId}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: '10px', right: '10px' }}>
        <a
          href={`https://www.rcsb.org/structure/${pdbId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'rgba(0,0,0,0.75)', borderRadius: '6px', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'monospace', textDecoration: 'none', backdropFilter: 'blur(8px)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
        >
          Open in RCSB <ExternalLink size={9} />
        </a>
      </div>
    </div>
  );
}

export default function PDBExplorer() {
  const [query, setQuery] = useState('');
  const [activePDB, setActivePDB] = useState<{ id: string; name?: string } | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [inputPDB, setInputPDB] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = inputPDB.trim().toUpperCase();
    if (id.length === 4) {
      setActivePDB({ id, name: id });
    }
  };

  return (
    <section className="px-4 py-24" id="structure"
      style={{ background: '#0a0a0a' }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: 'rgba(255,255,255,0.2)' }}>05 · Structure</p>
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-2"
            style={{ letterSpacing: '-0.02em' }}>Protein Structure Explorer</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Visualize any enzyme from the{' '}
            <span style={{ color: '#6495ED', fontFamily: 'monospace' }}>RCSB PDB</span>
            {' '}database · pLDDT confidence color coding
          </p>
        </div>

        {/* PDB ID search */}
        <form onSubmit={handleSearch} className="flex gap-3 mb-8">
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <Dna size={15} style={{ color: 'rgba(255,255,255,0.2)' }} />
            </div>
            <input
              type="text"
              value={inputPDB}
              onChange={e => setInputPDB(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="Enter 4-character PDB ID (e.g. 2ONH)"
              maxLength={4}
              style={{ width: '100%', padding: '12px 16px 12px 38px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#ffffff', fontSize: '14px', fontFamily: 'monospace', outline: 'none', letterSpacing: '0.05em' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            />
          </div>
          <button
            type="submit"
            disabled={inputPDB.length !== 4}
            style={{ padding: '12px 20px', background: inputPDB.length === 4 ? '#ffffff' : 'rgba(255,255,255,0.06)', color: inputPDB.length === 4 ? '#0a0a0a' : 'rgba(255,255,255,0.25)', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: inputPDB.length === 4 ? 'pointer' : 'not-allowed', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}
            onMouseEnter={e => { if (inputPDB.length === 4) (e.currentTarget as HTMLElement).style.background = '#e5e5e5'; }}
            onMouseLeave={e => { if (inputPDB.length === 4) (e.currentTarget as HTMLElement).style.background = '#ffffff'; }}>
            <Search size={14} />
            View
          </button>
        </form>

        {/* Active viewer */}
        {activePDB && (
          <div style={{ marginBottom: '24px' }}>
            <StructureViewer pdbId={activePDB.id} name={activePDB.name} />

            {/* pLDDT legend toggle */}
            <div style={{ marginTop: '12px' }}>
              <button
                onClick={() => setShowLegend(!showLegend)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontFamily: 'monospace' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}>
                {showLegend ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                pLDDT Confidence Legend (AlphaFold color scheme)
              </button>
              {showLegend && (
                <div style={{ marginTop: '8px', padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {PLDDT_LEVELS.map(l => (
                    <div key={l.color} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '8px', borderRadius: '4px', background: l.color, flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontFamily: 'monospace', minWidth: '90px' }}>{l.label} ({l.range})</span>
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>{l.desc}</span>
                    </div>
                  ))}
                  <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontFamily: 'monospace', marginTop: '4px' }}>
                    Color scheme based on AlphaFold2 pLDDT confidence scoring (Jumper et al., Nature 2021)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Example structures */}
        <div>
          <p className="text-xs font-mono uppercase tracking-widest mb-4"
            style={{ color: 'rgba(255,255,255,0.2)' }}>
            Metabolic Enzymes · Quick Access
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EXAMPLE_STRUCTURES.map(s => (
              <button
                key={s.id}
                onClick={() => setActivePDB({ id: s.id, name: s.name })}
                style={{
                  padding: '14px 16px', borderRadius: '12px', textAlign: 'left',
                  background: activePDB?.id === s.id ? 'rgba(100,149,237,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${activePDB?.id === s.id ? 'rgba(100,149,237,0.25)' : 'rgba(255,255,255,0.07)'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (activePDB?.id !== s.id) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { if (activePDB?.id !== s.id) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#6495ED', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700 }}>{s.id}</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace' }}>{s.organism}</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', fontWeight: 500, margin: '0 0 4px' }}>{s.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', margin: 0, lineHeight: 1.5 }}>{s.relevance}</p>
              </button>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
