import type {
  EnzymeStructure,
  CatalyticResidue,
  PathwayStep,
  PathwayCandidate,
} from '../services/CatalystDesignerEngine';

// ---------------------------------------------------------------------------
// Artemisinin biosynthesis pathway in S. cerevisiae — 5 key enzymes
// ---------------------------------------------------------------------------

const HMGR_SEQUENCE =
  'MDLVGPTFLSLGKLGDKGRNLNTEAHEAAQRNPKHEKQRFRTLGVLGAVDEEGVMDRAPA' +
  'ECDKTQPGLVVGMFVDSYIVGKVRYSGCKLLADNSLECKHFLTTKVDASIHFVIGYFVDR' +
  'APKNKLELMFQVLFMLILPPAIKVFSGKPGVCDSKAGERGGLDGYFLGDGAMRINNGASS' +
  'IPDWASEFGGISVVYSFKLCQHYQAIGSLEWVNISHCKEAVHRKPLRIQAHLGRTGAFGR' +
  'DSRKMGTGSDVVPLICCLGVKFFEAQTRCDLNVDMAAAKVRTGDVIYQLSVLPDVPKSLL' +
  'FYKQRAAVYNFYGVANDSDAMFWNFLPEMNFNVNAFFGNIVNGLGEFHVDSWKMAHGHVA' +
  'STVRKSRVTLYKTPDELDEVQTVVSSVASMTYRVKLVHRDISGIYNALKDEQPDGGLGIQ' +
  'LSDGTIGDLPPASAHKLVQINDCRMFRTKQ';

const ERG20_SEQUENCE =
  'MKFPIVGDPKDVLVVEKAGTTLSKSGSYRTQPELEPQHSPKRGGSLETSAIADLSRLDAI' +
  'LEGEPEPQVLLKCEDNDPMGLAADRGTPARPAQHALVTHDTLTDAPQRAWNRSEKEQQAH' +
  'DQTSPHVNKISPVQQLFGIRELQGGNEFTVLMLTIPTDINAGTVRIKSPETVVAGAKPGG' +
  'ITWKVAGGGLKVHKTAFIFRISGLMIQSLDLAKVCAPRNGKISFCVDRPMGGDAALLIRV' +
  'GTTITYNDDMSKDYQLAVPRVATTMIILLSEVLHQRMCDVLPIDYGRDILEEDQETVMNK' +
  'IVEHSKCDKSGEPDPGKMSTAHRGAKKACYIAQITKVQWGKSYKFFVNSM';

const ADS_SEQUENCE =
  'MKQVVRCIAKEKKIEGTRGPLPTNSDQWILIRFFSKITSDAIHETDQQFEVTPFLLDYCP' +
  'SADFSTYLNVEAKRNALFDGYAIVVLNYTASERDSVQGSIGRRCVWDVRTPLRIYVNRED' +
  'DTTDQDYDVSRPLVPAAKHKYQVQINPEAHAHFTWHNENLKIDDRQMAGLFKYGLQYVSA' +
  'MVIAFAIDPMSPASAISHLESMQATKWESGAQIDDRLNGARLPGGFEAYLFAAVADLLNG' +
  'EALPKPINKAIMLNFKIHLISTIYLLRLVDKECKIRATQDPTGIGEISASDEAYLQAAPN' +
  'DRKEDEDPFTHRERGDGAQEPRNQHQRDLMQVGTVELFRSADLPGSEETNRLLARDVDIS' +
  'VPASVTIDLSRLVGAVELPAETIQNLFLLYFRRTSALENRQYLQGRKSVEEAKAKYETQN' +
  'GAGRPDGPIPPIYRDDFDALRVVDKVILQLFQRKIKNFINDEIALAYETIAGSSKAEVSE' +
  'RNDLATVTDYFERAEHTSRM';

