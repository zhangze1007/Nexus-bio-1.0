# Nexus-Bio OS Platform Blueprint

> Comprehensive design specification for upgrading Nexus-Bio 1.0 from a demo platform to a production-grade Synthetic Biology Operating System.

**Date:** 2026-06-25
**Author:** Zhang Ze Foo + Claude
**Status:** Design Specification

---

## 1. Executive Summary

Nexus-Bio 1.0 is a synthetic biology AI platform built in 48 hours on a tablet. It has **~95,000 lines of TypeScript** across 14 tool pages, 27 API routes, 155 unit tests, and 10 E2E specs. The scientific computing core is genuinely strong — FBA family (FVA, pFBA, MOMA, OptKnock, FSEOF), enzyme kinetics (MM, Hill, inhibition models), thermodynamics (group contribution, Alberty), GP regression, MCMC, UMAP, Gillespie SSA, and more.

**What exists:** Real algorithms, Auth.js v5 OAuth, libSQL/Turso persistence, Upstash Redis rate limiting, Sentry monitoring, Python sidecars (BRENDA, eQuilibrator, ScSpatial), 27 API routes with middleware auth + CSRF + rate limiting.

**What's missing:** Multi-tenancy, sequence editor, inventory management, real-time collaboration, LIMS integration, billing, plugin system, compliance framework.

This document specifies **13 branches** of upgrade, each with problem statement, solution architecture, exact tech stack, and step-by-step execution plan.

---

## 2. Current State Assessment

| Dimension | Current State | Gap |
|-----------|--------------|-----|
| **Infrastructure** | Vercel Hobby, no lint/format, minimal Sentry | No CI/CD beyond typecheck+test+build |
| **Auth** | Auth.js v5 beta (GitHub/Google OAuth, JWT) | No email login, no MFA, no per-user API keys |
| **Data** | libSQL 8 tables, CREATE TABLE IF NOT EXISTS | No ORM, no migrations, no file storage |
| **Scientific Core** | 20+ real algorithms (FBA, kinetics, GP, etc.) | Community FBA is heuristic, only iJO1366 subset |
| **UI** | 14 tool pages, dark theme, Three.js 3D | No sequence editor, no genome browser, no i18n |
| **API** | 27 routes, internal only | No OpenAPI docs, no versioning, no SDK |
| **Testing** | 155 unit + 10 E2E Playwright | No visual regression, no a11y audit |
| **Collaboration** | Polling-based sync, revision conflict | No real-time, no cursor presence, no chat |
| **Inventory** | None | No strain/plasmid/primer/chemical tracking |
| **LIMS** | None | No Benchling/LabArchives integration |
| **Billing** | None (free tier) | No Stripe, no usage tracking |
| **Compliance** | Basic audit log | No 21 CFR Part 11, no GDPR, no SOC 2 |
| **AI** | Groq+Gemini, Axon orchestrator | No caching, no multi-turn, no voice |

---

## 3. Target Architecture (8 Layers)

```
Layer 8: BUSINESS        Billing, Analytics, Go-to-Market
Layer 7: API & EXTEND    Public API, Plugins, Integrations, SDKs
Layer 6: AI PLATFORM     Axon Agent, Model Infra, NL Interface, Copilot
Layer 5: COLLABORATION   Real-time, Project Mgmt, Knowledge Base, Sharing
Layer 4: DOMAIN TOOLS    14 existing + Sequence Editor, Inventory, LIMS, ELN
Layer 3: SCIENTIFIC CORE FBA, Kinetics, Protein, Genetic Design, Omics, Bioprocess
Layer 2: AUTH & TENANCY  Multi-tenant, RBAC, SSO, MFA, API Keys
Layer 1: DATA & PERSIST  Drizzle ORM, Migrations, File Storage, Polyglot DB
Layer 0: INFRASTRUCTURE  CI/CD, Monitoring, Security, Multi-region Deploy
```

---

## 4. Branch 1 — Infrastructure Foundation

### 4.1 Deployment & Hosting

**Problem:** Vercel Hobby free tier with ephemeral `/tmp`, no GPU workers for heavy computation.

**Solution:** Vercel Pro + persistent Turso + Fly.io GPU workers.

**Tech Stack:** Vercel Pro ($20/mo), Turso (persistent libSQL), Fly.io Machines (GPU), Modal/Lambda (inference)

**Steps:**
1. Upgrade to Vercel Pro → persistent serverless, team features, analytics
2. Configure Turso with persistent storage (not ephemeral /tmp)
3. Add Fly.io Machines for compute-heavy tasks (FBA, GP, UMAP) — deploy a Node.js worker that accepts jobs via HTTP and returns results
4. Add GPU endpoint for ESM-2/AlphaFold3 inference via Modal or Lambda

### 4.2 Database Architecture

**Problem:** Raw SQL via libSQL, CREATE TABLE IF NOT EXISTS, no migrations, no typed queries.

**Solution:** Drizzle ORM + typed schema + versioned migrations + polyglot persistence.

**Tech Stack:** Drizzle ORM, drizzle-kit, Turso/libSQL, Upstash Redis, Cloudflare R2, ClickHouse (optional)

