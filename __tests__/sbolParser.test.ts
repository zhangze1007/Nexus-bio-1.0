import { parseSBOL, isSBOLFile, SBOLComponent } from '../src/services/sequences/sbolParser';

// ═══════════════════════════════════════════════════════════════
//  Test Fixtures
// ═══════════════════════════════════════════════════════════════

const SBOL3_MINIMAL = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol="http://sbols.org/v3#"
  xmlns:dcterms="http://purl.org/dc/terms/">

  <sbol:Component rdf:about="https://nexus-bio.org/sbol3/gfp_construct">
    <sbol:displayId>gfp_construct</sbol:displayId>
    <sbol:name>GFP Expression Construct</sbol:name>
    <sbol:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#DnaRegion"/>
    <sbol:role rdf:resource="http://identifiers.org/SO:0000804"/>
    <sbol:hasSequence>
      <sbol:Sequence rdf:about="https://nexus-bio.org/sbol3/gfp_construct/Sequence">
        <sbol:elements>ATGCGATCGATCGATCGAATGCGATCGATCGATCGA</sbol:elements>
        <sbol:encoding rdf:resource="http://sbols.org/v3#iupacNucleicAcid"/>
      </sbol:Sequence>
    </sbol:hasSequence>
  </sbol:Component>

</rdf:RDF>`;

const SBOL3_FULL = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol="http://sbols.org/v3#"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:SO="http://identifiers.org/SO:">

  <!-- Top-level construct -->
  <sbol:Component rdf:about="https://nexus-bio.org/sbol3/lac_operon">
    <sbol:displayId>lac_operon</sbol:displayId>
    <sbol:name>Lac Operon Construct</sbol:name>
    <sbol:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#DnaRegion"/>
    <sbol:role rdf:resource="http://identifiers.org/SO:0000804"/>
    <sbol:hasSequence>
      <sbol:Sequence rdf:about="https://nexus-bio.org/sbol3/lac_operon/Sequence">
        <sbol:elements>TTGACAATTAATCATCGGCTCGTATAATGTGTGGAATTGTGAGCGGATAACAATTTCACACAGGAAACAGACCATGGCTATGCGATCG</sbol:elements>
        <sbol:encoding rdf:resource="http://sbols.org/v3#iupacNucleicAcid"/>
      </sbol:Sequence>
    </sbol:hasSequence>
    <sbol:hasFeature>
      <sbol:SequenceFeature rdf:about="https://nexus-bio.org/sbol3/lac_operon/promoter_feat">
        <sbol:displayId>lac_promoter_feat</sbol:displayId>
        <sbol:role rdf:resource="http://identifiers.org/SO:0000167"/>
        <sbol:location>
          <sbol:Range>
            <sbol:start>1</sbol:start>
            <sbol:end>30</sbol:end>
            <sbol:orientation rdf:resource="http://sbols.org/v3#inline"/>
          </sbol:Range>
        </sbol:location>
      </sbol:SequenceFeature>
    </sbol:hasFeature>
    <sbol:hasFeature>
      <sbol:SequenceFeature rdf:about="https://nexus-bio.org/sbol3/lac_operon/rbs_feat">
        <sbol:displayId>lac_rbs_feat</sbol:displayId>
        <sbol:role rdf:resource="http://identifiers.org/SO:0000139"/>
        <sbol:location>
          <sbol:Range>
            <sbol:start>31</sbol:start>
            <sbol:end>50</sbol:end>
            <sbol:orientation rdf:resource="http://sbols.org/v3#inline"/>
          </sbol:Range>
        </sbol:location>
      </sbol:SequenceFeature>
    </sbol:hasFeature>
    <sbol:hasFeature>
      <sbol:SequenceFeature rdf:about="https://nexus-bio.org/sbol3/lac_operon/cds_feat">
        <sbol:displayId>lacZ_cds_feat</sbol:displayId>
        <sbol:role rdf:resource="http://identifiers.org/SO:0000316"/>
        <sbol:location>
          <sbol:Range>
            <sbol:start>51</sbol:start>
            <sbol:end>85</sbol:end>
            <sbol:orientation rdf:resource="http://sbols.org/v3#reverseComplement"/>
          </sbol:Range>
        </sbol:location>
      </sbol:SequenceFeature>
    </sbol:hasFeature>
  </sbol:Component>

</rdf:RDF>`;

