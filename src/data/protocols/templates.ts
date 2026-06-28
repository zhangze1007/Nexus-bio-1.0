/**
 * Pre-built protocol templates for common synthetic biology workflows.
 * Each template provides step-by-step instructions with reagents, equipment, and QC criteria.
 */

export interface ProtocolStep {
  order: number;
  description: string;
  durationMin: number;
  notes?: string;
}

export interface ProtocolTemplate {
  id: string;
  name: string;
  category: "cloning" | "transformation" | "expression" | "purification" | "screening" | "cell-free";
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedDurationMin: number;
  steps: ProtocolStep[];
  equipment: string[];
  reagents: Array<{ name: string; amount: string; unit: string }>;
  qcCriteria: string[];
}

export const PROTOCOL_TEMPLATES: ProtocolTemplate[] = [
  {
    id: "golden-gate",
    name: "Golden Gate Assembly",
    category: "cloning",
    difficulty: "intermediate",
    estimatedDurationMin: 180,
    steps: [
      {
        order: 1,
        description: "Design primers with BsaI recognition sites and 4-bp overhangs",
        durationMin: 30,
        notes: "Use NEB Golden Gate Design Tool or Benchling",
      },
      {
        order: 2,
        description: "PCR amplify fragments with high-fidelity polymerase",
        durationMin: 45,
        notes: "Use Q5 or Phusion, 30 cycles, 72°C extension",
      },
      {
        order: 3,
        description: "Gel purify PCR products",
        durationMin: 30,
        notes: "Use Qiagen QIAquick or Zymo DNA Clean & Concentrator",
      },
      {
        order: 4,
        description: "Set up Golden Gate reaction",
        durationMin: 10,
        notes:
          "25 μL: 50 ng vector, 3:1 insert:vector molar ratio, 1 μL BsaI-HFv2, 1 μL T4 DNA Ligase, 2.5 μL T4 Ligase Buffer",
      },
      {
        order: 5,
        description: "Incubate in thermocycler",
        durationMin: 60,
        notes: "37°C 15 min → (37°C 3 min, 16°C 4 min) × 30 cycles → 50°C 5 min → 80°C 10 min",
      },
      {
        order: 6,
        description: "Transform into competent cells",
        durationMin: 45,
        notes: "Use DH5α or NEB 5-alpha, heat shock 42°C 30s",
      },
      {
        order: 7,
        description: "Plate on selective media and incubate overnight",
        durationMin: 720,
        notes: "37°C, 16-18 hours",
      },
      {
        order: 8,
        description: "Pick colonies and screen by colony PCR or sequencing",
        durationMin: 120,
        notes: "Use M13 primers flanking the insert",
      },
    ],
    equipment: ["Thermocycler", "Gel electrophoresis system", "Heat block (42°C)", "Incubator (37°C)", "Pipettes"],
    reagents: [
      { name: "BsaI-HFv2", amount: "1", unit: "μL" },
      { name: "T4 DNA Ligase", amount: "1", unit: "μL" },
      { name: "T4 Ligase Buffer", amount: "2.5", unit: "μL" },
      { name: "High-fidelity DNA polymerase", amount: "0.5", unit: "μL" },
      { name: "Competent cells (DH5α)", amount: "50", unit: "μL" },
      { name: "LB agar + antibiotic", amount: "20", unit: "mL" },
    ],
    qcCriteria: [
      "Colony PCR shows correct insert size",
      "Sanger sequencing confirms correct assembly",
      "No mutations in coding sequence",
    ],
  },
  {
    id: "gibson-assembly",
    name: "Gibson Assembly",
    category: "cloning",
    difficulty: "intermediate",
    estimatedDurationMin: 150,
    steps: [
      {
        order: 1,
        description: "Design fragments with 20-40 bp overlaps",
        durationMin: 20,
        notes: "Use NEBuilder Assembly Tool",
      },
      {
        order: 2,
        description: "PCR amplify fragments",
        durationMin: 45,
        notes: "High-fidelity polymerase, gel purify",
      },
      { order: 3, description: "Quantify fragments by NanoDrop or Qubit", durationMin: 10, notes: "A260/A280 > 1.8" },
      {
        order: 4,
        description: "Set up Gibson Assembly reaction",
        durationMin: 10,
        notes: "10 μL: 0.02-0.5 pmol DNA, 10 μL Gibson Master Mix (NEB)",
      },
      {
        order: 5,
        description: "Incubate at 50°C",
        durationMin: 60,
        notes: "15 min for 2-3 fragments, 60 min for 4-6 fragments",
      },
      {
        order: 6,
        description: "Transform into competent cells",
        durationMin: 45,
        notes: "Heat shock or electroporation",
      },
      { order: 7, description: "Screen colonies", durationMin: 120, notes: "Colony PCR or restriction digest" },
    ],
    equipment: ["Thermocycler (50°C)", "Heat block (42°C)", "Gel electrophoresis", "Incubator (37°C)"],
    reagents: [
      { name: "Gibson Assembly Master Mix (2X)", amount: "10", unit: "μL" },
      { name: "Competent cells", amount: "50", unit: "μL" },
      { name: "LB agar + antibiotic", amount: "20", unit: "mL" },
    ],
    qcCriteria: ["Correct insert size by colony PCR", "Sequence verified", "Functional assay if applicable"],
  },
  {
    id: "chemical-transformation",
    name: "Chemical Transformation (E. coli)",
    category: "transformation",
    difficulty: "beginner",
    estimatedDurationMin: 90,
    steps: [
      {
        order: 1,
        description: "Thaw competent cells on ice for 30 min",
        durationMin: 30,
        notes: "Use DH5α, TOP10, or BL21 depending on application",
      },
      {
        order: 2,
        description: "Add 1-5 μL DNA to 50 μL competent cells",
        durationMin: 2,
        notes: "Do not pipette vigorously, mix by gentle flicking",
      },
      {
        order: 3,
        description: "Incubate on ice for 30 min",
        durationMin: 30,
        notes: "Keep cells cold at all times before heat shock",
      },
      {
        order: 4,
        description: "Heat shock at 42°C for 30-45 seconds",
        durationMin: 1,
        notes: "Precise timing is critical",
      },
      { order: 5, description: "Return to ice for 2 min", durationMin: 2, notes: "" },
      {
        order: 6,
        description: "Add 950 μL SOC or LB media, recover at 37°C with shaking",
        durationMin: 45,
        notes: "200 rpm, 37°C, 45-60 min",
      },
      {
        order: 7,
        description: "Plate 100-200 μL on selective agar",
        durationMin: 5,
        notes: "Spin down and resuspend in 100 μL for higher efficiency",
      },
      { order: 8, description: "Incubate plates at 37°C overnight", durationMin: 720, notes: "16-18 hours" },
    ],
    equipment: ["Heat block (42°C)", "Ice bucket", "Shaking incubator (37°C)", "Incubator (37°C)", "Centrifuge"],
    reagents: [
      { name: "Competent cells (DH5α)", amount: "50", unit: "μL" },
      { name: "Plasmid DNA", amount: "1-5", unit: "μL" },
      { name: "SOC media", amount: "950", unit: "μL" },
      { name: "LB agar + antibiotic", amount: "20", unit: "mL" },
    ],
    qcCriteria: [
      "Colonies present on selective plate",
      "No colonies on negative control plate",
      "Colony PCR confirms correct transformant",
    ],
  },
  {
    id: "electroporation",
    name: "Electroporation",
    category: "transformation",
    difficulty: "advanced",
    estimatedDurationMin: 120,
    steps: [
      {
        order: 1,
        description: "Prepare electrocompetent cells (or use commercial)",
        durationMin: 60,
        notes: "Wash 3× with cold 10% glycerol, concentrate 100-fold",
      },
      {
        order: 2,
        description: "Chill cuvettes on ice (1 mm or 2 mm gap)",
        durationMin: 10,
        notes: "Pre-chill for at least 10 min",
      },
      {
        order: 3,
        description: "Add 1-2 μL DNA to 50 μL electrocompetent cells",
        durationMin: 2,
        notes: "DNA must be in low-salt buffer or water",
      },
      {
        order: 4,
        description: "Transfer to cuvette, electroporate",
        durationMin: 1,
        notes: "1.8 kV, 25 μF, 200 Ω (E. coli), time constant should be 4-5 ms",
      },
      {
        order: 5,
        description: "Immediately add 950 μL SOC media",
        durationMin: 1,
        notes: "Add media within 5 seconds of pulse",
      },
      {
        order: 6,
        description: "Transfer to tube, recover at 37°C with shaking",
        durationMin: 60,
        notes: "200 rpm, 37°C, 1 hour",
      },
      {
        order: 7,
        description: "Plate on selective media",
        durationMin: 5,
        notes: "Electroporation efficiency is 10-100× higher than chemical transformation",
      },
    ],
    equipment: [
      "Electroporator (Bio-Rad Micropulser or similar)",
      "Electroporation cuvettes (1 mm or 2 mm)",
      "Ice bucket",
      "Shaking incubator",
    ],
    reagents: [
      { name: "Electrocompetent cells", amount: "50", unit: "μL" },
      { name: "Plasmid DNA (in water)", amount: "1-2", unit: "μL" },
      { name: "SOC media", amount: "950", unit: "μL" },
      { name: "LB agar + antibiotic", amount: "20", unit: "mL" },
    ],
    qcCriteria: [
      "Time constant 4-5 ms (indicates proper electroporation)",
      "Colonies on selective plate",
      "Higher efficiency than chemical transformation",
    ],
  },
  {
    id: "iptg-expression",
    name: "IPTG-Induced Protein Expression",
    category: "expression",
    difficulty: "intermediate",
    estimatedDurationMin: 480,
    steps: [
      {
        order: 1,
        description: "Inoculate single colony in 5 mL LB + antibiotic",
        durationMin: 1,
        notes: "Use BL21(DE3) or similar expression strain",
      },
      { order: 2, description: "Grow overnight at 37°C, 200 rpm", durationMin: 720, notes: "16-18 hours" },
      {
        order: 3,
        description: "Inoculate 1:100 into fresh LB + antibiotic (500 mL)",
        durationMin: 5,
        notes: "Use baffled flask for aeration",
      },
      {
        order: 4,
        description: "Grow at 37°C until OD600 = 0.6-0.8",
        durationMin: 180,
        notes: "Monitor every 30 min, takes 3-4 hours",
      },
      {
        order: 5,
        description: "Induce with 0.1-1.0 mM IPTG",
        durationMin: 5,
        notes: "Optimal concentration depends on protein, start with 0.5 mM",
      },
      {
        order: 6,
        description: "Grow at 16-30°C for 4-16 hours",
        durationMin: 360,
        notes: "16°C for soluble expression, 37°C for inclusion bodies",
      },
      { order: 7, description: "Harvest cells by centrifugation", durationMin: 30, notes: "4000 rpm, 20 min, 4°C" },
      {
        order: 8,
        description: "Store cell pellet at -80°C or proceed to lysis",
        durationMin: 5,
        notes: "Pellet can be stored for months at -80°C",
      },
    ],
    equipment: ["Shaking incubator (37°C and 16°C)", "Spectrophotometer (OD600)", "Centrifuge (4°C)", "Baffled flasks"],
    reagents: [
      { name: "LB broth + antibiotic", amount: "505", unit: "mL" },
      { name: "IPTG (1M stock)", amount: "250-2500", unit: "μL" },
    ],
    qcCriteria: [
      "OD600 at induction: 0.6-0.8",
      "SDS-PAGE shows induced band at expected MW",
      "Coomassie stain confirms expression level",
    ],
  },
  {
    id: "his-tag-purification",
    name: "His-Tag Protein Purification (IMAC)",
    category: "purification",
    difficulty: "intermediate",
    estimatedDurationMin: 240,
    steps: [
      {
        order: 1,
        description:
          "Resuspend cell pellet in lysis buffer (50 mM Tris pH 8, 300 mM NaCl, 10 mM imidazole, 1 mg/mL lysozyme)",
        durationMin: 10,
        notes: "Add protease inhibitors",
      },
      {
        order: 2,
        description: "Sonicate on ice (30% amplitude, 10s on/10s off, 5 min total)",
        durationMin: 10,
        notes: "Keep samples cold, avoid overheating",
      },
      {
        order: 3,
        description: "Centrifuge at 15,000 rpm, 30 min, 4°C",
        durationMin: 30,
        notes: "Collect supernatant, this is the soluble fraction",
      },
      {
        order: 4,
        description: "Equilibrate Ni-NTA resin with lysis buffer",
        durationMin: 15,
        notes: "Wash 3× with 5 bed volumes",
      },
      {
        order: 5,
        description: "Incubate lysate with Ni-NTA resin (1-2 hours, 4°C with rotation)",
        durationMin: 90,
        notes: "Batch binding or gravity flow column",
      },
      {
        order: 6,
        description: "Wash with 20 mM imidazole buffer (3× 5 bed volumes)",
        durationMin: 15,
        notes: "Removes non-specific binders",
      },
      {
        order: 7,
        description: "Elute with 250 mM imidazole buffer (5 fractions × 1 bed volume)",
        durationMin: 15,
        notes: "Collect fractions separately, check by SDS-PAGE",
      },
      {
        order: 8,
        description: "Analyze fractions by SDS-PAGE",
        durationMin: 60,
        notes: "Pool fractions with highest purity and yield",
      },
      {
        order: 9,
        description: "Buffer exchange into storage buffer (if needed)",
        durationMin: 30,
        notes: "Use dialysis or PD-10 column",
      },
    ],
    equipment: [
      "Sonication probe",
      "Centrifuge (4°C, 15,000 rpm)",
      "Chromatography column or batch binding tubes",
      "SDS-PAGE system",
      "Rotating mixer",
    ],
    reagents: [
      { name: "Ni-NTA Agarose", amount: "1-2", unit: "mL" },
      { name: "Tris-HCl pH 8", amount: "50", unit: "mM" },
      { name: "NaCl", amount: "300", unit: "mM" },
      { name: "Imidazole", amount: "10-250", unit: "mM" },
      { name: "Lysozyme", amount: "1", unit: "mg/mL" },
      { name: "Protease inhibitor cocktail", amount: "1", unit: "tablet" },
    ],
    qcCriteria: [
      "SDS-PAGE shows single band at expected MW",
      "Bradford assay confirms protein concentration",
      "Activity assay (if applicable) shows functional protein",
    ],
  },
  {
    id: "colony-pcr",
    name: "Colony PCR Screening",
    category: "screening",
    difficulty: "beginner",
    estimatedDurationMin: 180,
    steps: [
      {
        order: 1,
        description: "Prepare PCR master mix",
        durationMin: 10,
        notes: "Use colony PCR–compatible polymerase (Taq or OneTaq)",
      },
      {
        order: 2,
        description: "Pick colonies with sterile pipette tip, touch to master mix, then streak on fresh plate",
        durationMin: 5,
        notes: "Touch briefly, do not transfer visible colony material",
      },
      {
        order: 3,
        description: "Run PCR program",
        durationMin: 90,
        notes: "95°C 5 min → (95°C 30s, 55°C 30s, 72°C 1 min/kb) × 30 cycles → 72°C 5 min",
      },
      {
        order: 4,
        description: "Run products on agarose gel",
        durationMin: 45,
        notes: "1-2% agarose, include DNA ladder and negative control",
      },
      {
        order: 5,
        description: "Identify positive colonies",
        durationMin: 5,
        notes: "Band at expected size = positive clone",
      },
      {
        order: 6,
        description: "Inoculate positive colonies in liquid culture for plasmid prep",
        durationMin: 5,
        notes: "Grow overnight for miniprep",
      },
    ],
    equipment: ["Thermocycler", "Gel electrophoresis system", "UV transilluminator or gel doc"],
    reagents: [
      { name: "Taq DNA polymerase", amount: "0.5", unit: "μL" },
      { name: "dNTPs (10 mM each)", amount: "0.5", unit: "μL" },
      { name: "Forward primer (10 μM)", amount: "1", unit: "μL" },
      { name: "Reverse primer (10 μM)", amount: "1", unit: "μL" },
      { name: "PCR buffer (10×)", amount: "2.5", unit: "μL" },
      { name: "Agarose", amount: "1", unit: "g" },
      { name: "DNA ladder", amount: "5", unit: "μL" },
    ],
    qcCriteria: ["Band at expected insert size", "No band in negative control", "Clean band without smearing"],
  },
  {
    id: "plasmid-miniprep",
    name: "Plasmid Miniprep",
    category: "purification",
    difficulty: "beginner",
    estimatedDurationMin: 45,
    steps: [
      {
        order: 1,
        description: "Harvest 1-5 mL overnight culture by centrifugation",
        durationMin: 5,
        notes: "13,000 rpm, 1 min, discard supernatant",
      },
      {
        order: 2,
        description: "Resuspend pellet in 250 μL P1 buffer (resuspension buffer)",
        durationMin: 2,
        notes: "Vortex or pipette until homogeneous",
      },
      {
        order: 3,
        description: "Add 250 μL P2 buffer (lysis buffer), mix gently by inversion",
        durationMin: 2,
        notes: "Do not vortex! Incubate ≤5 min",
      },
      {
        order: 4,
        description: "Add 350 μL N3 buffer (neutralization), mix immediately",
        durationMin: 2,
        notes: "Mix by gentle inversion, precipitate forms",
      },
      {
        order: 5,
        description: "Centrifuge 13,000 rpm, 10 min",
        durationMin: 10,
        notes: "Clear supernatant contains plasmid DNA",
      },
      {
        order: 6,
        description: "Load supernatant onto miniprep column",
        durationMin: 2,
        notes: "Do not disturb pellet",
      },
      {
        order: 7,
        description: "Wash with 750 μL PE buffer (wash buffer)",
        durationMin: 2,
        notes: "Centrifuge 1 min, discard flow-through",
      },
      { order: 8, description: "Dry column by centrifuging 1 min", durationMin: 2, notes: "Remove residual ethanol" },
      {
        order: 9,
        description: "Elute with 30-50 μL EB or water",
        durationMin: 5,
        notes: "Pre-warm elution buffer to 65°C for higher yield",
      },
    ],
    equipment: ["Microcentrifuge", "Vortex", "Pipettes"],
    reagents: [
      { name: "P1 Resuspension Buffer", amount: "250", unit: "μL" },
      { name: "P2 Lysis Buffer", amount: "250", unit: "μL" },
      { name: "N3 Neutralization Buffer", amount: "350", unit: "μL" },
      { name: "PE Wash Buffer", amount: "750", unit: "μL" },
      { name: "EB Elution Buffer", amount: "50", unit: "μL" },
      { name: "Miniprep columns", amount: "1", unit: "each" },
    ],
    qcCriteria: [
      "A260/A280 ratio 1.8-2.0 (pure DNA)",
      "Expected yield: 5-20 μg from 5 mL culture",
      "Restriction digest shows expected band pattern",
    ],
  },
  {
    id: "agarose-gel",
    name: "Agarose Gel Electrophoresis",
    category: "screening",
    difficulty: "beginner",
    estimatedDurationMin: 90,
    steps: [
      {
        order: 1,
        description: "Prepare 1% agarose in TAE or TBE buffer",
        durationMin: 10,
        notes: "1 g agarose in 100 mL buffer, microwave to dissolve",
      },
      {
        order: 2,
        description: "Cool to ~55°C, add ethidium bromide or SYBR Safe",
        durationMin: 5,
        notes: "0.5 μg/mL EtBr or 1:10,000 SYBR Safe",
      },
      {
        order: 3,
        description: "Pour gel into casting tray with comb",
        durationMin: 5,
        notes: "Remove bubbles, let solidify 30 min",
      },
      {
        order: 4,
        description: "Load samples with loading dye",
        durationMin: 5,
        notes: "Mix 5 μL sample + 1 μL 6× loading dye",
      },
      {
        order: 5,
        description: "Run gel at 100-120 V for 30-45 min",
        durationMin: 40,
        notes: "Run until dye front is 2/3 down the gel",
      },
      {
        order: 6,
        description: "Visualize on UV transilluminator or gel doc",
        durationMin: 5,
        notes: "Photograph for records",
      },
    ],
    equipment: ["Gel electrophoresis system", "Power supply", "UV transilluminator or gel doc", "Microwave"],
    reagents: [
      { name: "Agarose", amount: "1", unit: "g" },
      { name: "TAE or TBE buffer (1×)", amount: "100", unit: "mL" },
      { name: "Ethidium bromide (10 mg/mL)", amount: "5", unit: "μL" },
      { name: "DNA ladder (1 kb)", amount: "5", unit: "μL" },
      { name: "6× loading dye", amount: "1", unit: "μL/sample" },
    ],
    qcCriteria: [
      "DNA ladder resolves clearly",
      "Bands are sharp, not smeared",
      "Expected fragment sizes match predictions",
    ],
  },
  {
    id: "cell-free-txtl",
    name: "Cell-Free TX-TL Expression",
    category: "cell-free",
    difficulty: "advanced",
    estimatedDurationMin: 300,
    steps: [
      {
        order: 1,
        description: "Thaw cell-free extract on ice (S30 or commercial)",
        durationMin: 30,
        notes: "Keep on ice at all times, avoid freeze-thaw cycles",
      },
      {
        order: 2,
        description: "Prepare reaction mix",
        durationMin: 15,
        notes:
          "Final: 33% extract, 10 mM magnesium glutamate, 80 mM potassium glutamate, 1.5 mM ATP/GTP, 0.9 mM CTP/UTP, 0.2 mg/mL tRNA, 0.33 mM NAD, 0.27 mM CoA, 1.5 mM spermidine, 1 mM putrescine, 4 mM sodium oxalate, 1-3 nM plasmid DNA",
      },
      {
        order: 3,
        description: "Add plasmid DNA (1-3 nM final)",
        durationMin: 5,
        notes: "Higher DNA concentrations do not always improve yield",
      },
      {
        order: 4,
        description: "Incubate at 30°C for 1-6 hours",
        durationMin: 360,
        notes: "Monitor fluorescence if using GFP reporter",
      },
      {
        order: 5,
        description: "Analyze protein expression by SDS-PAGE or fluorescence",
        durationMin: 60,
        notes: "For GFP: excitation 485 nm, emission 528 nm",
      },
      {
        order: 6,
        description: "Quantify yield by Bradford or BCA assay",
        durationMin: 30,
        notes: "Typical yield: 0.1-10 μM protein",
      },
    ],
    equipment: [
      "Thermocycler or heat block (30°C)",
      "Fluorescence plate reader",
      "SDS-PAGE system",
      "Pipettes (calibrated)",
    ],
    reagents: [
      { name: "S30 cell-free extract", amount: "10", unit: "μL" },
      { name: "Amino acid mix (2 mM each)", amount: "5", unit: "μL" },
      { name: "NTP mix (ATP, GTP, CTP, UTP)", amount: "5", unit: "μL" },
      { name: "tRNA (10 mg/mL)", amount: "0.5", unit: "μL" },
      { name: "Plasmid DNA (template)", amount: "1-3", unit: "nM" },
      { name: "Magnesium glutamate", amount: "10", unit: "mM" },
      { name: "Potassium glutamate", amount: "80", unit: "mM" },
    ],
    qcCriteria: [
      "Fluorescence signal above background (for GFP reporters)",
      "Protein band visible on SDS-PAGE",
      "Yield within expected range (0.1-10 μM)",
    ],
  },
];

/**
 * Get a template by ID.
 */
export function getTemplate(id: string): ProtocolTemplate | undefined {
  return PROTOCOL_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates by category.
 */
export function getTemplatesByCategory(category: ProtocolTemplate["category"]): ProtocolTemplate[] {
  return PROTOCOL_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get all available categories.
 */
export function getCategories(): string[] {
  return [...new Set(PROTOCOL_TEMPLATES.map((t) => t.category))];
}