**Steps:**
1. Install Drizzle ORM with Turso adapter (`drizzle-orm`, `drizzle-kit`)
2. Define all tables as Drizzle schema files in `src/server/db/schema/`
3. Generate initial migration from existing schema
4. Create seed scripts for reference data (iJO1366, precomputed DG, codon tables)
5. Replace raw SQL in `workbenchDb.ts` with Drizzle queries
6. Add Redis for session caching and pub/sub
7. Add Cloudflare R2 for file storage (FASTA, GenBank, PDB, h5ad)

### 4.3 CI/CD Pipeline

**Problem:** Only typecheck + test + build. No lint, no format check, no bundle analysis.

**Solution:** Full pipeline with Biome, bundle analysis, Lighthouse CI, security audit.

**Tech Stack:** Biome (lint+format), @next/bundle-analyzer, Lighthouse CI, Snyk/Socket

**Steps:**
1. Install Biome (`@biomejs/biome`) — replaces ESLint + Prettier in one tool
2. Add `biome check` to CI pipeline
3. Add bundle size tracking (already have @next/bundle-analyzer)
4. Add Lighthouse CI for performance/accessibility scores
5. Add Snyk or Socket.dev for dependency vulnerability scanning
6. Add visual regression testing with Chromatic or Percy

### 4.4 Monitoring & Observability

**Problem:** Minimal Sentry config, no structured logging, no custom metrics.

**Solution:** Full observability stack.

**Tech Stack:** Sentry (full config), Pino (structured logging), Vercel Analytics, BetterUptime

**Steps:**
1. Configure Sentry properly (source maps, release tracking, user context)
2. Add Pino for structured JSON logging
3. Add custom metrics: API latency, solver time, AI token usage
4. Set up alerting (PagerDuty or Opsgenie for critical errors)
5. Add uptime monitoring (BetterUptime or Checkly)

### 4.5 Security Infrastructure

**Problem:** Basic CSP and rate limiting. No WAF, no dependency scanning, no SAST.

**Solution:** Enterprise security posture.

**Tech Stack:** Cloudflare WAF, CodeQL/Semgrep, Socket.dev

**Steps:**
1. Add dependency scanning to CI (Socket.dev or Snyk)
2. Add SAST (CodeQL or Semgrep) to CI
3. Configure WAF rules (Cloudflare or Vercel Firewall)
4. Implement secrets rotation policy
5. Schedule annual penetration testing

---

## 5. Branch 2 — Authentication & Multi-Tenancy

### 5.1 Auth System

**Problem:** Auth.js v5 beta (unstable), only GitHub/Google OAuth, no email login, no MFA, no per-user API keys.

**Solution:** Stable Auth.js + email magic link + API keys + MFA + WebAuthn.

**Tech Stack:** Auth.js v5 stable, SendGrid/Resend (email), otplib (TOTP), @simplewebauthn/server (WebAuthn), nanoid (API keys)

**Steps:**
1. Upgrade Auth.js from beta to stable release
2. Add email magic link provider (Resend API — `resend` npm package)
3. Implement per-user API key system:
   - Schema: `api_keys` table (id, user_id, name, key_hash, scopes, expires_at, last_used_at)
   - Generate: `nanoid(32)` prefixed with `nxb_`
   - Validate: hash with SHA-256, compare against stored hash
   - Scope: read, write, admin (configurable per key)
4. Add MFA support (TOTP via `otplib`, backup codes)
5. Add WebAuthn/Passkeys (`@simplewebauthn/server` + `@simplewebauthn/browser`)
6. Build session management UI (active sessions, device list, revoke)

### 5.2 Multi-Tenancy & RBAC

**Problem:** Single-user mode. Actors table exists but unused. No org/team hierarchy.

**Solution:** Organization → Team → Project hierarchy with RBAC.

**Tech Stack:** Drizzle ORM schema, CASL or custom RBAC middleware

**Steps:**
1. Design org/team schema:
   - `organizations` (id, name, slug, plan, billing_email)
   - `org_members` (org_id, user_id, role)
   - `teams` (id, org_id, name)
   - `team_members` (team_id, user_id, role)
2. Implement RBAC roles: Owner, Admin, Editor, Viewer, API-only
3. Add resource-level permission checks (middleware validates project access)
4. Build invite system (email invite, share link, SSO auto-join)
5. Implement audit log per actor
6. Add row-level security in all database queries

### 5.3 User Profiles & Identity

**Problem:** Basic profile only. No ORCID, no lab affiliation, no activity dashboard.

**Solution:** Rich research identity with ORCID integration.

**Tech Stack:** ORCID API, Drizzle schema

**Steps:**
1. Extend user profile schema (expertise tags, bio, avatar, social links)
2. Integrate ORCID API (fetch publications, grants)
3. Add lab/group affiliation system
4. Build user activity dashboard (recent projects, tool usage stats)
5. Create public profile page (optional, for collaboration discovery)

---

## 6. Branch 3 — Data Layer & Persistence

### 6.1 Schema & Migrations

**Problem:** Programmatic CREATE TABLE IF NOT EXISTS. No migration tool. No typed queries.

**Solution:** Drizzle ORM with typed schema, versioned migrations, seed scripts.

**Tech Stack:** Drizzle ORM, drizzle-kit, TypeScript

