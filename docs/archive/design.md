# Nexus-Bio Workbench Design Brief for Stitch

## Product Overview
Nexus-Bio is not a generic AI dashboard. It is a synthetic biology and computational biology research workbench built around a multi-stage design cycle: literature and target intake, pathway design, simulation, chassis/control strategy, validation, and iteration.

The product is organized around a canonical 4-stage workflow:
- Stage 1: Design & Discovery
- Stage 2: Simulation & Component Optimization
- Stage 3: Chassis Engineering & Control
- Stage 4: Test, Analyze & Iterate

Within that product architecture, the day-to-day workbench behavior should feel like a 5-step operational loop:
- Setup
- Run
- Inspect
- Compare
- Iterate

That distinction matters. The 4 stages describe how Nexus-Bio is organized as a platform. The 5-step loop describes how a scientist works inside and across tools.

Nexus-Bio should feel like a serious operational workspace for designing and evaluating biological systems, not a gallery of disconnected features.

This brief is grounded in the active Nexus-Bio workbench sources, especially:
- PATHD route and wrapper files: `app/tools/pathd/page.tsx`, `app/tools/pathd/PathDClient.tsx`, `src/components/tools/PathDPage.tsx`
- supporting center-canvas mechanics: `src/components/tools/MetabolicEngPage.tsx`, `src/components/tools/ToolOverlay.tsx`, `src/components/tools/StatusOverlay.tsx`, `src/components/NodePanel.tsx`
- broader workbench structure: `app/tools/layout.tsx`, `app/tools/page.tsx`, `src/components/ide/ToolsLayoutShell.tsx`, `src/components/workbench/WorkbenchDirectoryPage.tsx`, `WorkbenchStatusBar.tsx`, `WorkbenchInlineContext.tsx`, `WorkbenchEvidenceTracePanel.tsx`, and `WorkbenchDecisionTracePanel.tsx`
- representative module surfaces: `FBASimPage.tsx`, `CatalystDesignerPage.tsx`, `DynConPage.tsx`, `CellFreePage.tsx`, and `NEXAIPage.tsx`

## Target Users
Primary users:
- computational biology and synthetic biology researchers
- advanced students and technical operators working on pathway design, enzyme selection, flux analysis, control strategy, and screening workflows
- users who need dense, evidence-linked scientific tooling rather than lightweight SaaS dashboards

These users are comfortable with structured information, experimental tradeoffs, and model outputs. They do not need the interface to feel simplified. They need it to feel credible, navigable, and operational.

## Core Product Identity
Nexus-Bio is a research-grade synthetic biology workbench centered on pathway reasoning, quantitative simulation, evidence traceability, and iterative decision-making.

Its identity is not "AI biotech." Its identity is:
- pathway-centered
- evidence-linked
- model-aware
- research-grade
- expert-dense
- iterative
- operational

Representative modules that define this identity:
- PATHD as the pathway design and route object workbench
- FBASIM as the systems-level flux state and host constraint surface
- CATDES as catalyst and enzyme optimization
- DYNCON as dynamic control and response tuning
- CELLFREE as the pre-build validation gate
- NEXAI as the cross-stage research copilot grounded in the active workbench context

Identity keywords:
`computational biology`, `synthetic biology`, `pathway engineering`, `research workbench`, `scientific instrument`, `evidence trace`, `decision support`, `simulation`, `DBTL continuity`, `premium laboratory console`

## Workbench Philosophy
The workbench should feel like an instrument panel for biological design decisions.

This means:
- the active scientific object must always be clear
- the center workspace must dominate
- side panels must support action, inspection, and interpretation
- provenance and evidence should remain visible
- transitions between tools should feel like continuation, not reset

The product should communicate that a scientist is moving one coherent project object through multiple lenses, not jumping between unrelated apps.

PATHD is the strongest current structural reference because it already expresses several of the right ideas:
- a dominant central scientific canvas
- floating or adjacent instrument-like controls
- explicit scientific state
- deep inspection through node-level drill-down
- clear downstream handoff into other tools

Stitch should extract those structural strengths, not clone PATHD's exact surface styling.

## Workflow Structure
### 4-Stage Product Workflow
Nexus-Bio is organized around four connected stages:

1. Stage 1: Design & Discovery  
Research intake, Analyze artifacts, and PATHD establish the route object, bottlenecks, enzyme candidates, and evidence-linked pathway context.

2. Stage 2: Simulation & Component Optimization  
FBASIM, CETHX, CATDES, and PROEVOL quantify route feasibility, bottlenecks, thermodynamic pressure, catalyst tradeoffs, and optimization priorities.

3. Stage 3: Chassis Engineering & Control  
GENMIM, GECAIR, and DYNCON translate upstream constraints into chassis edits, circuit logic, and control strategies.