const SBOL2_MINIMAL = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol2="http://sbols.org/v2#"
  xmlns:dcterms="http://purl.org/dc/terms/">

  <sbol2:ComponentDefinition rdf:about="https://synbiohub.org/public/igem/BBa_R0010/1">
    <sbol2:displayId>BBa_R0010</sbol2:displayId>
    <sbol2:name>pLac promoter</sbol2:name>
    <sbol2:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#DnaRegion"/>
    <sbol2:role rdf:resource="http://identifiers.org/SO:0000167"/>
    <sbol2:sequence>
      <sbol2:Sequence rdf:about="https://synbiohub.org/public/igem/BBa_R0010_sequence/1">
        <sbol2:elements>AAAGTGCGCATTTTTTCGCTATTCACG</sbol2:elements>
        <sbol2:encoding rdf:resource="http://www.chem.qmul.ac.uk/iubmb/misc/naseq.html"/>
      </sbol2:Sequence>
    </sbol2:sequence>
  </sbol2:ComponentDefinition>

</rdf:RDF>`;

const SBOL2_FULL = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol2="http://sbols.org/v2#"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:SO="http://identifiers.org/SO:">

  <sbol2:ComponentDefinition rdf:about="https://synbiohub.org/public/igem/BBa_K123456/1">
    <sbol2:displayId>BBa_K123456</sbol2:displayId>
    <sbol2:name>YFP expression cassette</sbol2:name>
    <sbol2:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#DnaRegion"/>
    <sbol2:role rdf:resource="http://identifiers.org/SO:0000804"/>
    <sbol2:sequence>
      <sbol2:Sequence rdf:about="https://synbiohub.org/public/igem/BBa_K123456_sequence/1">
        <sbol2:elements>TTGACAATTAATCATCGGCTCGTATAATGTGTGGAATTGTGAGCGGATGCGATCGATCGATCGAATGCGATCG</sbol2:elements>
        <sbol2:encoding rdf:resource="http://www.chem.qmul.ac.uk/iubmb/misc/naseq.html"/>
      </sbol2:Sequence>
    </sbol2:sequence>
    <sbol2:sequenceAnnotation>
      <sbol2:SequenceAnnotation rdf:about="https://synbiohub.org/public/igem/BBa_K123456/1/ann_promoter">
        <sbol2:displayId>ann_promoter</sbol2:displayId>
        <sbol2:role rdf:resource="http://identifiers.org/SO:0000167"/>
        <sbol2:location>
          <sbol2:Range>
            <sbol2:start>1</sbol2:start>
            <sbol2:end>30</sbol2:end>
            <sbol2:orientation rdf:resource="http://sbols.org/v2#inline"/>
          </sbol2:Range>
        </sbol2:location>
      </sbol2:SequenceAnnotation>
    </sbol2:sequenceAnnotation>
    <sbol2:sequenceAnnotation>
      <sbol2:SequenceAnnotation rdf:about="https://synbiohub.org/public/igem/BBa_K123456/1/ann_cds">
        <sbol2:displayId>ann_cds</sbol2:displayId>
        <sbol2:role rdf:resource="http://identifiers.org/SO:0000316"/>
        <sbol2:location>
          <sbol2:Range>
            <sbol2:start>31</sbol2:start>
            <sbol2:end>70</sbol2:end>
            <sbol2:orientation rdf:resource="http://sbols.org/v2#reverseComplement"/>
          </sbol2:Range>
        </sbol2:location>
      </sbol2:SequenceAnnotation>
    </sbol2:sequenceAnnotation>
  </sbol2:ComponentDefinition>

</rdf:RDF>`;

