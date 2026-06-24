/**
 * useCatDesState -- Custom hook encapsulating all feature state and handlers
 * for the Catalyst Designer. Includes BRENDA, AlphaFold, ESMFold, PDB upload,
 * docking, inverse folding, expression, plasmid, RNA, regulatory, and biosensor.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import type { EnzymeStructure } from '../../../services/CatalystDesignerEngine';
import type { BRENDAKinetics } from '../../../services/database/brendaClient';
import { getBRENDAKinetics } from '../../../services/database/brendaClient';
import { runDocking } from '../../../services/database/dockingClient';
import type { DockingResult } from './catdesShared';
import type { RNADesignType, RNADesignResult } from '../../../modules/rna-engine';

export function useCatDesState(enzyme: EnzymeStructure, selectedEnzyme: number) {
  /* -- BRENDA state -------------------------------------------------- */
  const [brendaEcInput, setBrendaEcInput] = useState('');
  const [brendaData, setBrendaData] = useState<BRENDAKinetics | null>(null);
  const [brendaSource, setBrendaSource] = useState<'live' | 'mock'>('mock');
  const [brendaLoading, setBrendaLoading] = useState(false);
  const [brendaAppliedKm, setBrendaAppliedKm] = useState<number | null>(null);
  const [brendaAppliedKcat, setBrendaAppliedKcat] = useState<number | null>(null);

  /* -- AlphaFold state ---------------------------------------------- */
  const [alphafoldStatus, setAlphafoldStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const [alphafoldSource, setAlphafoldSource] = useState<'live' | 'mock'>('mock');
  const [alphafoldPdbLength, setAlphafoldPdbLength] = useState(0);

  /* -- Uploaded PDB state ------------------------------------------- */
  const [uploadedPdb, setUploadedPdb] = useState<string | null>(null);
  const [uploadedPdbName, setUploadedPdbName] = useState<string | null>(null);
  const [catdesError, setCatdesError] = useState<string | null>(null);

  /* -- ESMFold state ------------------------------------------------ */
  const [esmfoldPdb, setEsmfoldPdb] = useState<string | null>(null);
  const [esmfoldLoading, setEsmfoldLoading] = useState(false);
  const [esmfoldError, setEsmfoldError] = useState<string | null>(null);

  /* -- Docking state ------------------------------------------------ */
  const [dockingResult, setDockingResult] = useState<DockingResult | null>(null);
  const [dockingLoading, setDockingLoading] = useState(false);

  /* -- Inverse Folding state ---------------------------------------- */
  const [invFoldSeqCount, setInvFoldSeqCount] = useState(8);
  const [invFoldTemp, setInvFoldTemp] = useState(0.5);
  const [invFoldResult, setInvFoldResult] = useState<import('../../../server/inverseFoldingEngine').InverseFoldingResult | null>(null);
  const [invFoldLoading, setInvFoldLoading] = useState(false);

  /* -- Expression Prediction state ---------------------------------- */
  const [exprResult, setExprResult] = useState<import('../../../server/geneExpressionPredictor').ExpressionPrediction | null>(null);
  const [exprLoading, setExprLoading] = useState(false);
  const [exprPromoter, setExprPromoter] = useState('TTGACATATACATTAAGAATTCGATATCAATGACA');
  const [exprRbs, setExprRbs] = useState('AAGAAGGAGATATACAT');
  const [exprTerminator, setExprTerminator] = useState('GCAAAAAACCCCTCAAGACCCGTTTAGAG');

  /* -- Plasmid Design state ----------------------------------------- */
  const [plasmidResult, setPlasmidResult] = useState<import('../../../server/plasmidDesignEngine').PlasmidDesignResult | null>(null);
  const [plasmidLoading, setPlasmidLoading] = useState(false);
  const [plasmidHost, setPlasmidHost] = useState<'ecoli' | 'yeast'>('ecoli');
  const [expressionLevel, setExpressionLevel] = useState<'high_expression' | 'low_expression' | 'tunable' | 'knockdown' | 'reporter'>('high_expression');
  const [assemblyMethod, setAssemblyMethod] = useState<'gibson' | 'golden_gate' | 'restriction_ligation' | 'infusion'>('gibson');
  const [copyNumber, setCopyNumber] = useState(2);

  /* -- RNA Engineering state ---------------------------------------- */
  const [rnaDesignType, setRnaDesignType] = useState<RNADesignType>('sirna');
  const [rnaTargetSeq, setRnaTargetSeq] = useState('AUGAAACGCACCAGCAACAGCAACUUUGCGUACG');
  const [rnaMaxLength, setRnaMaxLength] = useState(100);
  const [rnaResult, setRnaResult] = useState<RNADesignResult | null>(null);
  const [rnaLoading, setRnaLoading] = useState(false);

  /* -- Regulatory Design state -------------------------------------- */
  const [regTargetStrength, setRegTargetStrength] = useState(0.7);
  const [regHost, setRegHost] = useState<'ecoli' | 'yeast' | 'human'>('ecoli');
  const [regCodonOptimize, setRegCodonOptimize] = useState(true);
  const [regResult, setRegResult] = useState<import('../../../server/regulatoryDesignEngine').RegulatoryDesignResult | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  /* -- Biosensor Design state --------------------------------------- */
  const [bioTargetLigand, setBioTargetLigand] = useState('arabinose');
  const [bioDynamicRange, setBioDynamicRange] = useState(100);
  const [bioSensitivity, setBioSensitivity] = useState(50);
  const [bioHost, setBioHost] = useState('ecoli');
  const [bioResult, setBioResult] = useState<import('../../../server/biosensorDesignEngine').BiosensorDesign | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  /* ================================================================
     Active enzyme with BRENDA overrides
     ================================================================ */

  const activeEnzyme: EnzymeStructure = useMemo(() => {
    if (brendaAppliedKm == null && brendaAppliedKcat == null) return enzyme;
    return {
      ...enzyme,
      km: brendaAppliedKm ?? enzyme.km,
      kcat: brendaAppliedKcat ?? enzyme.kcat,
    };
  }, [enzyme, brendaAppliedKm, brendaAppliedKcat]);

  const hasBrendaApplied = brendaAppliedKm != null || brendaAppliedKcat != null;

  /* ================================================================
     Effects
     ================================================================ */

  // Clear applied BRENDA values when enzyme selection changes
  useEffect(() => {
    setBrendaAppliedKm(null);
    setBrendaAppliedKcat(null);
  }, [selectedEnzyme]);

  // Reset ESMFold state when enzyme changes
  useEffect(() => {
    setEsmfoldPdb(null);
    setEsmfoldError(null);
    setEsmfoldLoading(false);
  }, [selectedEnzyme]);

  // Reset BRENDA EC input when enzyme changes
  useEffect(() => {
    setBrendaEcInput(enzyme.ecNumber);
    setBrendaData(null);
    setBrendaAppliedKm(null);
    setBrendaAppliedKcat(null);
  }, [enzyme.ecNumber]);

  // AlphaFold lookup when enzyme changes
  const handleAlphaFoldLookup = useCallback(async () => {
    if (!enzyme.uniprotId) return;
    setAlphafoldStatus('loading');
    try {
      const res = await fetch(`/api/alphafold?id=${enzyme.uniprotId}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const pdb = await res.text();
        if (pdb && pdb.length > 100) {
          setAlphafoldStatus('found');
          setAlphafoldSource('live');
          setAlphafoldPdbLength(pdb.length);
        } else {
          setAlphafoldStatus('not_found');
          setAlphafoldSource('mock');
        }
      } else {
        setAlphafoldStatus('not_found');
        setAlphafoldSource('mock');
      }
    } catch {
      setAlphafoldStatus('error');
      setAlphafoldSource('mock');
    }
  }, [enzyme.uniprotId]);

  // Auto-fetch AlphaFold when enzyme changes
  useEffect(() => {
    setAlphafoldStatus('idle');
    setAlphafoldPdbLength(0);
    handleAlphaFoldLookup();
  }, [handleAlphaFoldLookup]);

  /* ================================================================
     Handlers
     ================================================================ */

  const handleBrendaLookup = useCallback(async () => {
    if (!brendaEcInput.trim()) return;
    setBrendaLoading(true);
    try {
      const result = await getBRENDAKinetics(brendaEcInput.trim());
      setBrendaData(result.data);
      setBrendaSource(result.source);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'BRENDA lookup failed';
      setCatdesError(msg);
    } finally {
      setBrendaLoading(false);
    }
  }, [brendaEcInput]);

  const handleApplyBrenda = useCallback(() => {
    if (!brendaData) return;
    if (brendaData.km.length > 0) setBrendaAppliedKm(brendaData.km[0].value);
    if (brendaData.kcat.length > 0) setBrendaAppliedKcat(brendaData.kcat[0].value);
  }, [brendaData]);

  const handleRevertBrenda = useCallback(() => {
    setBrendaAppliedKm(null);
    setBrendaAppliedKcat(null);
  }, []);

  const handleDocking = useCallback(async () => {
    if (!enzyme.pdbId || !enzyme.substrate) return;
    setDockingLoading(true);
    try {
      const result = await runDocking(enzyme.pdbId, enzyme.substrate, {
        uniprotId: enzyme.uniprotId,
        substrateSmiles: enzyme.substrate,
      });
      setDockingResult(result.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Docking failed';
      setCatdesError(msg);
    } finally {
      setDockingLoading(false);
    }
  }, [enzyme.pdbId, enzyme.substrate, enzyme.uniprotId]);

  const handleESMFoldPredict = useCallback(async () => {
    if (!activeEnzyme?.sequence) return;
    setEsmfoldLoading(true);
    setEsmfoldError(null);
    try {
      const { predictStructure } = await import('../../../services/esmfoldClient');
      const result = await predictStructure(activeEnzyme.sequence);
      setEsmfoldPdb(result.pdb);
    } catch (err) {
      setEsmfoldError(err instanceof Error ? err.message : 'ESMFold prediction failed');
    } finally {
      setEsmfoldLoading(false);
    }
  }, [activeEnzyme?.sequence]);

  const handleInverseFolding = useCallback(async () => {
    setInvFoldLoading(true);
    try {
      const backbone = Array.from({ length: Math.max(30, enzyme.catalyticResidues.length * 10) }, (_, i) => ({
        residueIndex: i,
        residueName: 'ALA',
        x: 10 * Math.cos(i * 0.6),
        y: 10 * Math.sin(i * 0.6) + (i % 5) * 2,
        z: i * 3.8,
      }));
      const res = await fetch('/api/pipeline/inversefolding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backbone, nSequences: invFoldSeqCount, temperature: invFoldTemp }),
      });
      if (!res.ok) throw new Error(`Pipeline failed (${res.status})`);
      const data = await res.json();
      setInvFoldResult(data.result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Inverse folding failed';
      setCatdesError(msg);
    } finally {
      setInvFoldLoading(false);
    }
  }, [enzyme.catalyticResidues.length, invFoldSeqCount, invFoldTemp]);

  const handleExpressionPrediction = useCallback(async () => {
    setExprLoading(true);
    try {
      const { predictGeneExpression } = await import('../../../server/geneExpressionPredictor');
      const cds = enzyme.sequence || 'ATGAAACGCACCAGCAACAGCAACTAA';
      const result = predictGeneExpression(exprPromoter, exprRbs, cds, exprTerminator, 'ecoli');
      setExprResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Expression prediction failed';
      setCatdesError(msg);
    } finally {
      setExprLoading(false);
    }
  }, [enzyme.sequence, exprPromoter, exprRbs, exprTerminator]);

  const handlePlasmidDesign = useCallback(async () => {
    setPlasmidLoading(true);
    try {
      const { designPlasmid } = await import('../../../server/plasmidDesignEngine');
      const cds = enzyme.sequence || 'ATGAAACGCACCAGCAACAGCAACTAA';
      const result = designPlasmid(cds, plasmidHost, expressionLevel, assemblyMethod, copyNumber);
      setPlasmidResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Plasmid design failed';
      setCatdesError(msg);
    } finally {
      setPlasmidLoading(false);
    }
  }, [enzyme.sequence, plasmidHost, expressionLevel, assemblyMethod, copyNumber]);

  const handleRNADesign = useCallback(async () => {
    setRnaLoading(true);
    try {
      const { designRNA } = await import('../../../modules/rna-engine');
      const result = designRNA({
        type: rnaDesignType,
        targetSequence: rnaTargetSeq,
        host: 'ecoli',
        maxLength: rnaMaxLength,
      });
      setRnaResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'RNA design failed';
      setCatdesError(msg);
    } finally {
      setRnaLoading(false);
    }
  }, [rnaDesignType, rnaTargetSeq, rnaMaxLength]);

  const handleRegulatoryDesign = useCallback(async () => {
    setRegLoading(true);
    try {
      const { designRegulatoryCassette } = await import('../../../server/regulatoryDesignEngine');
      const cds = enzyme.sequence || 'ATGAAACGCACCAGCAACAGCAACTAA';
      const result = designRegulatoryCassette(regTargetStrength, cds);
      setRegResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Regulatory design failed';
      setCatdesError(msg);
    } finally {
      setRegLoading(false);
    }
  }, [enzyme.sequence, regTargetStrength]);

  const handleBiosensorDesign = useCallback(async () => {
    setBioLoading(true);
    try {
      const { designBiosensor } = await import('../../../server/biosensorDesignEngine');
      const result = designBiosensor({
        targetLigand: bioTargetLigand,
        desiredDynamicRange: bioDynamicRange,
        desiredSensitivity: bioSensitivity,
        hostOrganism: bioHost,
      });
      setBioResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Biosensor design failed';
      setCatdesError(msg);
    } finally {
      setBioLoading(false);
    }
  }, [bioTargetLigand, bioDynamicRange, bioSensitivity, bioHost]);

  /* ================================================================
     Return all state and handlers
     ================================================================ */

  return {
    // Active enzyme
    activeEnzyme,

    // BRENDA
    brendaEcInput, setBrendaEcInput,
    brendaData, brendaSource, brendaLoading,
    brendaAppliedKm, brendaAppliedKcat,
    handleBrendaLookup, handleApplyBrenda, handleRevertBrenda,
    hasBrendaApplied,

    // AlphaFold
    alphafoldStatus, alphafoldSource, alphafoldPdbLength,

    // Upload
    uploadedPdb, setUploadedPdb, uploadedPdbName, setUploadedPdbName,

    // ESMFold
    esmfoldPdb, esmfoldLoading, esmfoldError,
    handleESMFoldPredict,

    // Docking
    dockingResult, dockingLoading,
    handleDocking,

    // Error
    catdesError, setCatdesError,

    // Inverse Folding
    invFoldSeqCount, setInvFoldSeqCount,
    invFoldTemp, setInvFoldTemp,
    invFoldResult, invFoldLoading,
    handleInverseFolding,

    // Expression
    exprResult, exprLoading,
    exprPromoter, setExprPromoter,
    exprRbs, setExprRbs,
    exprTerminator, setExprTerminator,
    handleExpressionPrediction,

    // Plasmid
    plasmidResult, plasmidLoading,
    plasmidHost, setPlasmidHost,
    expressionLevel, setExpressionLevel,
    assemblyMethod, setAssemblyMethod,
    copyNumber, setCopyNumber,
    handlePlasmidDesign,

    // RNA
    rnaDesignType, setRnaDesignType,
    rnaTargetSeq, setRnaTargetSeq,
    rnaMaxLength, setRnaMaxLength,
    rnaResult, rnaLoading,
    handleRNADesign,

    // Regulatory
    regTargetStrength, setRegTargetStrength,
    regHost, setRegHost,
    regCodonOptimize, setRegCodonOptimize,
    regResult, regLoading,
    handleRegulatoryDesign,

    // Biosensor
    bioTargetLigand, setBioTargetLigand,
    bioDynamicRange, setBioDynamicRange,
    bioSensitivity, setBioSensitivity,
    bioHost, setBioHost,
    bioResult, bioLoading,
    handleBiosensorDesign,
  };
}
