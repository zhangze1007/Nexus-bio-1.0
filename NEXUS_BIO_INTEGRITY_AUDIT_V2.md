# NEXUS_BIO_INTEGRITY_AUDIT_V2 — suspected fabrication (auto-triage)

Generated 50 suspects. Status starts at "suspected"; Phase 2 confirms each with a code-level test.

| Severity | Class | File:Line | Reason | Status |
|---|---|---|---|---|
| 5 | fabrication | app/api/esm3/route.ts:131 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | app/api/alphafold/route.ts:323 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/infra/featureFlags.ts:80 | random-derived value flows into a reported score/return | suspected |
| 3 | decoy | app/api/auth/mfa/enable/route.ts:20 | param 'req' ignored in POST() | suspected |
| 3 | decoy | app/api/files/[...key]/route.ts:18 | param 'request' ignored in GET() | suspected |
| 3 | decoy | src/data/mockGenMIM.ts:246 | param 'pamMotif' ignored in designsgRNAs() | suspected |
| 3 | decoy | src/data/mockProEvol.ts:32 | param 'mutationRate' ignored in generateEvolutionTrajectory() | suspected |
| 3 | decoy | src/server/bgcDetection.ts:325 | param 'geneScores' ignored in clusterGenesIntoRegions() | suspected |
| 3 | decoy | src/server/cellFreeMetabolicEngine.ts:86 | param 'initialConc' ignored in modelEnergySystem() | suspected |
| 3 | decoy | src/server/cellFreeMetabolicEngine.ts:86 | param 'dt' ignored in modelEnergySystem() | suspected |
| 3 | decoy | src/server/crisprCas12aEngine.ts:419 | param 'pam' ignored in calculateGenericEfficiency() | suspected |
| 3 | decoy | src/server/crisprCas12aEngine.ts:419 | param 'variant' ignored in calculateGenericEfficiency() | suspected |
| 3 | decoy | src/server/ddgPrediction.ts:163 | param 'structure' ignored in computeVdW() | suspected |
| 3 | decoy | src/server/ddgPrediction.ts:212 | param 'structure' ignored in computeSolvation() | suspected |
| 3 | decoy | src/server/ddgPrediction.ts:601 | param 'chainId' ignored in scanAllMutations() | suspected |
| 3 | decoy | src/server/dnaAssemblyEngine.ts:401 | param 'frag2Start' ignored in generateOverhang() | suspected |
| 3 | decoy | src/server/fbaDynamic.ts:208 | param 'reactions' ignored in computeDerivative() | suspected |
| 3 | decoy | src/server/geneExpressionPredictor.ts:891 | param 'bottlenecks' ignored in generateSuggestions() | suspected |
| 3 | decoy | src/server/genmimPipeline.ts:63 | param 'spec' ignored in planKnockdowns() | suspected |
| 3 | decoy | src/server/grnaDesigner.ts:329 | param 'geneName' ignored in designgRNAs() | suspected |
| 3 | decoy | src/server/grnaDesigner.ts:388 | param 'pamDef' ignored in evaluateCandidate() | suspected |
| 3 | decoy | src/server/inverseFoldingEngine.ts:618 | param 'temperature' ignored in sampleSequence() | suspected |
| 3 | decoy | src/server/inverseFoldingEngine.ts:763 | param 'pssm' ignored in computeDesignScore() | suspected |
| 3 | decoy | src/server/looplessFBA.ts:201 | param 'externalMetabolites' ignored in detectLoops() | suspected |
| 3 | decoy | src/server/looplessFBA.ts:338 | param 'externalMetabolites' ignored in hasLoops() | suspected |
| 3 | decoy | src/server/mfa13CEngine.ts:464 | param 'fluxes' ignored in simulateNetworkMIDs() | suspected |
| 3 | decoy | src/server/modelPredictiveControl.ts:176 | param 'c' ignored in buildPredictionMatrices() | suspected |
| 3 | decoy | src/server/modelPredictiveControl.ts:176 | param 'Nc' ignored in buildPredictionMatrices() | suspected |
| 3 | decoy | src/server/plasmidDesignEngine.ts:507 | param 'host' ignored in optimizeCDS() | suspected |
| 3 | decoy | src/server/rbac.ts:122 | param 'projectId' ignored in canPerformAction() | suspected |
| 3 | decoy | src/server/rbsCalculator.ts:221 | param 'cdsSeq' ignored in computeSpacing() | suspected |
| 3 | decoy | src/server/regulatoryDesignEngine.ts:602 | param 'cds' ignored in computeStandbySite() | suspected |
| 3 | decoy | src/server/regulatoryDesignEngine.ts:942 | param 'organism' ignored in optimizeCodons() | suspected |
| 3 | decoy | src/server/retrosynthesis.ts:159 | param 'targetNorm' ignored in computeScore() | suspected |
| 3 | decoy | src/server/retrosynthesis.ts:159 | param 'precursors' ignored in computeScore() | suspected |
| 3 | decoy | src/server/rfdiffusion.ts:212 | param 'temperature' ignored in generateHeuristicSequence() | suspected |
| 3 | decoy | src/server/umapEngine.ts:236 | param 'knnGraph' ignored in optimizeEmbedding() | suspected |
| 3 | decoy | src/services/axonAdapterRegistry.ts:57 | param 'label' ignored in buildPipelineApiAdapter() | suspected |
| 3 | decoy | src/services/confidenceEngine.ts:115 | param 'toolConfidence' ignored in computeWorkflowConfidence() | suspected |
| 3 | decoy | src/services/instruments/protocolGenerator.ts:49 | param 'labwareMap' ignored in emitOpentronsStep() | suspected |
| 3 | decoy | src/services/inventory/inventoryExport.ts:77 | param 'type' ignored in exportToCSV() | suspected |
| 3 | decoy | src/services/omics/multiOmicsPipeline.ts:634 | param 'sampleNames' ignored in runDifferentialExpression() | suspected |
| 3 | decoy | src/services/ScSpatialEngine.ts:795 | param 'adjList' ignored in computeModularity() | suspected |
| 3 | decoy | src/services/ScSpatialEngine.ts:872 | param 'edgeWeights' ignored in louvainPhase2() | suspected |
| 2 | reproducibility | src/modules/ml/features.ts:216 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/ml/interpretability.ts:188 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/rna-engine/rnaEngine.ts:338 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/bioreactorAnalyticsEngine.ts:197 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/rfdiffusion.ts:408 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/protein/inverseFolding.ts:248 | unseeded randomness on a compute path | suspected |