const CYP71AV1_SEQUENCE =
  'MVENNDQPTKDSEEGGMIGALQAPQFLEPAEAQPNASSTGSVPIKVNIQEMWIVEKHNNA' +
  'VDFKAQQVPVYASMGIELLIGCELMQDNAVQTATILLVQKTKAVVLSNIAYRLKGASRGS' +
  'DLWLKKCKSIDWVLNEPDPPELKNANITDNLPIVLGLMKCKVPGENFEAEFPFSHIIYKN' +
  'TLRQKELDVRSTELFECVWMLDENTHARNLLNESRRTMEPRKSDVAPISKVVICVYIAQI' +
  'YILTQEELKFQTMDNKAGANLKENKRLVCTKPQLHDITEFNDGHSYLAAAETEMFQVDKA' +
  'VKTAMADTRQRQLLDRDPSDIDVHINTVLLSIGRVTPFWAEKEIVGAVSRGFAERVPIKI' +
  'VLMKHGELIFDIKQSFTPESRGKLIPVCTAWSNEMPGKILAEIIRKERACPVEQKTVNED' +
  'WRNTTLIHNPRTRADDQATLMACVATSPYFPLAGEDKVAYEEPTDTRGGKGHVVGTVEMN' +
  'VATEWQHNVVTESVIG';

const ALDH1_SEQUENCE =
  'MKMTARRGDKDLSTAPLKMSMFIGHEDYLRKTMYAFAYCSIMHYFLRAWVCKIMQIGAAI' +
  'VGPNRPAQFQKLDGAEGVGPHVTLDTLAVSIFTVAYVRGAAPRSKIKDGGPFLITLRLKK' +
  'RAEKAGRLKNIKILINTSNPRLELCMLMLSPPWDSCEFYETDKDEGKKNGLLVDKKQGEV' +
  'MTANSPFLGALRTLPSGGFLIVNPERDEVADGVLMFYDSIHMDNVSAEPIQVTNYKHKAG' +
  'GDYQATGVDRFGPTKIFEHLMHACIGREYKPEKEVKIAWIQYESKGAVMRSAEEQIDTVQ' +
  'HCIANATIYKDLLQMDPSQGTLKERDRIILKLKVWLNDNYAAAGKNVSESRCGTQDFPAE' +
  'KLLAISNRFAKLGFFILLYYRLMVHRPTSLAGQSFEPACTIHLSQEPHSPLVCIEMSTDL' +
  'RNTLATDPVALVEVAGIKSLEARESVSLYYWRAEAVILSSILVGDRGAVMEDNEENFHAE';

// ---------------------------------------------------------------------------
// Catalytic residues per enzyme
// ---------------------------------------------------------------------------

const HMGR_RESIDUES: CatalyticResidue[] = [
  {
    position: 398,
    residue: 'H',
    role: 'acid_base',
    distanceToSubstrate: 2.8,
    optimalDistance: 2.7,
    orientationAngle: 112.0,
    optimalAngle: 110.0,
    pKa: 6.04,
    pKaShift: -0.45,
  },
  {
    position: 219,
    residue: 'E',
    role: 'stabilizer',
    distanceToSubstrate: 3.6,
    optimalDistance: 3.5,
    orientationAngle: 128.0,
    optimalAngle: 125.0,
    pKa: 4.25,
    pKaShift: 0.8,
  },
  {
    position: 317,
    residue: 'D',
    role: 'nucleophile',
    distanceToSubstrate: 2.9,
    optimalDistance: 2.8,
    orientationAngle: 105.0,
    optimalAngle: 104.0,
    pKa: 3.65,
    pKaShift: 1.2,
  },
  {
    position: 261,
    residue: 'K',
    role: 'substrate_binding',
    distanceToSubstrate: 3.2,
    optimalDistance: 3.0,
    orientationAngle: 135.0,
    optimalAngle: 130.0,
    pKa: 10.53,
    pKaShift: -1.1,
  },
];