4. Stage 4: Test, Analyze & Iterate  
CELLFREE, DBTLflow, MULTIO, and SCSPATIAL validate designs, compare outcomes, and feed learning back into the next cycle.

NEXAI should sit across these stages as a supporting research and synthesis layer, not as the main visual identity of the workbench.

### 5-Step Operational Loop
Inside the workbench, each tool and cross-tool transition should support the same operating rhythm:

1. Setup  
Choose or confirm the active route, object, parameters, constructs, or research question.

2. Run  
Execute a simulation, analysis, solve, synthesis, or research query.

3. Inspect  
Study the active figure, route object, structure, graph, or output in the center workspace.

4. Compare  
Use the right rail to interpret evidence, constraints, diagnostics, and competing options.

5. Iterate  
Promote the next action, revise parameters, hand off to the next module, or return to a prior stage with better context.

This loop should be obvious in the layout, not just implied in labels.

## Key Modules and Their Roles
- `PATHD`: Primary pathway and enzyme design workbench. This is the clearest benchmark for center-canvas dominance, inspection depth, and workflow handoff.
- `FBASIM`: Converts pathway context into host-level flux constraints, growth tradeoffs, carbon efficiency, and system feasibility.
- `CATDES`: Supports enzyme and catalyst comparison, structure-informed evaluation, ranking, and redesign decisions.
- `CETHX`: Interprets pathway feasibility through thermodynamic burden and energy landscape logic.
- `DYNCON`: Frames control tuning and response stability as an operational systems problem rather than a generic chart surface.
- `CELLFREE`: Acts as the fast validation gate before slower DBTL loops, with construct, yield, depletion, and confidence judgments.
- `NEXAI`: Provides research synthesis, citation-linked reasoning, and cross-stage next-step support tied to the active project object.
- `Workbench Launcher / Directory`: Should function as a workflow-aware entry surface that helps users continue a project, not just browse cards.
- `Evidence / Decision / Audit Layers`: These are important product-specific identity features and should be preserved as real workflow support surfaces.

## Current Strengths to Preserve
- The product already has a clear scientific framing and a real multi-stage workflow model rather than a vague list of tools.
- PATHD already shows the right structural instincts: a dominant center canvas, instrument overlays, strong inspection, and downstream handoff.
- The persistent tools shell and workbench status structures support continuity instead of treating each module as a fresh page.
- The repo already encodes evidence trace, decision trace, freshness, audit, project context, and downstream recommendation logic.
- Many module descriptions and inline context layers are explicitly tied to scientific decisions, not generic productivity copy.
- The best pages already feel closer to a scientific instrument or lab console than to a generic marketing dashboard.

## Current UX Problems
- The workbench still feels visually split between multiple identities: dark graphite workbench surfaces, lighter paper-derived tokens, and decorative card language.
- Center-workspace dominance is strongest in PATHD but inconsistent across the broader tool ecosystem.
- Shared hero and method-strip patterns often consume too much vertical space before the user reaches the real working surface.
- The right rail frequently reads like a stack of dashboard cards instead of a serious evidence, diagnostic, or comparison surface.
- The launcher and some shared workbench panels over-package information as polished cards instead of operational workflow scaffolding.
- Some shared layouts still drift toward equal-weight column balance rather than clearly prioritizing the active scientific object.
- Decorative gradients, glass effects, and panel treatments are sometimes doing more visual work than the underlying scientific hierarchy.
- The system occasionally looks "generated" because multiple surfaces emphasize polished containers more than domain-specific structure.

## Layout Principles
- The center workspace must be the main stage on core tool pages.
- On desktop, the center workspace should occupy about `55–65%` of the viewport width.
- Core tool pages should avoid equal-weight three-column dashboard layouts.
- A useful default desktop ratio is:
  - left rail: roughly `18–22%`
  - center workspace: roughly `55–65%`
  - right rail: roughly `18–24%`

### What the center workspace should feel like
The center should feel like the live scientific object under manipulation, not a decorative hero area and not just the middle card in a grid.

Depending on the module, the center should behave like:
- a pathway canvas in PATHD
- a quantitative systems solve or flux figure in FBASIM
- a structure or catalyst evaluation surface in CATDES
- a control-response or system-behavior workspace in DYNCON
- a bench-style assay/readout stage in CELLFREE
- an evidence-linked synthesis and citation graph surface in NEXAI

It should feel:
- active
- inspectable
- stateful
- consequential
- visually dominant

### What the side panels should do
Left rails should support operation:
- setup
- controls
- parameter tuning
- mode switching
- active object selection

Right rails should support judgment:
- evidence
- diagnostics
- inspection
- provenance
- comparison
- next-step interpretation

Neither rail should default to decorative summary cards. Both rails should feel like working supports for the center object.