**Steps:**
1. Install Drizzle ORM with Turso adapter
2. Define all existing tables as Drizzle schema files
3. Generate initial migration
4. Create seed scripts for reference data
5. Add migration runner to app startup
6. Replace all raw SQL with Drizzle queries
7. Add schema documentation (auto-generated ERD)

### 6.2 Core Schema (Target)

Complete schema for the OS platform:

```
users, organizations, org_members, projects, project_members,
experiments, experiment_artifacts, sequences, inventory_items,
audit_log, api_keys, notifications, webhooks,
pm_tasks, pm_milestones, pm_templates,
wiki_pages, wiki_revisions, protocols,
literature_entries, decision_log,
chat_messages, comment_threads, comment_replies,
ml_models, ml_experiments,
plugins, plugin_installations, plugin_versions
```

### 6.3 File & Blob Storage

**Problem:** No file storage. All data in JSON blobs.

**Solution:** S3-compatible object storage with pre-signed URLs.

**Tech Stack:** Cloudflare R2 (S3-compatible, free egress), AWS SDK S3 client

**Steps:**
1. Set up Cloudflare R2 bucket
2. Implement upload API route with pre-signed URLs
3. Add file type validation (FASTA, GenBank, SBOL, h5ad, PDB, CSV, PDF)
4. Implement file versioning (content-addressed, immutable)
5. Build file browser UI component

### 6.4 Data Import/Export

**Problem:** Only CSV import and JSON export.

**Solution:** Universal data bridge.

**Tech Stack:** Papa Parse (CSV), SheetJS (Excel), genbank-parser, custom SBOL/SBML parsers

**Steps:**
1. Implement format auto-detection on upload
2. Add parsers: GenBank, FASTA, SBML, SBOL, Excel
3. Build drag-and-drop upload component
4. Implement export: CSV, PDF report, SBML, SBOL, Jupyter notebook
5. Add batch import (zip of files)

---

## 7. Branch 4 — Scientific Computing Core

### 7.1 Metabolic Modeling (FBA Family)

**Problem:** Community FBA is heuristic, only iJO1366 subset (~83 reactions), no custom model upload.

**Solution:** Production metabolic modeling with full models.

**Tech Stack:** HiGHS WASM (existing), BiGG API, SBML parser

**Steps:**
1. Implement real SteadyCom algorithm (iterative LP for community FBA)
2. Add Ensemble FBA (flux sampling via warm-starting)
3. Add Geometric FBA (unique flux distribution)
4. Expand to full iJO1366 (1366 reactions) and iML1515
5. Implement SBML model upload and parsing
6. Add model validation (mass/charge balance checks)
7. Build Escher-style interactive flux map visualization

### 7.2 Kinetics & Dynamics

**Problem:** MCMC and sensitivity engines exist but aren't integrated into UI.

**Solution:** Full kinetic modeling pipeline.

**Tech Stack:** Existing engines (kineticsEngine, mcmcCalibration, sensitivityAnalysis)

**Steps:**
1. Integrate MCMC parameter estimation into kinetics UI
2. Add sensitivity analysis dashboard (tornado plots)
3. Implement ensemble kinetic models (sample parameter posteriors)
4. Add SBML kinetic model import/export
5. Implement multi-compartment models
6. Add real-time simulation with WebSocket streaming

### 7.3 Protein Engineering

**Problem:** No RFdiffusion, no ProteinMPNN, no AlphaFold3, no molecular dynamics.

**Solution:** Full protein design pipeline.

**Tech Stack:** ESM-2/ESMFold (existing), ColabFold API (existing), RFdiffusion API, ProteinMPNN API, OpenMM

**Steps:**
1. Integrate RFdiffusion for de novo protein design
2. Add ProteinMPNN for sequence design from backbone
3. Enhance AlphaFold3 integration (multi-chain, nucleic acids)
4. Add Rosetta energy calculations
5. Integrate OpenMM molecular dynamics (Python sidecar)
6. Enhance ProEvol directed evolution campaigns
7. Add protein design → wet lab protocol automation

### 7.4 Genetic Design

**Problem:** No visual circuit editor, limited assembly simulation, no vector database.

**Solution:** Complete genetic design suite.

**Tech Stack:** React Flow (circuit editor), SBOL 3.0 (existing), REBASE (restriction enzymes)

**Steps:**
1. Build visual circuit editor (drag-and-drop via React Flow)
2. Add SBOL 3.0 import/export
3. Implement restriction enzyme digests (REBASE database)
4. Add Golden Gate assembly simulation
5. Add Gateway cloning simulation
6. Build vector database (common plasmids: pUC19, pET, pBR322)
7. Enhance CRISPR library design

### 7.5 Multi-Omics & Single-Cell

**Problem:** No Scanpy integration, no trajectory inference, no differential expression.

**Solution:** Full omics analysis platform.

**Tech Stack:** Scanpy/anndata (Python sidecar), existing engines (UMAP, MOFA+)

**Steps:**
1. Integrate Scanpy via Python sidecar
2. Add trajectory inference (PAGA, diffusion pseudotime)
3. Implement cell type annotation (CellTypist)
4. Add differential expression (Wilcoxon, DESeq2)
5. Add pathway enrichment (GSEA, ORA)
6. Implement multi-sample batch correction (Harmony)

### 7.6 Bioprocess Engineering

**Problem:** DynCon has simulation but no real data integration, no scale-up predictions.