const ERG20_RESIDUES: CatalyticResidue[] = [
  {
    position: 100,
    residue: 'D',
    role: 'substrate_binding',
    distanceToSubstrate: 3.1,
    optimalDistance: 3.0,
    orientationAngle: 118.0,
    optimalAngle: 115.0,
    pKa: 3.65,
    pKaShift: 1.5,
  },
  {
    position: 104,
    residue: 'D',
    role: 'stabilizer',
    distanceToSubstrate: 3.8,
    optimalDistance: 3.5,
    orientationAngle: 125.0,
    optimalAngle: 120.0,
    pKa: 3.65,
    pKaShift: 0.9,
  },
  {
    position: 112,
    residue: 'R',
    role: 'acid_base',
    distanceToSubstrate: 4.2,
    optimalDistance: 4.0,
    orientationAngle: 140.0,
    optimalAngle: 135.0,
    pKa: 12.48,
    pKaShift: -0.7,
  },
];

const ADS_RESIDUES: CatalyticResidue[] = [
  {
    position: 301,
    residue: 'D',
    role: 'acid_base',
    distanceToSubstrate: 3.0,
    optimalDistance: 2.9,
    orientationAngle: 108.0,
    optimalAngle: 105.0,
    pKa: 3.65,
    pKaShift: 1.8,
  },
  {
    position: 305,
    residue: 'D',
    role: 'stabilizer',
    distanceToSubstrate: 3.5,
    optimalDistance: 3.3,
    orientationAngle: 122.0,
    optimalAngle: 118.0,
    pKa: 3.65,
    pKaShift: 1.3,
  },
  {
    position: 444,
    residue: 'D',
    role: 'nucleophile',
    distanceToSubstrate: 2.7,
    optimalDistance: 2.6,
    orientationAngle: 98.0,
    optimalAngle: 95.0,
    pKa: 3.65,
    pKaShift: 2.1,
  },
  {
    position: 441,
    residue: 'R',
    role: 'substrate_binding',
    distanceToSubstrate: 4.1,
    optimalDistance: 3.8,
    orientationAngle: 145.0,
    optimalAngle: 140.0,
    pKa: 12.48,
    pKaShift: -0.5,
  },
];

const CYP71AV1_RESIDUES: CatalyticResidue[] = [
  {
    position: 443,
    residue: 'C',
    role: 'nucleophile',
    distanceToSubstrate: 2.5,
    optimalDistance: 2.4,
    orientationAngle: 95.0,
    optimalAngle: 92.0,
    pKa: 8.18,
    pKaShift: -2.3,
  },
  {
    position: 303,
    residue: 'T',
    role: 'acid_base',
    distanceToSubstrate: 3.3,
    optimalDistance: 3.1,
    orientationAngle: 115.0,
    optimalAngle: 112.0,
    pKa: 13.0,
    pKaShift: -4.5,
  },
  {
    position: 298,
    residue: 'D',
    role: 'stabilizer',
    distanceToSubstrate: 3.9,
    optimalDistance: 3.7,
    orientationAngle: 130.0,
    optimalAngle: 128.0,
    pKa: 3.65,
    pKaShift: 1.0,
  },
];

const ALDH1_RESIDUES: CatalyticResidue[] = [
  {
    position: 302,
    residue: 'C',
    role: 'nucleophile',
    distanceToSubstrate: 2.6,
    optimalDistance: 2.5,
    orientationAngle: 100.0,
    optimalAngle: 98.0,
    pKa: 8.18,
    pKaShift: -1.8,
  },
  {
    position: 268,
    residue: 'E',
    role: 'acid_base',
    distanceToSubstrate: 3.4,
    optimalDistance: 3.2,
    orientationAngle: 118.0,
    optimalAngle: 115.0,
    pKa: 4.25,
    pKaShift: 0.6,
  },
  {
    position: 169,
    residue: 'N',
    role: 'oxyanion_hole',
    distanceToSubstrate: 3.0,
    optimalDistance: 2.8,
    orientationAngle: 110.0,
    optimalAngle: 108.0,
    pKa: 8.8,
    pKaShift: -0.3,
  },
];

// ---------------------------------------------------------------------------
// ENZYME_STRUCTURES
// ---------------------------------------------------------------------------

