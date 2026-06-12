'use client';
import React, { useState, useEffect } from 'react';

interface DatabaseStatus {
  name: string;
  status: 'live' | 'mock' | 'checking';
}

export default function DatabaseStatusDashboard() {
  const [databases, setDatabases] = useState<DatabaseStatus[]>([
    { name: 'KEGG', status: 'checking' },
    { name: 'BiGG', status: 'checking' },
    { name: 'BRENDA', status: 'checking' },
    { name: 'UniProt', status: 'checking' },
    { name: 'PubChem', status: 'checking' },
    { name: 'AlphaFold', status: 'checking' },
  ]);

  useEffect(() => {
    const checkDatabase = async (
      name: string,
      url: string,
    ): Promise<'live' | 'mock'> => {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(5000),
        });
        return res.ok ? 'live' : 'mock';
      } catch {
        return 'mock';
      }
    };

    Promise.all([
      checkDatabase('KEGG', '/api/kegg?pathway=map00010'),
      checkDatabase('BiGG', '/api/bigg?type=models'),
      checkDatabase('BRENDA', '/api/brenda?type=kinetics&id=2.7.1.1'),
      checkDatabase('UniProt', '/api/uniprot?type=entry&id=P00044'),
      checkDatabase('PubChem', '/api/pubchem?cid=2244'),
      checkDatabase('AlphaFold', '/api/alphafold?id=P00044'),
    ]).then((results) => {
      setDatabases((prev) =>
        prev.map((db, i) => ({ ...db, status: results[i] })),
      );
    });
  }, []);

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {databases.map((db) => (
        <span
          key={db.name}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: 'var(--nb-fs-xxs)',
            fontFamily: 'var(--nb-mono)',
            background:
              db.status === 'live'
                ? 'rgba(74,222,128,0.12)'
                : db.status === 'mock'
                  ? 'rgba(251,191,36,0.12)'
                  : 'rgba(255,255,255,0.06)',
            color:
              db.status === 'live'
                ? 'rgba(74,222,128,0.9)'
                : db.status === 'mock'
                  ? 'rgba(251,191,36,0.9)'
                  : 'rgba(255,255,255,0.4)',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background:
                db.status === 'live'
                  ? '#4ade80'
                  : db.status === 'mock'
                    ? '#fbbf24'
                    : '#666',
            }}
          />
          {db.name}
        </span>
      ))}
    </div>
  );
}