Additional layout rules:
- compress tall headers into slim contextual rails
- keep critical controls and critical outputs visible together when possible
- use overlays and floating instruments when they strengthen the center workspace, as PATHD does
- keep persistent project/stage context visible, but not dominant
- on tablet and mobile, collapse side rails into toggled auxiliary panels while preserving center-workspace priority

## Information Hierarchy
The interface should communicate information in this order:

1. Active scientific object  
What is being designed, simulated, inspected, or compared right now?

2. Current execution state  
What mode is the tool in? What run is current? Is the output fresh, simulated, evidence-linked, or waiting for rerun?

3. Operational controls  
What can the scientist change immediately?

4. Evidence and diagnostics  
What supports or challenges the current interpretation?

5. Comparison and next-step logic  
How should this result influence the next module, the next run, or the next stage?

6. Background metadata  
Stage, audit, lineage, collaborator, and supporting project context should remain accessible but should not visually overpower the active work.

## Visual Language
Primary direction: **Graphite lab console**

This should be the dominant feel of the workbench:
- dark graphite, carbon, and near-black neutral surfaces
- restrained accent usage
- low glow
- low gimmick
- high clarity
- high contrast where needed for data readability
- premium instrument-panel hierarchy

Secondary influence only: **hybrid dark-paper**

This influence should appear in limited, controlled ways:
- typography warmth
- evidence readability
- calmer reading surfaces for citations, notes, and provenance
- selective contrast softening in supporting panels

This secondary influence should not turn the workbench into a notebook UI. The operational feel must remain instrument-like.

Typography direction:
- use clean, serious sans-serif UI typography for controls and labels
- keep mono typography for values, metrics, states, formulas, and audit signals
- reserve slightly warmer or more editorial typography treatment for evidence excerpts or longer scientific text

Color direction:
- use accent colors semantically, not decoratively
- keep PATHD's pastel scientific family as restrained signal colors, not as brand gradients spread everywhere
- avoid neon saturation and fake "high-tech" glow

Material direction:
- favor crisp, dense, precise panels over soft decorative cards
- use glass or blur sparingly and only when it helps overlays sit on top of a dominant canvas
- prefer layered instrument surfaces over bento-card cosmetics

## Interaction Principles
- Preserve workflow continuity across tools. The user should feel that the same project object is moving through different analytical lenses.
- Use progressive disclosure, but keep the important scientific object and controls visible early.
- Make state explicit: current object, current mode, current run, freshness, evidence linkage, and next recommended action.
- Treat inspection as a first-class behavior. Node drill-down, evidence trace, diagnostics, and comparison should feel integral, not secondary.
- Encourage compare-and-decide behavior. Right-side surfaces should help the user weigh alternatives, not just read summaries.
- Keep transitions fast and grounded. Motion should support continuity and spatial understanding, not "future" aesthetics.
- Let the center workspace remain visually stable while side rails update, overlay, and refine interpretation around it.

## Non-Negotiables
- Nexus-Bio must not look like a generic AI-generated cyberpunk dashboard.
- Core tool pages must not use equal-weight dashboard-style three-column layouts.
- The center workspace must dominate the desktop layout at roughly `55–65%` width.
- Left rails are for setup, controls, and active object selection.
- Right rails are for evidence, diagnostics, inspection, comparison, and handoff logic.
- PATHD should be used as a structural reference, not copied as a skin.
- The interface must preserve scientific product identity, evidence traceability, and workflow continuity.
- The workbench should feel operational and research-grade, not decorative.

## Anti-Patterns to Avoid
- generic futuristic SaaS chrome
- cyberpunk glow fields
- purple-heavy AI aesthetics
- fake finance-style charts
- empty background drama without operational meaning
- decorative glassmorphism as the main identity
- oversized hero banners on core tool pages
- right rails composed mostly of passive summary cards
- launcher designs that look like a feature marketplace instead of a project continuation surface
- surfaces that reset user context instead of carrying the same project object forward
- layouts where the active scientific object is visually weaker than the supporting UI

## Instructions for Stitch
- Design Nexus-Bio as a serious synthetic biology / computational biology workbench, not a SaaS admin dashboard.
- Use the 4-stage workflow as the product architecture and the 5-step operational loop as the interaction rhythm.
- Treat PATHD as the structural benchmark for center-canvas dominance, explicit state, inspection depth, and workflow handoff.
- Do not copy PATHD's exact surface treatment. Generalize its spatial logic across the broader tool ecosystem.
- On core tool pages, allocate about `55–65%` of desktop width to the center workspace.
- Use the left rail for setup, controls, modes, and active object selection.
- Use the right rail for evidence, diagnostics, inspection, comparison, provenance, and next-step guidance.
- Compress tall banners and repeated hero cards into slimmer contextual layers.
- Preserve persistent project, stage, evidence, and decision continuity across tools.
- Make representative modules feel distinct but part of one system:
  - PATHD should feel like route design
  - FBASIM should feel like systems constraint analysis
  - CATDES should feel like catalyst decision support
  - DYNCON should feel like dynamic systems tuning
  - CELLFREE should feel like pre-build validation
  - NEXAI should feel like a research desk tied to execution
