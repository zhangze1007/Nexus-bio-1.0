# Architecture

## 4-Stage Research Cycle

Nexus-Bio implements a closed-loop synthetic biology research workflow across four stages:

```
INPUT: Target Molecular Product
         |
         v
+---------------------------------------------------+
| STAGE 1: DESIGN & DISCOVERY                        |
|                                                     |
|   LAB (basic research) <---------------------------+|
|       | blueprint data                              ||
|       v                                              ||
|   PATHD (Pathway & Enzyme Design Navigator)         ||
|       | thermodynamic parameters -------------------+|
|                                                     |
+---------------------------------------------------+
         |
         v
+---------------------------------------------------+
| STAGE 2: SIMULATION & COMPONENT OPTIMIZATION        |
|                                                     |
|   FBAsim (flux balance analysis) --+                |
|   CETHX (thermodynamics) ---------+--> bottlenecks |
|                                     |               |
|                                     v               |
|                            PROEVOL (protein evol.)  |
|                                     |               |
|                                     v               |
|                            CATDES (enzyme design)   |
|                                     |               |
|                              optimized sequence     |
+---------------------------------------------------+
         |
         v
+---------------------------------------------------+
| STAGE 3: CHASSIS ENGINEERING & CONTROL              |
|                                                     |
|   GENMIM (genome minimization) --> efficient chassis|
|                                     |               |
|                                     v               |
|                            GECAIR (gene circuits)   |
|                                     |               |
|                                     v               |
|                            DYNCON (dynamic control) |
|                                     |               |
|                              build instructions     |
+---------------------------------------------------+
         |
         v
+---------------------------------------------------+
| STAGE 4: TEST, ANALYZE & ITERATE                    |
|                                                     |
|   DBTLflow --> CFS (cell-free screening)            |
|            --> DBTL (cell construction & testing)   |
|            --> MULTIO (multi-omics integration)     |
|            --> SCSPATIAL (single-cell spatial)      |
|            --> DBTLflow (learned optimization)      |
|                   |                                 |
|                   +---> feedback ---> INPUT         |
+---------------------------------------------------+
```

## Cross-Cutting: NEXAI

NEXAI (AI Multi-Module Research Assistant) is available across all four stages for literature search, paper analysis, and Socratic reasoning.

## Tool Routing

| Stage | Tools |
|-------|-------|
| 1 - Design | LAB, PATHD |
| 2 - Simulation | FBASim, CETHX, ProEvol, CATDES |
| 3 - Chassis | GenMIM, GECAIR, DynCon |
| 4 - Test | DBTLflow, CellFree, MultiO, ScSpatial |
| All | NEXAI |
