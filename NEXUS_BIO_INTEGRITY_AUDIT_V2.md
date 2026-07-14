# NEXUS_BIO_INTEGRITY_AUDIT_V2 — suspected fabrication (auto-triage)

Generated 201 suspects. Status starts at "suspected"; Phase 2 confirms each with a code-level test.

| Severity | Class | File:Line | Reason | Status |
|---|---|---|---|---|
| 5 | fabrication | app/api/esm3/route.ts:131 | random-derived value flows into a reported score/return | suspected |
| 5 | fabrication | src/data/mockNEXAI.ts:8 | random-derived value flows into a reported score/return | suspected |
| 5 | fabrication | src/data/mockNEXAI.ts:66 | random-derived value flows into a reported score/return | suspected |
| 5 | fabrication | src/data/mockNEXAI.ts:104 | random-derived value flows into a reported score/return | suspected |
| 5 | fabrication | src/server/retrosynthesis.ts:218 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | app/api/alphafold/route.ts:323 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | app/api/alphafold/route.ts:336 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | app/api/pipeline/[tool]/route.ts:155 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/modules/streaming/server.ts:288 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/server/backup/backupManager.ts:78 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/server/db/connectionPool.ts:107 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/server/db/connectionPool.ts:218 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/server/db/connectionPool.ts:236 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/server/workbenchDb.ts:77 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/auth/accountLockout.ts:67 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/business/analyticsService.ts:72 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/business/feedbackService.ts:69 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/business/usageTracker.ts:103 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/cognitiveRouter.ts:193 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/collaboration/presenceService.ts:115 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/collaboration/projectSharing.ts:137 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/community/templateService.ts:80 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/infra/featureFlags.ts:80 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/instruments/experimentTracker.ts:99 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/instruments/sampleTracker.ts:87 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/provenanceMiddleware.ts:67 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/tieredExecutor.ts:265 | random-derived value flows into a reported score/return | suspected |
| 4 | fabrication | src/services/tieredExecutor.ts:352 | random-derived value flows into a reported score/return | suspected |
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
| 2 | reproducibility | app/api/alphafold/route.ts:188 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/alphafold/route.ts:241 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/alphafold/route.ts:268 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/alphafold/route.ts:297 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/alphafold3/route.ts:69 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/alphafold3/route.ts:80 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/alphafold3/route.ts:101 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/analytics/route.ts:57 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/auth/sessions/route.ts:36 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/esm2/route.ts:61 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/esm2/route.ts:85 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/esm2/route.ts:100 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/esm2/route.ts:120 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/esm3/route.ts:185 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/esm3/route.ts:218 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/esm3/route.ts:298 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/esmfold/route.ts:62 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/esmfold/route.ts:80 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/route.ts:137 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/route.ts:193 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/route.ts:232 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/route.ts:271 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/route.ts:293 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/route.ts:334 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/route.ts:363 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/route.ts:392 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/route.ts:412 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/stream/route.ts:97 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/stream/route.ts:104 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/stream/route.ts:121 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/stream/route.ts:125 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/stream/route.ts:146 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/stream/route.ts:161 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/fba/stream/route.ts:174 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/pipeline/[tool]/route.ts:152 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/scspatial/ingest/route.ts:123 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | app/api/workbench/route.ts:335 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/ml/features.ts:216 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/ml/interpretability.ts:188 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/rna-engine/rnaEngine.ts:338 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/sbol/types.ts:85 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/sbol/types.ts:89 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/sbol/types.ts:93 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/sbol/types.ts:100 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/sbol/types.ts:104 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/sbol/types.ts:111 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/sbol/types.ts:115 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/sbol/types.ts:122 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/sbol/types.ts:126 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/streaming/anomaly.ts:177 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/streaming/anomaly.ts:224 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/streaming/anomaly.ts:243 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/streaming/anomaly.ts:316 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/streaming/anomaly.ts:340 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/streaming/index.ts:182 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/streaming/server.ts:198 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/streaming/server.ts:241 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/streaming/server.ts:296 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/modules/streaming/server.ts:423 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/bioreactorAnalyticsEngine.ts:197 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/biosafetyScreeningEngine.ts:172 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/biosafetyScreeningEngine.ts:229 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/dataRetention.ts:44 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/db/connectionPool.ts:121 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/db/connectionPool.ts:153 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/db/connectionPool.ts:160 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/db/connectionPool.ts:170 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/db/queryBuilder.ts:378 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/dnaAssemblyEngine.ts:105 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/dnaAssemblyEngine.ts:151 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/dnaAssemblyEngine.ts:179 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/dnaAssemblyEngine.ts:236 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/dnaAssemblyEngine.ts:265 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/dnaAssemblyEngine.ts:329 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/fbaFVA.ts:51 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/fbaFVA.ts:94 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/fbaPFBA.ts:46 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/fbaPFBA.ts:55 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/fbaPFBA.ts:158 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/labAutomationBridge.ts:102 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/rbac.ts:160 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/retrosynthesis.ts:210 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/retrosynthesis.ts:234 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/retrosynthesis.ts:385 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/rfdiffusion.ts:408 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/schemaMigrations.ts:75 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/scspatialDemo.ts:34 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/server/seeds/seedService.ts:266 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/api/apiMetrics.ts:105 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/auth/webauthnService.ts:116 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/auth/webauthnService.ts:137 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/axon/axonDAGExecutor.ts:54 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/axon/axonDAGExecutor.ts:116 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/AxonOrchestrator.ts:106 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/axonQueuePersistence.ts:55 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/axonQueuePersistence.ts:91 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/axonWriteback.ts:63 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/citationVerifier.ts:58 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/citationVerifier.ts:63 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/cognitiveRouter.ts:206 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/collaboration/activityFeed.ts:142 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/collaboration/commentService.ts:116 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/collaboration/commentService.ts:159 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/collaboration/notificationService.ts:79 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/collaboration/presenceService.ts:90 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/collaboration/projectSharing.ts:99 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/collaboration/projectSharing.ts:175 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/compliance/complianceService.ts:227 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/copilot/toolCaller.ts:68 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/copilot/toolCaller.ts:78 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/copilot/toolCaller.ts:98 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/copilot/toolCaller.ts:109 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/copilot/toolCaller.ts:118 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/fba/fbaGeometric.ts:147 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/fba/fbaGeometric.ts:157 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/fba/fbaGeometric.ts:199 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/fba/fbaGeometric.ts:215 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/fba/fbaGeometric.ts:239 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/integrations/n8nNodes.ts:105 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/ml/promptVersioning.ts:49 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/OmicsIntegrator.ts:328 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/protein/inverseFolding.ts:248 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/tieredExecutor.ts:234 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/tieredExecutor.ts:248 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/tieredExecutor.ts:274 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/tieredExecutor.ts:314 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/tieredExecutor.ts:326 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/tieredExecutor.ts:339 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/tieredExecutor.ts:361 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/tieredExecutor.ts:372 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/toolDependencyValidator.ts:57 | unseeded randomness on a compute path | suspected |
| 2 | reproducibility | src/services/webhooks/webhookDispatcher.ts:339 | unseeded randomness on a compute path | suspected |