**Solution:** Bioprocess optimization platform.

**Tech Stack:** Existing engines (MPC, digital twin), MQTT for sensor data

**Steps:**
1. Add fed-batch and continuous culture models
2. Implement scale-up prediction algorithms
3. Build real-time sensor data ingestion (MQTT/HTTP)
4. Add media optimization (DOE, response surface)
5. Implement economic modeling (cost per gram)

---

## 8. Branch 5 — Sequence & Genetic Design Editor

### 8.1 Sequence Editor UI

**Problem:** No sequence editor exists. This is the biggest missing piece.

**Solution:** Build a Benchling-class sequence editor.

**Tech Stack:** Custom Canvas/SVG renderer, React, TypeScript

**Steps:**
1. Design sequence data model (features, annotations, primers, cutsites)
2. Build linear sequence viewer (scrollable, zoomable Canvas renderer)
3. Add feature annotations (CDS, promoter, RBS, terminator with color coding)
4. Add restriction enzyme site display
5. Build circular plasmid map view (SVG with interactive features)
6. Add primer binding site visualization
7. Implement 6-frame translation view
8. Add search (sequence, feature name, annotation)
9. Implement undo/redo, copy/paste, selection

### 8.2 Sequence Formats

**Problem:** Only SBOL 3.0 serializer and PDB parser.

**Solution:** Full format support with auto-detection.

**Tech Stack:** genbank-parser (npm), bioseq, custom SBOL parser

**Steps:**
1. Implement GenBank parser (.gb, .gbk)
2. Implement FASTA parser (.fa, .fna, .faa)
3. Enhance SBOL 2.0/3.0 import
4. Add SBML import for metabolic models
5. Implement SnapGene (.dna) parser
6. Add format auto-detection on upload
7. Implement export to all supported formats

### 8.3 In-Silico Cloning

**Problem:** Only Gibson assembly planner exists.

**Solution:** Full cloning simulation with visual workflow.

**Tech Stack:** Existing engines (assembly-planner, grnaDesigner), REBASE database

**Steps:**
1. Build interactive cloning workflow UI (step-by-step wizard)
2. Implement restriction enzyme digests (REBASE database)
3. Enhance Gibson/HiFi assembly simulation
4. Add Golden Gate assembly (BsaI, BpiI)
5. Add Gateway cloning (att sites)
6. Implement In-Fusion cloning simulation
7. Add CRISPR-based editing simulation (HDR/NHEJ outcomes)
8. Build agarose gel electrophoresis simulation

---

## 9. Branch 6 — Inventory & Resource Management

### 9.1 Biological Inventory

**Problem:** No inventory system exists. Labs track materials in spreadsheets.

**Solution:** Full lab inventory with cross-entity linking and physical labeling.

**Tech Stack:** Drizzle ORM schema, React UI, jsbarcode, qrcode.react

**Steps:**
1. Design inventory schema:
   - `inventory_strains` (id, name, genotype, species, source, freezer_location_id, aliquot_count, resistance_markers)
   - `inventory_plasmids` (id, name, backbone, insert_sequence, resistance, linked_pathway_node, addgene_id)
   - `inventory_primers` (id, name, sequence_5to3, tm_celsius, gc_percent, target_gene, vendor)
   - `inventory_chemicals` (id, name, cas_number, vendor, lot_number, expiry_date, hazard_class, sds_url)
   - `inventory_media_recipes` (id, name, type, components, ph_target, autoclave_settings)
2. Implement strain tracking UI (table + detail view + linked plasmids)
3. Implement plasmid tracking UI (with "Import from design" button linking to pathway nodes)
4. Implement primer tracking UI (auto-calculate Tm via nearest-neighbor method, bulk CSV import)
5. Add chemical inventory UI (auto-fetch metadata from PubChem, expiry color-coding)
6. Build media recipe management ("Check stock" button against chemical inventory)
7. Add barcode/QR code generation (jsbarcode + qrcode.react, Avery 5160 label layout)
8. Build unified search across all inventory types

### 9.2 Location & Storage Tracking

**Problem:** No hierarchical location system.

**Solution:** Visual location management with move history.

**Tech Stack:** React, custom SVG grid visualizer

**Steps:**
1. Design location hierarchy schema (building → room → freezer → shelf → box → position)
2. Build visual box map component (SVG grid, color-coded by entity type, drag-and-drop)
3. Add capacity tracking and alerts (progress bars, temperature monitoring)
4. Implement move history audit trail
5. Add temperature monitoring integration (IoT sensor data or manual logging)

### 9.3 Vendor & Order Integration

**Problem:** No procurement workflow.

**Solution:** Integrated procurement with vendor catalog search.

**Tech Stack:** Addgene API, IDT API, Thermo Fisher API

**Steps:**
1. Integrate Addgene plasmid search API
2. Integrate IDT oligo ordering API
3. Build shopping cart → PO → receiving workflow
4. Add price comparison across vendors
5. Implement automatic inventory update on receiving

---

## 10. Branch 7 — Collaboration & Project Management

### 10.1 Real-Time Collaboration

**Problem:** Polling-based sync, no real-time updates, no cursor presence, no chat.

**Solution:** Google Docs-level real-time collaboration.

**Tech Stack:** Socket.io (WebSocket), Yjs (CRDT), y-websocket, y-indexeddb