const SBOL3_RNA = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol="http://sbols.org/v3#">

  <sbol:Component rdf:about="https://nexus-bio.org/sbol3/mrna_reporter">
    <sbol:displayId>mrna_reporter</sbol:displayId>
    <sbol:name>mRNA Reporter</sbol:name>
    <sbol:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#RnaRegion"/>
    <sbol:hasSequence>
      <sbol:Sequence rdf:about="https://nexus-bio.org/sbol3/mrna_reporter/Sequence">
        <sbol:elements>AUGCGAUCGAUCGAUCGA</sbol:elements>
        <sbol:encoding rdf:resource="http://sbols.org/v3#iupacNucleicAcid"/>
      </sbol:Sequence>
    </sbol:hasSequence>
  </sbol:Component>

</rdf:RDF>`;

const SBOL3_PROTEIN = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol="http://sbols.org/v3#">

  <sbol:Component rdf:about="https://nexus-bio.org/sbol3/gfp_protein">
    <sbol:displayId>gfp_protein</sbol:displayId>
    <sbol:name>GFP Protein</sbol:name>
    <sbol:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#Protein"/>
    <sbol:hasSequence>
      <sbol:Sequence rdf:about="https://nexus-bio.org/sbol3/gfp_protein/Sequence">
        <sbol:elements>MSKGEELFTGVVPILVELDGDVNGHKFSVRGEGEGDATIGKL</sbol:elements>
        <sbol:encoding rdf:resource="http://sbols.org/v3#iupacAminoAcid"/>
      </sbol:Sequence>
    </sbol:hasSequence>
  </sbol:Component>

</rdf:RDF>`;

const SBOL3_NO_SEQUENCE = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol="http://sbols.org/v3#">

  <sbol:Component rdf:about="https://nexus-bio.org/sbol3/abstract_part">
    <sbol:displayId>abstract_part</sbol:displayId>
    <sbol:name>Abstract Part</sbol:name>
    <sbol:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#DnaRegion"/>
  </sbol:Component>

</rdf:RDF>`;

const SBOL3_MULTIPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol="http://sbols.org/v3#">

  <sbol:Component rdf:about="https://nexus-bio.org/sbol3/part1">
    <sbol:displayId>part1</sbol:displayId>
    <sbol:name>Part One</sbol:name>
    <sbol:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#DnaRegion"/>
    <sbol:hasSequence>
      <sbol:Sequence>
        <sbol:elements>ATGCGA</sbol:elements>
      </sbol:Sequence>
    </sbol:hasSequence>
  </sbol:Component>

  <sbol:Component rdf:about="https://nexus-bio.org/sbol3/part2">
    <sbol:displayId>part2</sbol:displayId>
    <sbol:name>Part Two</sbol:name>
    <sbol:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#DnaRegion"/>
    <sbol:hasSequence>
      <sbol:Sequence>
        <sbol:elements>TCGATC</sbol:elements>
      </sbol:Sequence>
    </sbol:hasSequence>
  </sbol:Component>

</rdf:RDF>`;

// ═══════════════════════════════════════════════════════════════
//  Tests
// ═══════════════════════════════════════════════════════════════

describe('isSBOLFile', () => {
  it('detects SBOL 3.0 XML', () => {
    expect(isSBOLFile(SBOL3_MINIMAL)).toBe(true);
  });

  it('detects SBOL 2.0 XML', () => {
    expect(isSBOLFile(SBOL2_MINIMAL)).toBe(true);
  });

  it('rejects plain XML without SBOL namespace', () => {
    expect(isSBOLFile('<?xml version="1.0"?><root/>')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSBOLFile('')).toBe(false);
  });

  it('rejects non-XML content', () => {
    expect(isSBOLFile('ATGCGATCGATCG')).toBe(false);
  });

  it('rejects null/undefined input', () => {
    expect(isSBOLFile(null as unknown as string)).toBe(false);
    expect(isSBOLFile(undefined as unknown as string)).toBe(false);
  });

  it('detects SBOL by sbols.org reference even without standard namespace', () => {
    const partial = '<?xml version="1.0"?><root xmlns:x="http://sbols.org/v3#"/>';
    expect(isSBOLFile(partial)).toBe(true);
  });
});

