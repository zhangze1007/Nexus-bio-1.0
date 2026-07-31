# External Service Status Registry

**Purpose:** log the API endpoints whose failures are caused by an **external service being
unreachable/unconfigured — NOT a defect in our code** — so future debugging doesn't
re-investigate them. Compiled 2026-07-31 (UI audit round 3). **This round only registers;
it does not fix any external-service issue.**

## Why these fail here (two root causes, both environmental)

1. **Self-hosted "sidecar" microservices not running.** Some routes proxy a Python sidecar
   at a configurable URL that defaults to `localhost`. With no sidecar process running (and no
   env URL set), the fetch fails → 502/503/timeout. Fix = run the sidecar + set its env URL.
2. **Outbound network egress to public DBs is blocked in this sandbox.** Direct proxies to
   public scientific databases return `502 "<svc> unreachable: fetch failed"` because the
   sandbox can't reach the host. On the real Vercel deployment (egress allowed) these work.

**Judgment basis (why external, not our bug), applies to every row below:** the route code
is correct — it fetches the external URL, and on failure returns a clean typed error with the
right status code (it does not crash, leak, or fabricate). The failure text is always
`"… unreachable: fetch failed"` / `"sidecar may be unavailable"` / `"not configured"`, i.e.
transport/config, never a logic error. Swap in a reachable service and the same code succeeds.

## Registry

| Endpoint | External service | Category | Status / error text | Observed? | Affected pages | Degradation / fallback | What a real fix needs |
|---|---|---|---|---|---|---|---|
| `/api/equilibrator` | eQuilibrator (ΔG′) | sidecar (`EQUILIBRATOR_SIDECAR_URL`, default `:5001`) | `502 Sidecar error` / timeout `"eQuilibrator sidecar may be unavailable"`; browser logs `503` | **Yes** (console, CETHX) | CETHX (`useCETHXState`) | **Yes** — falls back to pre-computed Lehninger/NIST reference ΔG; UI states *"Uncertainty ~15% of \|ΔG′\| — using pre-computed reference data"* | Run the eQuilibrator sidecar (Python) + set `EQUILIBRATOR_SIDECAR_URL` |
| `/api/bigg` | BiGG Models (`bigg.ucsd.edu/api/v3`) | direct public-DB proxy | `502 "BiGG unreachable: fetch failed"` | **Yes** (round-1 audit, GECAIR) | GECAIR, FBASIM model load, DatabaseStatusDashboard | Partial — model list fails; e_coli_core is bundled locally (`benchmarks/reference/fba`), so core FBA still runs | Network egress to `bigg.ucsd.edu` (works on Vercel) |
| `/api/kegg` | KEGG (`www.kegg.jp`) | direct public-DB proxy | `502` unreachable (code) | inferred | pathway lookup, DatabaseStatusDashboard | DatabaseStatusDashboard shows service offline | egress to `www.kegg.jp` |
| `/api/brenda` | BRENDA (kinetics) | sidecar (`BRENDA_SIDECAR_URL`, default `:5002`) | `502 Sidecar error` / `"BRENDA sidecar may be unavailable"` | inferred | ThermodynamicsPanel, DatabaseStatusDashboard | kinetics fields show unavailable | Run BRENDA sidecar + set `BRENDA_SIDECAR_URL` |
| `/api/sabio` | SABIO-RK (`sabiork.h-its.org`) | direct public-DB proxy | `502` unreachable (code) | inferred | kinetics (`brendaClient`) | unavailable state | egress to `sabiork.h-its.org` |
| `/api/uniprot` | UniProt (`rest.uniprot.org`) | direct public-DB proxy | `502` unreachable (code) | inferred | protein lookup, DatabaseStatusDashboard | unavailable state | egress to `rest.uniprot.org` |
| `/api/rhea` | Rhea (`www.rhea-db.org`) | direct public-DB proxy | `502` unreachable (code) | inferred | reaction lookup | unavailable state | egress to `www.rhea-db.org` |
| `/api/pubchem` | PubChem (`pubchem.ncbi.nlm.nih.gov`) | direct public-DB proxy | `404`/`502` (code) | inferred | Hero search, MoleculeViewer, CatalystViewer3D | 3D molecule view falls back to empty/placeholder | egress to `pubchem.ncbi.nlm.nih.gov` |
| `/api/alphafold` | AlphaFold DB (`alphafold.ebi.ac.uk`) | direct public-DB proxy | `404`/`502` (code) | inferred | ProteinViewer, PDBExplorer, CatalystViewer3D | structure view falls back / fail-closed (no fabricated structure) | egress to `alphafold.ebi.ac.uk` |
| `/api/docking` | AlphaFold/EBI (docking inputs) | direct public-DB proxy | `502` unreachable (code) | inferred | docking (`dockingClient`) | unavailable state | egress to EBI |
| `/api/rna` | RNA fold Python backend | sidecar (`RNA_PYTHON_BACKEND`, no default) | `503 "RNA backend not configured (set RNA_PYTHON_BACKEND)"` | inferred | RNA fold tool | explicit "not configured" message | Deploy RNA backend + set `RNA_PYTHON_BACKEND` |

Also in this family (from earlier sessions, same pattern — hosted-inference sidecars/keys):
`/api/esm2`, `/api/esm3`, `/api/esmfold` (ESM/ESMFold via `ESM2_PYTHON_BACKEND` / `BIOHUB_API_KEY`),
`/api/analyze` (Groq/Gemini via `GROQ_API_KEY`/`GEMINI_API_KEY` → 503 if unset). Same judgment:
env/config, fail-closed, not a code bug.

## Notes

- **Observed = directly seen failing this session** (equilibrator, bigg). **Inferred = the route
  code returns the listed status on unreachable, but I did not trigger it in-page this round** —
  marked honestly rather than claiming observation.
- Entry count: **11 endpoints** tabulated + 4 noted (esm2/esm3/esmfold/analyze) = 15.
- Consumer of many of these: `src/components/ide/shared/DatabaseStatusDashboard.tsx` already
  surfaces per-service up/down status — the intended graceful UX for these being offline.
- **Fix scope note:** none of these are UI-code bugs; they are deployment concerns (run sidecars,
  configure keys, allow egress). Tracking them here so a red console on these endpoints in a
  sandbox is recognized as expected, not chased as a regression.