**Steps:**
1. Set up WebSocket server (custom Next.js server with Socket.io)
2. Integrate Yjs for CRDT-based conflict resolution on workbench state
3. Implement cursor presence (colored cursors with user names)
4. Add real-time chat per project (persisted to DB, markdown support)
5. Build comment system (comments on any entity, threaded replies)
6. Add @mentions with notification delivery
7. Implement offline support (y-indexeddb for offline persistence)

### 10.2 Project Management

**Problem:** No task management, no kanban, no timeline, no templates.

**Solution:** Integrated research project management.

**Tech Stack:** @dnd-kit/sortable (kanban drag-drop), React, Drizzle schema

**Steps:**
1. Design project management schema (pm_tasks, pm_milestones, pm_templates, pm_task_dependencies)
2. Build kanban board (5 columns: backlog, in_progress, review, done, blocked)
3. Add Gantt/timeline view (SVG-based, task bars, milestone diamonds, dependency arrows)
4. Implement task assignment with due dates and notifications
5. Build experiment template system (reusable, fork-able templates)
6. Add milestone tracking with deliverables
7. Build project dashboard (progress donut, activity feed, upcoming deadlines, bottleneck identification)

### 10.3 Knowledge Management

**Problem:** No lab wiki, no protocol library, no literature database, no decision log.

**Solution:** Institutional knowledge system with AI-powered search.

**Tech Stack:** Tiptap/ProseMirror (rich text), SQLite FTS5 (full-text search), Upstash Vector (embeddings)

**Steps:**
1. Build lab wiki system (Tiptap editor, versioned, Yjs co-editing, diff view)
2. Create protocol library (shared, versioned, fork-able, with reagent links to inventory)
3. Implement literature database (DOI lookup via CrossRef, PubMed search, annotations)
4. Add decision log (context, options, decision, rationale, outcome)
5. Implement full-text search across all project data (FTS5 virtual tables)
6. Add AI-powered Q&A over lab knowledge (RAG via Upstash Vector embeddings)

### 10.4 Sharing & Permissions

**Problem:** Basic project scoping only. No share links, no public projects, no forking.

**Solution:** Flexible sharing model.

**Tech Stack:** nanoid (share links), Drizzle schema

**Steps:**
1. Implement project visibility settings (private, unlisted, public)
2. Add share links (view/edit with optional expiry)
3. Build public project gallery (discoverable projects)
4. Implement project forking (clone with full history)
5. Add embed support (iframe embedding for public projects)
6. Build project export as archive (ZIP with all data, formats, metadata)

---

## 11. Branch 8 — AI/ML Platform

### 11.1 Axon Agent System

**Problem:** Single-shot planning, no tool composition, no self-correction, no learning.

**Solution:** Autonomous research agent with multi-step workflows.

**Tech Stack:** Existing Axon system, Groq/Gemini APIs, Zod (structured output)

**Steps:**
1. Implement multi-step planning engine (DAG of sub-tasks, topological execution)
2. Add tool composition (pre-built composite adapters: designAndSimulate, designAndEvolve, fullDBTLCycle, multiOmicsAnalysis)
3. Implement self-correction (classify failures, suggest parameter modifications, retry up to 3x)
4. Add literature-grounded reasoning (cite papers for every design decision)
5. Build experiment suggestion engine (propose follow-up experiments based on results)
6. Implement learning from feedback (record plan modifications as few-shot examples)

### 11.2 Model Infrastructure

**Problem:** No caching, no token budgeting, no embeddings store, no prompt versioning.

**Solution:** Production AI infrastructure.

**Tech Stack:** Upstash Redis (caching), @upstash/vector (embeddings), Vercel AI SDK

**Steps:**
1. Build model router (task complexity → best model, cost/quality tradeoff)
2. Implement response caching (semantic dedup via embeddings in Redis)
3. Add token budget management per user/org (daily limits per tier)
4. Set up embedding store (Upstash Vector for RAG)
5. Implement A/B testing framework for prompts (chi-squared significance)
6. Add AI observability dashboard (latency, tokens, errors, cache hit rate)

### 11.3 Domain-Specific ML

**Problem:** No pre-trained models, no model versioning, no experiment tracking.

**Solution:** ML model zoo with ONNX serving.

**Tech Stack:** ONNX Runtime (existing), Python sidecar for training

**Steps:**
1. Train yield prediction model (gradient boosted trees, from published data)
2. Train expression level prediction model (1D CNN, from RBS Calculator data)
3. Build enzyme activity prediction (ESM-2 embeddings + Morgan fingerprints → feedforward NN)
4. Implement metabolic flux prediction from expression data (physics-informed NN)
5. Add toxicity prediction from SMILES (random forest, ChEMBL data)
6. Set up model versioning (ml_models table, MLflow integration)
7. Build model serving (ONNX Runtime Web for browser, onnxruntime-node for server)

### 11.4 Natural Language Interface

**Problem:** Single-turn queries only, no conversation context, no voice, no multilingual.

**Solution:** Research copilot with multi-turn conversation.

**Tech Stack:** Groq/Gemini, Whisper API (voice), next-intl (i18n), react-speech-recognition