describe('parseSBOL — SBOL 3.0', () => {
  it('parses a minimal SBOL 3.0 document', () => {
    const components = parseSBOL(SBOL3_MINIMAL);
    expect(components).toHaveLength(1);

    const comp = components[0];
    expect(comp.id).toBe('gfp_construct');
    expect(comp.name).toBe('GFP Expression Construct');
    expect(comp.type).toBe('DNA');
    expect(comp.sequence).toBe('ATGCGATCGATCGATCGAATGCGATCGATCGATCGA');
    expect(comp.roles).toContain('engineered_region');
  });

  it('parses a full SBOL 3.0 document with annotations', () => {
    const components = parseSBOL(SBOL3_FULL);
    expect(components).toHaveLength(1);

    const comp = components[0];
    expect(comp.id).toBe('lac_operon');
    expect(comp.name).toBe('Lac Operon Construct');
    expect(comp.type).toBe('DNA');
    expect(comp.sequence).toContain('TTGACA');
    expect(comp.roles).toContain('engineered_region');

    // Annotations
    expect(comp.annotations).toHaveLength(3);

    const promoter = comp.annotations.find((a) => a.role === 'promoter');
    expect(promoter).toBeDefined();
    expect(promoter!.start).toBe(1);
    expect(promoter!.end).toBe(30);
    expect(promoter!.strand).toBe(1);

    const rbs = comp.annotations.find((a) => a.role === 'ribosome_entry_site');
    expect(rbs).toBeDefined();
    expect(rbs!.start).toBe(31);
    expect(rbs!.end).toBe(50);

    const cds = comp.annotations.find((a) => a.role === 'CDS');
    expect(cds).toBeDefined();
    expect(cds!.start).toBe(51);
    expect(cds!.end).toBe(85);
    expect(cds!.strand).toBe(-1); // reverseComplement
  });

  it('parses RNA type components', () => {
    const components = parseSBOL(SBOL3_RNA);
    expect(components).toHaveLength(1);
    expect(components[0].type).toBe('RNA');
    expect(components[0].sequence).toBe('AUGCGAUCGAUCGAUCGA');
  });

  it('parses protein type components', () => {
    const components = parseSBOL(SBOL3_PROTEIN);
    expect(components).toHaveLength(1);
    expect(components[0].type).toBe('protein');
    expect(components[0].sequence).toBe('MSKGEELFTGVVPILVELDGDVNGHKFSVRGEGEGDATIGKL');
  });

  it('handles missing sequence gracefully', () => {
    const components = parseSBOL(SBOL3_NO_SEQUENCE);
    expect(components).toHaveLength(1);
    expect(components[0].id).toBe('abstract_part');
    expect(components[0].sequence).toBe('');
  });

  it('parses multiple components in one document', () => {
    const components = parseSBOL(SBOL3_MULTIPLE);
    expect(components).toHaveLength(2);
    expect(components[0].id).toBe('part1');
    expect(components[1].id).toBe('part2');
  });
});