export const ENZYME_STRUCTURES: EnzymeStructure[] = [
  {
    id: 'hmgr',
    name: 'HMG-CoA reductase (tHMGR)',
    ecNumber: '1.1.1.34',
    uniprotId: 'P12683',
    sequence: HMGR_SEQUENCE,
    length: 450,
    catalyticResidues: HMGR_RESIDUES,
    substrate: 'HMG-CoA',
    product: 'Mevalonate',
    kcat: 2.1,
    km: 0.045,
    vmax: 2.55,
    optimalTemp: 30,
    optimalPH: 7.0,
    meltingTemp: 52,
    molecularWeight: 49.5,
  },
  {
    id: 'erg20',
    name: 'FPP synthase (ERG20)',
    ecNumber: '2.5.1.10',
    uniprotId: 'P08836',
    sequence: ERG20_SEQUENCE,
    length: 350,
    catalyticResidues: ERG20_RESIDUES,
    substrate: 'IPP + DMAPP',
    product: 'FPP',
    kcat: 0.85,
    km: 0.012,
    vmax: 1.26,
    optimalTemp: 30,
    optimalPH: 7.4,
    meltingTemp: 48,
    molecularWeight: 40.5,
  },
  {
    id: 'ads',
    name: 'Amorphadiene synthase (ADS)',
    ecNumber: '4.2.3.24',
    uniprotId: 'Q9AR04',
    sequence: ADS_SEQUENCE,
    length: 500,
    catalyticResidues: ADS_RESIDUES,
    substrate: 'FPP',
    product: 'Amorpha-4,11-diene',
    kcat: 0.038,
    km: 0.006,
    vmax: 0.041,
    optimalTemp: 30,
    optimalPH: 7.0,
    meltingTemp: 42,
    molecularWeight: 56.2,
  },
  {
    id: 'cyp71av1',
    name: 'Amorphadiene oxidase (CYP71AV1)',
    ecNumber: '1.14.14.21',
    uniprotId: 'Q8LKJ5',
    sequence: CYP71AV1_SEQUENCE,
    length: 496,
    catalyticResidues: CYP71AV1_RESIDUES,
    substrate: 'Amorpha-4,11-diene',
    product: 'Artemisinic acid',
    kcat: 0.15,
    km: 0.022,
    vmax: 0.158,
    optimalTemp: 28,
    optimalPH: 7.2,
    meltingTemp: 45,
    molecularWeight: 57.1,
  },
  {
    id: 'aldh1',
    name: 'Aldehyde dehydrogenase (ALDH1)',
    ecNumber: '1.2.1.3',
    uniprotId: 'P54114',
    sequence: ALDH1_SEQUENCE,
    length: 480,
    catalyticResidues: ALDH1_RESIDUES,
    substrate: 'Artemisinic aldehyde',
    product: 'Artemisinic acid',
    kcat: 3.2,
    km: 0.15,
    vmax: 3.5,
    optimalTemp: 30,
    optimalPH: 7.5,
    meltingTemp: 55,
    molecularWeight: 54.8,
  },
];

// ---------------------------------------------------------------------------
// PATHWAY_STEPS — ADS (step 3) is the bottleneck
// ---------------------------------------------------------------------------