**Steps:**
1. Implement multi-turn conversation with project context persistence
2. Add conversation memory (summarize old messages, keep relevant context)
3. Build "Design a pathway for X" → automated workflow pipeline
4. Add "Why is my FBA infeasible?" → diagnosis + fix suggestions
5. Integrate Whisper API for voice input (Groq hosts whisper-large-v3)
6. Add multilingual support (EN, ZH, JA via next-intl)
7. Implement conversation export as PDF report

---

## 12. Branch 9 — Lab Integration & LIMS

### 12.1 Protocol Generation

**Problem:** Only Opentrons protocol generator. No multi-platform support, no templates.

**Solution:** Universal protocol system with multi-platform export.

**Tech Stack:** Existing protocol-generator, Hamilton/Tecan script generators

**Steps:**
1. Enhance Opentrons generator (OT-2 + OT-3/Flex support)
2. Add Hamilton STAR script generator (.med XML, .lay labware, .wlk worklist)
3. Add Tecan Fluent script generator (.gwl worklist format)
4. Build manual protocol generator (human-readable PDF/HTML with timings, reagent volumes)
5. Create protocol template library (10 pre-built: Golden Gate, Gibson, transformation, expression, purification, etc.)
6. Add protocol versioning and sharing

### 12.2 LIMS Integration

**Problem:** No LIMS integration. Manual data transfer between Nexus-Bio and ELN.

**Solution:** Bidirectional LIMS bridge + built-in ELN.

**Tech Stack:** Benchling API v2, LabArchives API, RSpace API, generic REST adapter

**Steps:**
1. Build Benchling API integration (sequences, plates, assay results)
2. Add LabArchives integration (notebook pages, entries)
3. Add RSpace integration (documents, files)
4. Build generic LIMS REST API adapter (user-configurable endpoint/field mappings)
5. Implement ELN features (Tiptap rich text, attachments, signature workflow)
6. Add sample tracking with barcode scan → inventory update (@zxing/library)

### 12.3 Instrument Interfaces

**Problem:** All instrument data must be manually entered.

**Solution:** Automated instrument data pipeline with format-specific parsers.

**Tech Stack:** Custom parsers (FCS, mzML, FASTQ, plate reader formats), Python sidecar

**Steps:**
1. Plate reader import (BMG CLARIOstar, Tecan Infinite, Molecular Devices SpectraMax)
2. Flow cytometry parser (FCS 2.0/3.0 format)
3. Sequencing data parser (FASTQ, SAM/BAM — stream-parse for large files)
4. Mass spectrometry parser (mzML XML, base64-encoded spectra)
5. HPLC/FPLC chromatography parser (Agilent .ch, generic CSV)
6. Microscopy image import (TIFF, OME-TIFF via utif)
7. Data normalization and QC pipeline (blank subtraction, outlier detection, batch correction)

### 12.4 Wet Lab → Dry Lab Feedback

**Problem:** Feedback loop is manual (CSV import).

**Solution:** Automated data ingestion with model calibration.

**Tech Stack:** Existing closed-loop DBTL engine, instrument parsers, WebSocket

**Steps:**
1. Build automated data ingestion pipeline (poll instrument outputs, auto-parse, auto-link to experiments)
2. Enhance QC pipeline (isolation forest outlier detection, reference standard normalization)
3. Implement model calibration (MCMC fit kinetic params to new data, adjust FBA bounds)
4. Build automated next-iteration suggestion engine
5. Implement digital twin update (sync model predictions with experimental reality)

---

## 13. Branch 10 — Compliance & Audit

### 13.1 Audit Trail

**Problem:** sync_audit tracks only workbench sync. No immutable log, no electronic signatures.

**Solution:** GxP-ready immutable audit system.

**Tech Stack:** Drizzle schema, Node.js crypto (SHA-256)

**Steps:**
1. Design immutable audit log schema (append-only, hash-chained, SQLite triggers prevent UPDATE/DELETE)
2. Implement actor identification (who, when, what, why, IP address)
3. Add data integrity checks (SHA-256 hash chain verification, daily cron)
4. Implement electronic signatures (21 CFR Part 11: password re-entry, meaning, content hash)
5. Build audit trail export (CSV, PDF with chain integrity status)
6. Add retention policy enforcement (7-year minimum, configurable)

### 13.2 Data Governance

**Problem:** No data classification, no retention policies, no GDPR compliance.

**Solution:** Enterprise data governance framework.

**Tech Stack:** Drizzle schema, S3 lifecycle policies

**Steps:**
1. Implement data classification (public, internal, confidential, restricted)
2. Add retention policies per data type (configurable per org)
3. Implement right to deletion (GDPR Article 17 — anonymize audit logs, delete personal data)
4. Add data export (GDPR data portability — ZIP with all user data)
5. Implement cross-border data transfer controls (data_region tagging)
6. Set up backup and disaster recovery (daily SQLite VACUUM INTO, restore testing)

### 13.3 Regulatory Compliance

**Problem:** No compliance framework.

**Solution:** Compliance-ready platform.

**Tech Stack:** Compliance automation tools, DNA screening APIs

**Steps:**
1. 21 CFR Part 11 controls (electronic records, signatures, access controls, audit trails)
2. ISO 27001 preparation (access control policy, incident response, risk register)
3. GDPR compliance tools (consent management, data processing records, DPIA templates)
4. SOC 2 Type II readiness (security, availability, processing integrity, confidentiality, privacy)
5. Biosecurity screening (screen DNA orders against CDC select agent list, iGEM SAFE API)
6. Dual-use research oversight flags (keyword classification, review workflow)