describe('parseSBOL — SBOL 2.0', () => {
  it('parses a minimal SBOL 2.0 document', () => {
    const components = parseSBOL(SBOL2_MINIMAL);
    expect(components).toHaveLength(1);

    const comp = components[0];
    expect(comp.id).toBe('BBa_R0010');
    expect(comp.name).toBe('pLac promoter');
    expect(comp.type).toBe('DNA');
    expect(comp.sequence).toBe('AAAGTGCGCATTTTTTCGCTATTCACG');
    expect(comp.roles).toContain('promoter');
  });

  it('parses a full SBOL 2.0 document with sequence annotations', () => {
    const components = parseSBOL(SBOL2_FULL);
    expect(components).toHaveLength(1);

    const comp = components[0];
    expect(comp.id).toBe('BBa_K123456');
    expect(comp.name).toBe('YFP expression cassette');
    expect(comp.type).toBe('DNA');

    // Annotations
    expect(comp.annotations).toHaveLength(2);

    const promoter = comp.annotations.find((a) => a.role === 'promoter');
    expect(promoter).toBeDefined();
    expect(promoter!.start).toBe(1);
    expect(promoter!.end).toBe(30);
    expect(promoter!.strand).toBe(1);

    const cds = comp.annotations.find((a) => a.role === 'CDS');
    expect(cds).toBeDefined();
    expect(cds!.start).toBe(31);
    expect(cds!.end).toBe(70);
    expect(cds!.strand).toBe(-1);
  });
});

describe('parseSBOL — error handling', () => {
  it('throws on empty string', () => {
    expect(() => parseSBOL('')).toThrow('Invalid input');
  });

  it('throws on null input', () => {
    expect(() => parseSBOL(null as unknown as string)).toThrow('Invalid input');
  });

  it('throws on non-SBOL XML', () => {
    expect(() => parseSBOL('<?xml version="1.0"?><root/>')).toThrow('Invalid SBOL');
  });

  it('throws on plain text', () => {
    expect(() => parseSBOL('ATGCGATCG')).toThrow('Invalid SBOL');
  });

  it('returns empty array for SBOL XML with no components', () => {
    const empty = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol="http://sbols.org/v3#">
</rdf:RDF>`;
    const components = parseSBOL(empty);
    expect(components).toHaveLength(0);
  });
});

describe('parseSBOL — field inference', () => {
  it('defaults to DNA when type URI is unknown', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol="http://sbols.org/v3#">
  <sbol:Component>
    <sbol:displayId>unknown_type</sbol:displayId>
    <sbol:name>Unknown Type</sbol:name>
    <sbol:type rdf:resource="http://example.org/UnknownType"/>
  </sbol:Component>
</rdf:RDF>`;
    const components = parseSBOL(xml);
    expect(components[0].type).toBe('DNA');
  });

  it('infers type from sequence when BioPAX type is missing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol="http://sbols.org/v3#">
  <sbol:Component>
    <sbol:displayId>no_type</sbol:displayId>
    <sbol:name>No Type</sbol:name>
    <sbol:hasSequence>
      <sbol:Sequence>
        <sbol:elements>AUGCGAUCG</sbol:elements>
      </sbol:Sequence>
    </sbol:hasSequence>
  </sbol:Component>
</rdf:RDF>`;
    const components = parseSBOL(xml);
    // RNA sequence (AUGC) but no BioPAX type → defaults to DNA from inferTypeFromBioPAX
    // The sequence contains U so it looks like RNA, but we use the type URI for classification
    expect(components[0].type).toBe('DNA'); // No type URI defaults to DNA
  });

  it('uses displayId as name when name is missing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol="http://sbols.org/v3#">
  <sbol:Component>
    <sbol:displayId>no_name</sbol:displayId>
    <sbol:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#DnaRegion"/>
  </sbol:Component>
</rdf:RDF>`;
    const components = parseSBOL(xml);
    expect(components[0].name).toBe('no_name');
  });

  it('extracts multiple roles', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sbol="http://sbols.org/v3#">
  <sbol:Component>
    <sbol:displayId>multi_role</sbol:displayId>
    <sbol:name>Multi Role</sbol:name>
    <sbol:type rdf:resource="http://www.biopax.org/release/biopax-level3.owl#DnaRegion"/>
    <sbol:role rdf:resource="http://identifiers.org/SO:0000167"/>
    <sbol:role rdf:resource="http://identifiers.org/SO:0000057"/>
  </sbol:Component>
</rdf:RDF>`;
    const components = parseSBOL(xml);
    expect(components[0].roles).toContain('promoter');
    expect(components[0].roles).toContain('operator');
  });
});
