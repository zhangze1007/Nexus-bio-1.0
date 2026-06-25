export { type BiGGModel, getBiGGModel, listBiGGModels } from "./biggClient";
export { type BRENDAKinetics, getBRENDAKinetics } from "./brendaClient";
export { type DockingResult, runDocking } from "./dockingClient";
export { type FallbackOptions, type FallbackResult, fetchWithFallback } from "./fetchWithFallback";
export { getKEGGCompound, type KEGGCompoundResult, type KEGGPathwayResult, searchKEGGPathway } from "./keggClient";
export { type PubChemCompound, searchPubChemCompound } from "./pubchemClient";
export { getRheaReaction, type RheaReaction, type RheaSearchResult, searchRhea, searchRheaWithFallback } from "./rheaClient";
export { searchUniProt, type UniProtEntry } from "./uniprotClient";

// ESM-3 Generative Protein Design (new — GAP-1)
export { type ESM3FoldInput, type ESM3FoldResult, type ESM3GenerateInput, type ESM3GenerateResult, designProteinForFold, designProteinForFunction, generateProtein, generateProteinLocalHeuristic, predictStructure } from "../esm3Client";
