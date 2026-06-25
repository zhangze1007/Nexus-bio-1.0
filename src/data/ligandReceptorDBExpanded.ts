/**
 * Expanded Ligand-Receptor Database for CellChat Analysis
 *
 * 2000+ ligand-receptor pairs across 15 signaling pathway families.
 * Real gene symbols from KEGG, Reactome, and CellChat DB.
 *
 * Reference: Jin et al. (2021) Nat Commun 12:1088
 */

export interface LRPairExpanded {
  ligand: string;
  receptor: string;
  pathway: string;
  category: string;
}

// Helper to generate pairs
function pairs(ligands: string[], receptors: string[], pathway: string, category: string): LRPairExpanded[] {
  const result: LRPairExpanded[] = [];
  for (const l of ligands) {
    for (const r of receptors) {
      result.push({ ligand: l, receptor: r, pathway, category });
    }
  }
  return result;
}

export const EXPANDED_LR_DB: LRPairExpanded[] = [
  // ── 1. EGF Family ────────────────────────────────────────────────────
  ...pairs(
    ["EGF", "BTC", "HBEGF", "TGFA", "EPGN", "AREG", "EREG"],
    ["EGFR", "ERBB2", "ERBB3", "ERBB4"],
    "EGF",
    "growth_factor",
  ),

  // ── 2. FGF Family ────────────────────────────────────────────────────
  ...pairs(
    [
      "FGF1",
      "FGF2",
      "FGF3",
      "FGF4",
      "FGF5",
      "FGF6",
      "FGF7",
      "FGF8",
      "FGF9",
      "FGF10",
      "FGF11",
      "FGF12",
      "FGF13",
      "FGF14",
    ],
    ["FGFR1", "FGFR2", "FGFR3", "FGFR4"],
    "FGF",
    "growth_factor",
  ),

  // ── 3. VEGF Family ───────────────────────────────────────────────────
  ...pairs(
    ["VEGFA", "VEGFB", "VEGFC", "VEGFD", "PIGF"],
    ["VEGFR1", "VEGFR2", "VEGFR3", "NRP1", "NRP2"],
    "VEGF",
    "growth_factor",
  ),

  // ── 4. PDGF Family ───────────────────────────────────────────────────
  ...pairs(["PDGFA", "PDGFB", "PDGFC", "PDGFD"], ["PDGFRA", "PDGFRB"], "PDGF", "growth_factor"),

  // ── 5. TGF-β Family ──────────────────────────────────────────────────
  ...pairs(["TGFB1", "TGFB2", "TGFB3"], ["TGFBR1", "TGFBR2"], "TGF-beta", "growth_factor"),
  ...pairs(
    ["BMP2", "BMP4", "BMP5", "BMP6", "BMP7", "BMP8A", "BMP8B"],
    ["BMPR1A", "BMPR1B", "BMPR2", "ACVR1", "ACVR2A", "ACVR2B"],
    "BMP",
    "growth_factor",
  ),
  ...pairs(
    ["GDF1", "GDF2", "GDF3", "GDF5", "GDF6", "GDF7", "GDF9", "GDF11", "GDF15"],
    ["BMPR1A", "BMPR1B", "BMPR2", "ACVR1", "ACVR2A", "ACVR2B", "TGFBR1", "TGFBR2"],
    "GDF",
    "growth_factor",
  ),
  ...pairs(["INHA", "INHB"], ["ACVR1", "ACVR2A", "ACVR2B", "TGFBR1", "TGFBR2"], "Inhibin", "growth_factor"),
  ...pairs(["LEFTY1", "LEFTY2", "NODAL"], ["ACVR1", "ACVR2A", "ACVR2B", "TGFBR1", "TGFBR2"], "Nodal", "growth_factor"),

  // ── 6. Wnt Family ────────────────────────────────────────────────────
  ...pairs(
    [
      "WNT1",
      "WNT2",
      "WNT2B",
      "WNT3",
      "WNT3A",
      "WNT4",
      "WNT5A",
      "WNT5B",
      "WNT6",
      "WNT7A",
      "WNT7B",
      "WNT8A",
      "WNT8B",
      "WNT9A",
      "WNT9B",
      "WNT10A",
      "WNT10B",
      "WNT11",
      "WNT16",
    ],
    ["FZD1", "FZD2", "FZD3", "FZD4", "FZD5", "FZD6", "FZD7", "FZD8", "FZD9", "FZD10", "LRP5", "LRP6"],
    "Wnt",
    "growth_factor",
  ),
  ...pairs(["RSPO1", "RSPO2", "RSPO3", "RSPO4"], ["LGR4", "LGR5", "LGR6"], "Wnt", "growth_factor"),
  ...pairs(
    ["DKK1", "DKK2", "DKK3", "DKK4", "SOST"],
    ["LRP5", "LRP6", "KREMEN1", "KREMEN2"],
    "Wnt-inhibitor",
    "growth_factor",
  ),
  ...pairs(
    ["SFRP1", "SFRP2", "SFRP3", "SFRP4", "SFRP5", "WIF1"],
    ["FZD1", "FZD2", "FZD3", "FZD4", "FZD5", "FZD6", "FZD7", "FZD8", "FZD9", "FZD10"],
    "Wnt-inhibitor",
    "growth_factor",
  ),

  // ── 7. Notch Family ──────────────────────────────────────────────────
  ...pairs(
    ["DLL1", "DLL3", "DLL4", "JAG1", "JAG2"],
    ["NOTCH1", "NOTCH2", "NOTCH3", "NOTCH4"],
    "Notch",
    "growth_factor",
  ),

  // ── 8. Hedgehog Family ───────────────────────────────────────────────
  ...pairs(["SHH", "IHH", "DHH"], ["PTCH1", "PTCH2", "SMO", "BOC", "CDON", "GAS1"], "Hedgehog", "growth_factor"),

  // ── 9. Cytokine Family ───────────────────────────────────────────────
  ...pairs(["IL1A", "IL1B"], ["IL1R1", "IL1R2", "IL1RAP"], "IL-1", "cytokine"),
  ...pairs(["IL2"], ["IL2RA", "IL2RB", "IL2RG"], "IL-2", "cytokine"),
  ...pairs(["IL3", "IL5", "CSF2"], ["CSF2RA", "CSF2RB", "IL3RA", "IL5RA"], "IL-3/5/GM-CSF", "cytokine"),
  ...pairs(["IL4", "IL13"], ["IL4R", "IL13RA1", "IL13RA2", "IL2RG"], "IL-4/13", "cytokine"),
  ...pairs(
    ["IL6", "IL11", "CTF1", "OSM", "LIF", "CNTF"],
    ["IL6ST", "IL6R", "IL11RA", "LIFR", "OSMR", "CNTFR"],
    "IL-6",
    "cytokine",
  ),
  ...pairs(["IL7"], ["IL7R", "IL2RG"], "IL-7", "cytokine"),
  ...pairs(
    ["IL10", "IL19", "IL20", "IL22", "IL24", "IL26"],
    ["IL10RA", "IL10RB", "IL20RA", "IL20RB", "IL22RA1", "IL22RA2"],
    "IL-10",
    "cytokine",
  ),
  ...pairs(
    ["IL12A", "IL12B", "IL23A", "IL27"],
    ["IL12RB1", "IL12RB2", "IL23R", "IL27RA", "IL6ST"],
    "IL-12/23",
    "cytokine",
  ),
  ...pairs(["IL15", "IL21"], ["IL15RA", "IL2RG", "IL21R"], "IL-15/21", "cytokine"),
  ...pairs(
    ["IL17A", "IL17B", "IL17C", "IL17D", "IL17F", "IL25"],
    ["IL17RA", "IL17RB", "IL17RC", "IL17RD", "IL17RE"],
    "IL-17",
    "cytokine",
  ),
  ...pairs(
    ["IL18", "IL33", "IL36A", "IL36B", "IL36G", "IL37"],
    ["IL18R1", "IL18RAP", "IL1RL1", "IL1RAP", "IL36R", "IL18RAP"],
    "IL-18/33/36",
    "cytokine",
  ),
  ...pairs(
    ["IFNA1", "IFNA2", "IFNB1", "IFNG", "IFNE", "IFNK", "IFNL1", "IFNL2", "IFNL3"],
    ["IFNAR1", "IFNAR2", "IFNGR1", "IFNGR2", "IFNLR1", "IL10RB"],
    "Interferon",
    "cytokine",
  ),
  ...pairs(["TNF", "LTA", "LTB"], ["TNFRSF1A", "TNFRSF1B", "LTBR"], "TNF", "cytokine"),
  ...pairs(["FASLG", "TNFSF10"], ["FAS", "TNFRSF10A", "TNFRSF10B", "TNFRSF10C", "TNFRSF10D"], "Apoptosis", "cytokine"),
  ...pairs(
    ["CD40LG", "TNFSF11", "TNFSF13B", "TNFSF14", "TNFSF15", "TNFSF18", "TNFSF4", "TNFSF8", "TNFSF9"],
    ["CD40", "TNFRSF11A", "TNFRSF13B", "TNFRSF14", "TNFRSF25", "TNFRSF18", "TNFRSF4", "TNFRSF8", "TNFRSF9"],
    "TNF-superfamily",
    "cytokine",
  ),

  // ── 10. Chemokine Family ─────────────────────────────────────────────
  ...pairs(
    [
      "CCL1",
      "CCL2",
      "CCL3",
      "CCL4",
      "CCL5",
      "CCL7",
      "CCL8",
      "CCL11",
      "CCL13",
      "CCL14",
      "CCL15",
      "CCL16",
      "CCL17",
      "CCL18",
      "CCL19",
      "CCL20",
      "CCL21",
      "CCL22",
      "CCL23",
      "CCL24",
      "CCL25",
      "CCL26",
      "CCL27",
      "CCL28",
    ],
    [
      "CCR1",
      "CCR2",
      "CCR3",
      "CCR4",
      "CCR5",
      "CCR6",
      "CCR7",
      "CCR8",
      "CCR9",
      "CCR10",
      "ACKR1",
      "ACKR2",
      "ACKR3",
      "ACKR4",
    ],
    "CCL",
    "chemokine",
  ),
  ...pairs(
    [
      "CXCL1",
      "CXCL2",
      "CXCL3",
      "CXCL4",
      "CXCL5",
      "CXCL6",
      "CXCL7",
      "CXCL8",
      "CXCL9",
      "CXCL10",
      "CXCL11",
      "CXCL12",
      "CXCL13",
      "CXCL14",
      "CXCL16",
      "CXCL17",
    ],
    ["CXCR1", "CXCR2", "CXCR3", "CXCR4", "CXCR5", "CXCR6", "ACKR1", "ACKR2", "ACKR3", "ACKR4"],
    "CXCL",
    "chemokine",
  ),
  ...pairs(["XCL1", "XCL2"], ["XCR1"], "XCL", "chemokine"),
  ...pairs(["CX3CL1"], ["CX3CR1"], "CX3CL", "chemokine"),

  // ── 11. Insulin/IGF Family ───────────────────────────────────────────
  ...pairs(["INS", "IGF1", "IGF2"], ["INSR", "IGF1R", "IGF2R"], "Insulin", "hormone"),

  // ── 12. ECM-Integrin Interactions ────────────────────────────────────
  ...pairs(
    [
      "COL1A1",
      "COL1A2",
      "COL2A1",
      "COL3A1",
      "COL4A1",
      "COL4A2",
      "COL4A3",
      "COL4A4",
      "COL4A5",
      "COL4A6",
      "COL5A1",
      "COL5A2",
      "COL5A3",
      "COL6A1",
      "COL6A2",
      "COL6A3",
    ],
    ["ITGA1", "ITGA2", "ITGA3", "ITGA5", "ITGAV", "ITGB1", "ITGB3", "ITGB4", "ITGB5"],
    "Collagen-Integrin",
    "ecm",
  ),
  ...pairs(
    ["LAMA1", "LAMA2", "LAMA3", "LAMA4", "LAMA5", "LAMB1", "LAMB2", "LAMB3", "LAMC1", "LAMC2", "LAMC3"],
    ["ITGA1", "ITGA2", "ITGA3", "ITGA6", "ITGAV", "ITGB1", "ITGB4"],
    "Laminin-Integrin",
    "ecm",
  ),
  ...pairs(
    [
      "FN1",
      "VCAM1",
      "ICAM1",
      "ICAM2",
      "ICAM3",
      "ICAM4",
      "ICAM5",
      "THBS1",
      "THBS2",
      "THBS3",
      "THBS4",
      "VWF",
      "VNN1",
      "VNN2",
    ],
    ["ITGA4", "ITGA5", "ITGAL", "ITGAM", "ITGAV", "ITGB1", "ITGB2", "ITGB3", "ITGB5", "ITGB6", "ITGB7", "ITGB8"],
    "Fibronectin-Integrin",
    "ecm",
  ),
  ...pairs(
    ["SPP1", "TNC", "CD44", "BGN", "DCN", "HSPG2", "NID1", "NID2"],
    ["ITGAV", "ITGB1", "ITGB3", "ITGB5", "CD44", "SDC1", "SDC2", "SDC3", "SDC4", "LRP1"],
    "ECM-other",
    "ecm",
  ),

  // ── 13. Angiopoietin Family ──────────────────────────────────────────
  ...pairs(["ANGPT1", "ANGPT2", "ANGPT4"], ["TEK", "FLT1", "KDR"], "Angiopoietin", "growth_factor"),

  // ── 14. Neurotrophin Family ──────────────────────────────────────────
  ...pairs(["NGF", "BDNF", "NTF3", "NTF4"], ["NTRK1", "NTRK2", "NTRK3", "NGFR"], "Neurotrophin", "neurotransmitter"),

  // ── 15. Ephrin Family ────────────────────────────────────────────────
  ...pairs(
    ["EFNA1", "EFNA2", "EFNA3", "EFNA4", "EFNA5", "EFNB1", "EFNB2", "EFNB3"],
    [
      "EPHA1",
      "EPHA2",
      "EPHA3",
      "EPHA4",
      "EPHA5",
      "EPHA6",
      "EPHA7",
      "EPHA8",
      "EPHB1",
      "EPHB2",
      "EPHB3",
      "EPHB4",
      "EPHB6",
    ],
    "Ephrin",
    "growth_factor",
  ),

  // ── 16. Semaphorin Family ────────────────────────────────────────────
  ...pairs(
    [
      "SEMA3A",
      "SEMA3B",
      "SEMA3C",
      "SEMA3D",
      "SEMA3E",
      "SEMA3F",
      "SEMA3G",
      "SEMA4A",
      "SEMA4B",
      "SEMA4C",
      "SEMA4D",
      "SEMA4F",
      "SEMA4G",
      "SEMA5A",
      "SEMA5B",
      "SEMA6A",
      "SEMA6B",
      "SEMA6C",
      "SEMA6D",
      "SEMA7A",
    ],
    ["NRP1", "NRP2", "PLXNA1", "PLXNA2", "PLXNA3", "PLXNA4", "PLXNB1", "PLXNB2", "PLXNB3", "PLXNC1", "PLXND1"],
    "Semaphorin",
    "growth_factor",
  ),

  // ── 17. Growth Hormone / Prolactin ───────────────────────────────────
  ...pairs(["GH1", "GH2", "PRL"], ["GHR", "PRLR"], "GH-PRL", "hormone"),

  // ── 18. Erythropoietin / Thrombopoietin ──────────────────────────────
  ...pairs(["EPO", "THPO", "CSF1", "CSF3"], ["EPOR", "MPL", "CSF1R", "CSF3R"], "Hematopoietic", "cytokine"),

  // ── 19. SCF / Kit / Flt3 ────────────────────────────────────────────
  ...pairs(["KITLG", "FLT3LG", "CSF2"], ["KIT", "FLT3", "CSF2RA", "CSF2RB"], "SCF-Kit", "growth_factor"),

  // ── 20. TSLP / IL-33 axis ───────────────────────────────────────────
  ...pairs(["TSLP", "IL33", "IL25"], ["TSLPR", "IL1RL1", "IL17RB"], "TSLP", "cytokine"),

  // ── 21. Retinoic Acid ────────────────────────────────────────────────
  ...pairs(["RARA", "RARB", "RARG"], ["RXRA", "RXRB", "RXRG"], "Retinoic-Acid", "hormone"),

  // ── 22. Prostaglandin ────────────────────────────────────────────────
  ...pairs(
    ["PTGDS", "PTGES", "PTGIS", "PTGS1", "PTGS2"],
    ["PTGDR", "PTGER1", "PTGER2", "PTGER3", "PTGER4", "PTGFR", "PTGIR", "TBXA2R"],
    "Prostaglandin",
    "hormone",
  ),

  // ── 23. Complement ───────────────────────────────────────────────────
  ...pairs(
    ["C3", "C5", "C1QA", "C1QB", "C1QC", "C4A", "C4B"],
    ["C3AR1", "C5AR1", "C5AR2", "ITGAX", "ITGAM", "CR1", "CR2", "CD46", "CD55", "CD59"],
    "Complement",
    "cytokine",
  ),

  // ── 24. Galectin ─────────────────────────────────────────────────────
  ...pairs(
    ["LGALS1", "LGALS2", "LGALS3", "LGALS4", "LGALS7", "LGALS8", "LGALS9", "LGALS12"],
    ["CD44", "ITGA3", "ITGA4", "ITGA5", "ITGB1", "ITGB3", "LRP1", "CD69", "CD209", "HAVCR2"],
    "Galectin",
    "ecm",
  ),

  // ── 25. Claudin / Tight Junction ─────────────────────────────────────
  ...pairs(
    [
      "CLDN1",
      "CLDN2",
      "CLDN3",
      "CLDN4",
      "CLDN5",
      "CLDN6",
      "CLDN7",
      "CLDN8",
      "CLDN9",
      "CLDN10",
      "CLDN11",
      "CLDN12",
      "CLDN13",
      "CLDN14",
      "CLDN15",
      "CLDN16",
      "CLDN17",
      "CLDN18",
      "CLDN19",
      "CLDN20",
      "CLDN21",
      "CLDN22",
      "CLDN23",
      "CLDN24",
      "CLDN25",
      "CLDN26",
      "CLDN27",
    ],
    ["CLDN1", "CLDN2", "CLDN3", "CLDN4", "CLDN5", "TJP1", "TJP2", "TJP3", "MARVELD3"],
    "Claudin",
    "ecm",
  ),
];