---

## 14. Branch 11 — API & Extensibility

### 14.1 Public REST/GraphQL API

**Problem:** Internal API routes only. No docs, no versioning, no SDK.

**Solution:** Developer platform with documented, versioned API.

**Tech Stack:** swagger-jsdoc (OpenAPI 3.1), @scalar/api-reference (docs UI), graphql-yoga (optional)

**Steps:**
1. Add OpenAPI 3.1 annotations to all API routes
2. Generate interactive API documentation (Scalar UI at /docs/api)
3. Implement API versioning (/api/v1/ prefix, deprecation notices)
4. Build REST endpoints for all 14 tools (currently only FBA and pipeline have dedicated routes)
5. Add GraphQL gateway (optional — for complex cross-tool queries)
6. Implement webhook system (experiment complete, milestone reached, task assigned)
7. Build Python SDK (httpx client, Pydantic models, publish to PyPI)
8. Build JavaScript SDK (TypeScript, fetch-based, publish to npm)
9. Build R SDK (httr2 client, publish to CRAN)

### 14.2 Plugin System

**Problem:** No custom tool registration, no sandboxing, no marketplace.

**Solution:** Extensible platform with WASM sandbox.

**Tech Stack:** wasmtime-js or isolated-vm (sandboxing), Zod (manifest validation)

**Steps:**
1. Design plugin manifest schema (Zod: name, version, inputs, outputs, UI, engine config)
2. Implement custom tool registration via API
3. Build WASM sandbox (no filesystem, no network, memory/time limits)
4. Add plugin versioning and dependency management
5. Build plugin marketplace UI (browse, install, configure, rate)
6. Implement plugin testing framework

### 14.3 Integration Ecosystem

**Problem:** Only internal database clients. No third-party integrations.

**Solution:** Rich integration ecosystem.

**Tech Stack:** GitHub API, Slack/Discord webhooks, Jira/Linear APIs, Zapier, n8n

**Steps:**
1. GitHub integration (export designs as SBOL/SBML, sync experiments, create issues)
2. Slack/Discord notification webhooks (experiment complete, milestone, alerts)
3. Jira/Linear issue linking (two-way sync)
4. Google Drive/Dropbox file sync (export/import)
5. Zapier integration (triggers + actions)
6. n8n self-hosted workflow automation (custom node package)

---

## 15. Branch 12 — UI/UX Excellence

### 15.1 Design System

**Problem:** Tokens and shared components exist but not formalized. No Storybook, no a11y audit, no i18n.

**Solution:** Production design system.

**Tech Stack:** Storybook 8, axe-core, next-intl, Tailwind CSS

**Steps:**
1. Set up Storybook 8 with a11y addon
2. Formalize design tokens (complete color ramps, radius, shadow, animation scales)
3. Document component variants (size, color, state for all 20+ shared components)
4. Audit WCAG 2.1 AA compliance (color contrast, focus indicators, form labels, ARIA)
5. Implement responsive design (mobile, tablet, desktop breakpoints)
6. Add keyboard navigation (full app navigable without mouse, Cmd+K search, shortcuts)
7. Set up next-intl for i18n (EN, ZH, JA)

### 15.2 Visualization Standards

**Problem:** No unified framework, no genome browser, no phylogenetic viewer, no pub-quality export.

**Solution:** Best-in-class bio-visualization suite.

**Tech Stack:** d3.js 7, IGV.js, Cytoscape.js, Mol*, existing Three.js/Recharts

**Steps:**
1. Escher-style interactive metabolic flux map (d3.js, Bezier edges, subsystem rects)
2. IGV.js genome browser (gene tracks, CRISPR targets, knockout markers)
3. Phylogenetic tree viewer (d3.js, rectangular phylogram, collapsible clades)
4. Cytoscape.js network visualization (pathways, citations, gene regulation)
5. Mol* molecular viewer (electron density, MD trajectories)
6. Clustered heatmap (d3.js, hierarchical clustering, viridis scale)
7. Publication-quality export (SVG, PNG 300 DPI, PDF with journal dimensions)

### 15.3 Onboarding & Help

**Problem:** No guided tour, no templates, no contextual help, no feedback.

**Solution:** Guided experience.

**Tech Stack:** Shepherd.js (guided tours), html2canvas (screenshots)

**Steps:**
1. Build interactive onboarding tour (Shepherd.js, 6-step walkthrough)
2. Add contextual help tooltips ("What's this?" mode)
3. Create template projects (Artemisinin, E. coli FBA, Gene Circuit)
4. Build changelog / what's new modal
5. Add feedback widget (bug report, feature request, screenshot capture)

### 15.4 Performance

**Problem:** No code splitting per tool, no service worker, no virtual scrolling, heavy computation on main thread.

**Solution:** Sub-second interactions.

**Tech Stack:** Next.js dynamic imports, Workbox (service worker), react-window, Web Workers

