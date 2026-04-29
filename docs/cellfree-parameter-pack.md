# CellFree Parameter Pack

This table records CellFree defaults discovered in `src/services/CellFreeEngine.ts`. It is an honesty inventory, not a calibration package. Source status values are `cited`, `repo-default`, `heuristic`, `unknown`, or `not-applicable`.

| Parameter | Value/default | Unit | Used in code? | Source status | Source/citation | Confidence | Notes |
|---|---|---|---|---|---|---|---|
| GFP DNA concentration | 10 | nM | yes | repo-default | none in repo | low | Default construct input. |
| GFP k_tx | 2.5 | nM/min | yes | heuristic | none in repo | low | Comment says T7 promoter very fast. |
| GFP d_mRNA | 0.08 | 1/min | yes | heuristic | none in repo | low | Comment notes about 12 min half-life. |
| GFP k_tl | 4.0 | nM/min | yes | heuristic | none in repo | low | Comment says strong RBS. |
| GFP K_tl | 50 | nM | yes | repo-default | none in repo | low | Ribosome affinity default. |
| GFP protein length | 239 | aa | yes | unknown | none in repo | unknown | Used for amino-acid consumption. |
| ADS DNA concentration | 15 | nM | yes | repo-default | none in repo | low | Default artemisinin-pathway construct. |
| ADS k_tx | 0.8 | nM/min | yes | heuristic | none in repo | low | Weaker promoter default. |
| ADS d_mRNA | 0.1 | 1/min | yes | heuristic | none in repo | low | Default degradation term. |
| ADS k_tl | 2.0 | nM/min | yes | heuristic | none in repo | low | Medium RBS default. |
| ADS K_tl | 80 | nM | yes | repo-default | none in repo | low | Ribosome affinity default. |
| ADS protein length | 563 | aa | yes | unknown | none in repo | unknown | Used for amino-acid consumption. |
| CYP71AV1 DNA concentration | 20 | nM | yes | repo-default | none in repo | low | Default P450 construct input. |
| CYP71AV1 k_tx | 0.5 | nM/min | yes | heuristic | none in repo | low | Weak promoter default. |
| CYP71AV1 d_mRNA | 0.12 | 1/min | yes | heuristic | none in repo | low | Default degradation term. |
| CYP71AV1 k_tl | 1.0 | nM/min | yes | heuristic | none in repo | low | Weak RBS default. |
| CYP71AV1 K_tl | 120 | nM | yes | repo-default | none in repo | low | Lower ribosome affinity default. |
| CYP71AV1 protein length | 496 | aa | yes | unknown | none in repo | unknown | Used for amino-acid consumption. |
| Total ribosome pool | 500 | nM | yes | repo-default | none in repo | low | Global resource default. |
| Total RNAP pool | 100 | nM | yes | repo-default | none in repo | low | Global resource default. |
| Reaction volume | 10 | uL | yes | repo-default | none in repo | low | Default reaction setting. |
| Temperature | 30 | C | yes | repo-default | none in repo | low | Default simulation setting. |
| Initial ATP | 1.5 | mM | yes | repo-default | none in repo | low | Energy pool default. |
| Initial GTP | 1.5 | mM | yes | repo-default | none in repo | low | Energy pool default. |
| Initial PEP | 33 | mM | yes | repo-default | none in repo | low | Regeneration pool default. |
| Initial amino acids | 2.0 | mM | yes | repo-default | none in repo | low | Resource pool default. |
| Initial NTPs | 2.0 | mM | yes | repo-default | none in repo | low | Resource pool default. |
| Energy decay rate | 0.003 | 1/min | yes | heuristic | none in repo | low | ATP decay term. |
| PEP regeneration rate | 0.005 | 1/min | yes | heuristic | none in repo | low | ATP regeneration term. |
| Simulation time | 240 | min | yes | repo-default | none in repo | medium | Numerical run window, not a biological source claim. |
| Time step | 0.5 | min | yes | repo-default | none in repo | medium | Numerical integration setting. |
| K_NTP | 0.3 | mM | yes | repo-default | none in repo | low | Michaelis constant for transcription resource modulation. |
| K_AA | 0.2 | mM | yes | repo-default | none in repo | low | Michaelis constant for translation resource modulation. |
| Energy modulation constant | 0.1 | mM | yes | repo-default | none in repo | low | ATP modulation denominator. |
| Transcription ATP cost factor | 0.002 | mM per rate unit | yes | heuristic | none in repo | low | Resource-consumption coefficient. |
| Translation ATP cost factor | 0.005 | mM per rate unit | yes | heuristic | none in repo | low | Resource-consumption coefficient. |
| Translation GTP cost factor | 0.003 | mM per rate unit | yes | heuristic | none in repo | low | Resource-consumption coefficient. |
| Amino-acid cost factor | 0.001 | mM per amino-acid rate unit | yes | heuristic | none in repo | low | Resource-consumption coefficient. |
| NTP cost factor | 0.001 | mM per transcription rate unit | yes | heuristic | none in repo | low | Resource-consumption coefficient. |
| Synthetic fitting Vmax | 450 | RFU/min | yes | heuristic | generated demo data | low | Used in mock plate-reader data generation. |
| Synthetic fitting Kd | 8.5 | nM | yes | heuristic | generated demo data | low | Used in mock plate-reader data generation. |
| Plate-reader DNA concentrations | 0, 1, 5, 10, 25, 50 | nM | yes | repo-default | generated demo data | low | Synthetic demonstration sweep. |
| Plate-reader replicates | 3 | count | yes | repo-default | generated demo data | low | Synthetic demonstration setup. |
| Plate-reader timepoints | 20 | count | yes | repo-default | generated demo data | low | Synthetic demonstration setup. |
| IvIv MLP normalization means | 250, 25, 1000, 0.5, 0.5, 500, 0.6 | mixed | yes | heuristic | none in repo | low | Seeded default model normalization. |
| IvIv MLP normalization stdevs | 200, 20, 800, 0.3, 0.3, 400, 0.2 | mixed | yes | heuristic | none in repo | low | Seeded default model normalization. |
| IvIv MLP weights | seeded RNG 12345 | not-applicable | yes | heuristic | none in repo | low | Not retrained on user data. |
| IvIv correction factors | formula-based | dimensionless | yes | heuristic | none in repo | low | Folding, codon, promoter, and RBS corrections. |

## Boundary

Broad TX-TL framework references in code comments are useful context, but they do not source every numeric value above. Until per-parameter sources, calibration data, and uncertainty semantics are added, CellFree output should be treated as exploratory simulation metadata rather than calibrated protocol or external-handoff evidence.
