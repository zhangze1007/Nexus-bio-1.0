# Nexus-Bio 1.0

**Next-Gen Bio-Intelligent Architecture**

A synthetic biology research platform that extracts metabolic pathways from scientific literature and renders them as interactive 3D visualizations — integrating AI analysis, molecular structures, protein data, and kinetic simulation in a single unified interface.

> Built by a gap-year student in Malaysia, on a tablet, in under 48 hours.

---

## Live Demo

**[nexus-bio-1-0.vercel.app](https://nexus-bio-1-0.vercel.app)**

Showcase pathway: Artemisinin biosynthesis in engineered *S. cerevisiae* — Ro et al., *Nature* 2006

---

## What It Does

**Research Workflow**
```
Paste a paper → AI extracts pathway → 3D visualization
→ Click any node → Molecular structure + Kinetic simulation
```

**Core Features**

| Module | Description |
|--------|-------------|
| Paper Analyzer | AI extracts metabolic nodes, edges, and evidence from any research paper |
| Atomic Pathway | Interactive 3D pathway visualization with pLDDT confidence coloring |
| Database Research | Parallel search across 6 academic databases (PubMed, Semantic Scholar, OpenAlex, Europe PMC, bioRxiv, CORE) |
| Node Panel | 3-tab scientific workbench: Overview · Structure · Kinetics |
| Protein Structure | AlphaFold pLDDT coloring + RCSB PDB experimental structures |
| Molecular Structure | Real 3D conformers from PubChem (dynamic name search) |
| Cell Imagery | Microscopy reference images from Wikipedia, Cell Image Library, EMBL-EBI IDR |
| Kinetic Simulation | Michaelis-Menten + RK4 ODE simulation for enzyme nodes |
| Thermodynamics | Gibbs free energy (ΔG) calculation for metabolite nodes |

---

## Tech Stack

```
Frontend     React + TypeScript + Vite + Tailwind CSS v3 + Framer Motion
3D           Three.js + @react-three/fiber + @react-three/drei
             Custom GLSL shaders (organic volume terrain)
             3Dmol.js (protein + molecular rendering)
AI           Groq llama-3.3-70b (primary) → Gemini 2.0-flash (fallback)
Data         PubChem · AlphaFold EBI · RCSB PDB · 6 academic databases
Deploy       Vercel (Edge Runtime API routes)
```

---

## Architecture

```
api/
├── gemini.ts       AI endpoint — Groq primary + Gemini fallback chain
├── alphafold.ts    AlphaFold CORS proxy (EBI)
└── pubchem.ts      PubChem 3D SDF proxy (CID + name search)

src/components/
├── ThreeScene.tsx          3D pathway — GLSL shaders, pastel palette
├── NodePanel.tsx           Scientific workbench (3 tabs)
├── PaperAnalyzer.tsx       AI paper analysis + pathway generation
├── SemanticSearch.tsx      6-database parallel literature search
├── MoleculeViewer.tsx      PubChem small molecule 3D
├── CellImageViewer.tsx     Microscopy image search (3 sources)
├── KineticPanel.tsx        Enzyme kinetics — MM equation + RK4 ODE
└── ThermodynamicsPanel.tsx Metabolite thermodynamics — ΔG calculation
```

**AI Fallback Chain**
```
Groq llama-3.3-70b-versatile → Groq llama3-70b-8192
→ Gemini 2.0-flash-lite → Gemini 1.5-flash → 503
```

---

## Local Development

```bash
git clone https://github.com/zhangze1007/Nexus-bio-1.0
cd Nexus-bio-1.0
npm install
```

Create `.env.local`:
```
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

```bash
npm run dev
```

> Get a free Groq API key at [console.groq.com](https://console.groq.com)

---

## Design Principles

- **Scientific credibility** — Every AI-generated node has an evidence trace linked to source text
- **Progressive disclosure** — Core information first, details on demand
- **Workflow continuity** — Each feature is the entry point to the next
- **Visual integrity** — Quality is never sacrificed for functionality

---

## Showcase

The default pathway demonstrates artemisinin biosynthesis — a landmark synthetic biology achievement that made malaria treatment affordable for 500 million patients.

**Ro et al., 2006. *Nature* 440, 940–943**

7 metabolic nodes · Acetyl-CoA → HMG-CoA → Mevalonate → FPP → Amorphadiene → Artemisinic Acid → Artemisinin

---

## About

Built by **Zhang Ze Foo** — a pre-university student in Malaysia on a gap year after completing STPM (A-level equivalent).

This project was built to demonstrate that meaningful scientific tools can be created by individuals without formal CS training, using AI as an execution layer.

**Contact**
- Email: fuchanze@gmail.com
- LinkedIn: [linkedin.com/in/zhangze-foo-3575ba359](https://linkedin.com/in/zhangze-foo-3575ba359)

---

## Copilot Agent & Firewall

If you use the GitHub Copilot coding agent on this repo and the workflow fails with `HTTP/2 GOAWAY connection terminated` or a firewall-blocked warning, see **[docs/firewall.md](docs/firewall.md)** for a step-by-step fix.

Key references:
- Allowlist configuration: <https://gh.io/copilot/firewall-config>
- Copilot setup steps: <https://gh.io/copilot/actions-setup-steps>

---

## License

MIT License — open for research and educational use.