**Steps:**
1. Code splitting per tool page (Next.js dynamic() — 60-70% bundle reduction)
2. Service worker for offline support (Workbox — cache-first for shell, stale-while-revalidate for static data)
3. Virtual scrolling for large datasets (react-window — FBA reactions, omics genes, ScSpatial cells)
4. Web Workers for heavy computation (FBA solver, UMAP, GP — via postMessage)
5. Progressive loading (skeleton → placeholder → data with fade-in)
6. Image optimization (AVIF/WebP, responsive srcset, lazy loading)

---

## 16. Branch 13 — Business & Growth

### 16.1 Pricing & Billing

**Problem:** Free tier only. No billing, no usage tracking.

**Solution:** SaaS model with Stripe.

**Tech Stack:** Stripe Billing, Stripe Customer Portal

**Tiers:**

| Tier | Price | Included | Limits |
|------|-------|----------|--------|
| Free | $0/mo | 3 projects, 100 AI queries/day, 50 FBA/day | No collab, no API |
| Pro | $29/mo | Unlimited projects, 1000 AI/day, 500 FBA/day | 1 seat, API access |
| Team | $99/seat/mo | Everything + RBAC, audit, collab, 100GB/seat | Min 2 seats, SSO |
| Enterprise | Custom | Everything + SLA, custom integrations, on-prem | Contact sales |

**Steps:**
1. Integrate Stripe Billing (subscriptions + usage-based metered billing)
2. Build Stripe Customer Portal (self-service plan changes, invoices)
3. Implement usage tracking per user/org (AI queries, FBA runs, storage)
4. Add billing dashboard (current plan, usage meters, invoices)
5. Implement usage-based overages ($0.005/AI query, $0.01/FBA run, $0.10/GB/month)

### 16.2 Analytics & Growth

**Problem:** No product analytics, no feature flags, no A/B testing.

**Solution:** Data-driven growth with PostHog.

**Tech Stack:** posthog-js (client), posthog-node (server)

**Steps:**
1. Set up PostHog (custom events: tool_opened, experiment_created, fba_run, ai_query)
2. Implement feature flags (gradual rollout, kill switches)
3. Add A/B testing (onboarding flow, pricing page)
4. Build funnel analysis (signup → first project → first experiment → retention)
5. Implement cohort analysis (retention by signup date, plan, acquisition channel)
6. Add NPS surveys (in-app, periodic)

### 16.3 Community & Ecosystem

**Problem:** Only GitHub repo and email. No docs site, no forum, no templates.

**Solution:** Thriving ecosystem.

**Tech Stack:** Nextra 3 (docs), Discord/MDX

**Steps:**
1. Build documentation site (Nextra at docs.nexus-bio.vercel.app)
2. Set up community forum (Discord server initially, migrate to Discourse at 500+ members)
3. Create template library (community-contributed, fork-able, rated)
4. Establish academic partnerships (free Team tier for .edu, iGEM sponsorship)
5. Define open-source strategy (open core: engines open, Axon/collab/enterprise proprietary)
6. Write developer documentation (API reference, SDK tutorials, plugin guide)

### 16.4 Go-to-Market

**Problem:** No landing page, no marketing, no launch strategy.

**Solution:** Launch strategy.

**Steps:**
1. Build conversion-optimized landing page (separate from app, /marketing/ route group)
2. Plan Product Hunt launch (Tuesday/Wednesday, 12:01 AM PST, 60s video demo)
3. Prepare academic conference demos (SynBioBeta, iGEM Jamboree, ACS SynBio)
4. Start content marketing (blog: origin story, FBA tutorial, enzyme design deep dive)
5. Implement referral program ($5 credit per successful referral)
6. Establish partnerships (Ginkgo, Twist, Benchling, TeselaGen)

---

## 17. Priority Matrix

| Phase | Branches | Timeline | Goal |
|-------|----------|----------|------|
| **P0: Foundation** | Infrastructure, Auth, Data Layer | Month 1-2 | Production-ready platform |
| **P1: Core Value** | Collaboration, API, Sequence Editor | Month 3-4 | Multi-user platform with open API |
| **P2: Domain Depth** | Scientific Core, AI/ML, Inventory | Month 5-7 | Best-in-class computational tools |
| **P3: Enterprise** | Lab Integration, Compliance, UI/UX | Month 8-10 | Enterprise-ready platform |
| **P4: Growth** | Business, Community, Go-to-Market | Month 11-12 | Launch and scale |

---

## 18. Cross-Cutting Concerns

### Dependencies Between Branches
- **Data Layer (3)** must come before everything (schema foundation)
- **Auth (2)** must come before Collaboration (7) and API (11)
- **Infrastructure (1)** must come before Production deployment
- **Inventory (6)** depends on Data Layer (3) schema
- **LIMS (9.2)** depends on Inventory (6) and Auth (2)
- **Compliance (10)** depends on Audit Trail (10.1) and Auth (2)
- **Billing (13.1)** depends on Auth (2) and usage tracking from AI/ML (8.2)

### Shared Infrastructure
- Drizzle ORM schema (used by all branches)
- WebSocket server (used by Collaboration, Copilot, real-time simulation)
- Audit middleware (used by all API routes)
- RBAC middleware (used by all protected routes)
- File storage (used by Inventory, Sequence Editor, LIMS, Export)

---

*End of specification. Each branch can be independently scoped into a detailed implementation plan via `/superpowers:writing-plans`.*