export const PATHWAY_STEPS: PathwayStep[] = [
  {
    stepNumber: 1,
    enzyme: 'hmgr',
    substrate: 'HMG-CoA',
    product: 'Mevalonate',
    kcat: 2.1,
    km: 0.045,
    currentFlux: 0.52,
    targetFlux: 0.50,
    intermediateConc: 0.15,
    toxicityThreshold: 5.0,
    isToxic: false,
    adjustedKcat: 2.1,
    expressionMultiplier: 1.0,
  },
  {
    stepNumber: 2,
    enzyme: 'erg20',
    substrate: 'IPP + DMAPP',
    product: 'FPP',
    kcat: 0.85,
    km: 0.012,
    currentFlux: 0.48,
    targetFlux: 0.50,
    intermediateConc: 0.42,
    toxicityThreshold: 0.5,
    isToxic: false,
    adjustedKcat: 0.85,
    expressionMultiplier: 1.0,
  },
  {
    stepNumber: 3,
    enzyme: 'ads',
    substrate: 'FPP',
    product: 'Amorpha-4,11-diene',
    kcat: 0.038,
    km: 0.006,
    currentFlux: 0.12,
    targetFlux: 0.50,
    intermediateConc: 0.08,
    toxicityThreshold: 2.0,
    isToxic: false,
    adjustedKcat: 0.038,
    expressionMultiplier: 1.0,
  },
  {
    stepNumber: 4,
    enzyme: 'cyp71av1',
    substrate: 'Amorpha-4,11-diene',
    product: 'Artemisinic acid',
    kcat: 0.15,
    km: 0.022,
    currentFlux: 0.45,
    targetFlux: 0.50,
    intermediateConc: 0.05,
    toxicityThreshold: 1.5,
    isToxic: false,
    adjustedKcat: 0.15,
    expressionMultiplier: 1.0,
  },
  {
    stepNumber: 5,
    enzyme: 'aldh1',
    substrate: 'Artemisinic aldehyde',
    product: 'Artemisinic acid',
    kcat: 3.2,
    km: 0.15,
    currentFlux: 0.50,
    targetFlux: 0.50,
    intermediateConc: 0.12,
    toxicityThreshold: 3.0,
    isToxic: false,
    adjustedKcat: 3.2,
    expressionMultiplier: 1.0,
  },
];

// ---------------------------------------------------------------------------
// PATHWAY_CANDIDATES — 4 alternative synthesis routes (scores zeroed for engine)
// ---------------------------------------------------------------------------

export const PATHWAY_CANDIDATES: PathwayCandidate[] = [
  {
    id: 'native-mva',
    name: 'Native MVA → Artemisinin',
    steps: 5,
    deltaG: -142.3,
    theoreticalYield: 0.73,
    atpBurden: 18,
    nadphBurden: 4,
    enzymeComplexity: 3,
    toxicIntermediates: 1,
    paretoRank: 0,
    dominatedBy: [],
    scores: { thermodynamic: 0, yield: 0, metabolicCost: 0, feasibility: 0 },
  },
  {
    id: 'mep-pathway',
    name: 'MEP → Artemisinin',
    steps: 7,
    deltaG: -128.7,
    theoreticalYield: 0.85,
    atpBurden: 14,
    nadphBurden: 6,
    enzymeComplexity: 7,
    toxicIntermediates: 2,
    paretoRank: 0,
    dominatedBy: [],
    scores: { thermodynamic: 0, yield: 0, metabolicCost: 0, feasibility: 0 },
  },
  {
    id: 'hybrid-mva-mep',
    name: 'Hybrid MVA-MEP',
    steps: 6,
    deltaG: -156.1,
    theoreticalYield: 0.79,
    atpBurden: 16,
    nadphBurden: 5,
    enzymeComplexity: 5,
    toxicIntermediates: 1,
    paretoRank: 0,
    dominatedBy: [],
    scores: { thermodynamic: 0, yield: 0, metabolicCost: 0, feasibility: 0 },
  },
  {
    id: 'de-novo-shunt',
    name: 'De Novo Shunt',
    steps: 4,
    deltaG: -98.5,
    theoreticalYield: 0.91,
    atpBurden: 22,
    nadphBurden: 3,
    enzymeComplexity: 4,
    toxicIntermediates: 0,
    paretoRank: 0,
    dominatedBy: [],
    scores: { thermodynamic: 0, yield: 0, metabolicCost: 0, feasibility: 0 },
  },
];

// ---------------------------------------------------------------------------
// Convenience export — rate-limiting enzyme in the pathway
// ---------------------------------------------------------------------------

export const RATE_LIMITING_ENZYME = ENZYME_STRUCTURES[2]; // ADS