- Make the launcher feel like a workflow continuation surface, not a card showroom.
- Use graphite lab console as the dominant visual direction.
- Use hybrid dark-paper only in supporting evidence and reading moments.
- Prioritize instrument hierarchy, scientific calm, and operational density over trendy styling.

## Design Prompt Seed for Stitch
Design Nexus-Bio as a premium computational biology and synthetic biology research workbench. The product is organized around a 4-stage workflow, but each tool should feel like part of the same 5-step operational loop: setup, run, inspect, compare, iterate. Use PATHD as the strongest structural reference for center-canvas dominance, instrument overlays, inspection depth, explicit scientific state, and workflow handoff, but do not clone its exact surface style. Core desktop tool pages should give roughly 55–65% of width to the center scientific workspace, with a left rail for setup and controls and a right rail for evidence, diagnostics, inspection, and comparison. The visual language should be graphite lab console first, with hybrid dark-paper only as a secondary influence for typography, evidence readability, and scientific calm. Avoid equal-weight dashboard columns, fake biotech futurism, decorative glass cards, finance-style charts, and generic AI SaaS aesthetics.

## Condensed 1-Page Prompt for Stitch
Redesign Nexus-Bio as a serious synthetic biology and computational biology workbench, not a generic AI dashboard. Keep the product organized around its real 4-stage workflow:
- Stage 1: Design & Discovery
- Stage 2: Simulation & Component Optimization
- Stage 3: Chassis Engineering & Control
- Stage 4: Test, Analyze & Iterate

Within each page and cross-tool flow, express a 5-step operational loop:
- Setup
- Run
- Inspect
- Compare
- Iterate

Use PATHD as the strongest structural benchmark, but only for structure:
- dominant center canvas
- instrument overlays
- explicit scientific state
- deep inspection
- downstream workflow handoff

Do not clone PATHD's exact styling.

Layout rules:
- center workspace should occupy about 55–65% of desktop width on core tool pages
- left rail: setup, controls, modes, active object selection
- right rail: evidence, diagnostics, inspection, comparison, provenance, next-step guidance
- avoid equal-weight three-column dashboard layouts

Make representative modules feel product-specific:
- PATHD = pathway design and route object
- FBASIM = systems-level flux and host constraints
- CATDES = catalyst and enzyme optimization
- DYNCON = dynamic control and response tuning
- CELLFREE = pre-build validation bench
- NEXAI = evidence-grounded research copilot

Visual direction:
- primary: graphite lab console
- secondary only: hybrid dark-paper for evidence readability and scientific calm
- premium, restrained, instrument-like
- low glow, low gimmick, high clarity

Avoid:
- cyberpunk biotech UI
- purple AI aesthetics
- decorative bento cards as the main layout language
- fake finance charts
- empty glowing backgrounds
- generic futuristic SaaS patterns

The workbench should feel dense, credible, evidence-linked, and continuous across tools.

## Screenshot-Based Refinement Prompt
Use the attached Nexus-Bio workbench screenshot as a refinement target, not as something to redesign from scratch.

Keep:
- the overall product identity as a scientific workbench
- the persistent shell and sense of stage continuity
- the existing module names and workbench logic
- the idea of evidence, decision trace, and workflow handoff

Improve:
- make the center workspace clearly dominant, aiming for roughly 55–65% of desktop width
- reduce any equal-weight dashboard feel
- compress oversized hero/banner areas into slimmer contextual rails
- convert passive side-card stacks into purposeful workflow rails
- make the left side feel like setup and controls
- make the right side feel like evidence, diagnostics, inspection, and comparison
- strengthen the sense that the center is the live scientific object
- increase product-specific structure so the UI feels like Nexus-Bio, not an AI-generated dashboard

Use PATHD as the structural reference:
- dominant canvas
- instrument overlays
- explicit state
- deep inspection
- visible next-step handoff

Do not over-copy PATHD's surface style. Generalize its spatial logic.

Visual direction:
- graphite lab console first
- hybrid dark-paper only as a secondary influence for evidence readability and scientific calm
- premium, restrained, research-grade

Avoid:
- generic glass cards
- decorative charts
- empty glows
- cyberpunk biotech styling
- finance-terminal mimicry
- equal-weight three-column balance on core tool pages

The final result should feel like a serious computational biology interface where a scientist moves continuously from setup to run to inspection to comparison to iteration.
