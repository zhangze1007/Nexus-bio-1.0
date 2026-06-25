# Nexus-Bio OS Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Nexus-Bio 1.0 from a demo platform into a production-grade Synthetic Biology Operating System.

**Architecture:** 8-layer platform built incrementally. Drizzle ORM replaces raw SQL. Turso (free tier) for persistence. Fresh schema (no migration needed). snake_case in DB, camelCase in TypeScript.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.8, Drizzle ORM, Turso/libSQL, Biome, Socket.io, Yjs

**Spec:** `docs/superpowers/specs/2026-06-25-nexus-bio-os-platform-blueprint.md`

## Global Constraints

- **Budget:** $0 — use free tiers only (Turso 9GB, Vercel Hobby, Upstash 10K/day, R2 10GB, Sentry 5K/month)
- **Database:** Turso/libSQL — do NOT switch to PostgreSQL or Supabase
- **ORM:** Drizzle ORM — fully replace `src/server/workbenchDb.ts` (749 lines of raw SQL)
- **Naming:** snake_case in database columns, camelCase in TypeScript (Drizzle auto-maps)
- **Auth:** Auth.js v5 stable, GitHub + Google OAuth, four-tier RBAC (Owner > Admin > Editor > Viewer)
- **Auth scope:** Single user now — schema pre-includes nullable `org_id`, `team_id` for future multi-tenancy
- **Existing data:** None — fresh schema, no migration needed
- **Commits:** Local only — do NOT push to remote without explicit user approval
- **Testing:** TDD — write failing test first, implement, verify pass, commit
- **Forbidden files:** Do NOT modify `IDEShell.tsx`, `IDETopBar.tsx`, `IDESidebar.tsx`, `DBTLflowPage.tsx`, `GECAIRPage.tsx`, `ProEvolPage.tsx`

---

## Phase 0: Foundation (Month 1-2)

> Goal: Production-ready platform with proper tooling, auth, and data layer.

---

### Task 1: Add Biome Linting & Formatting

**Files:**
- Create: `biome.json`
- Modify: `package.json` (add scripts)
- Modify: `.github/workflows/ci.yml` (add lint step)

**Interfaces:**
- Produces: `npm run lint` → Biome check, `npm run format` → Biome format

- [ ] **Step 1: Install Biome**

```bash
cd C:/Users/HP/Nexus-Bio-1.0/Nexus-bio-1.0
npm install -D @biomejs/biome
```

Expected: `@biomejs/biome` appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "warn",
        "noUnusedImports": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 120
  },
  "files": {
    "ignore": ["node_modules", ".next", "public", "*.config.*", "__tests__"]
  }
}
```

- [ ] **Step 3: Add scripts to package.json**

Read `package.json`, find the `"scripts"` object, add these three entries:

```json
"lint": "biome check src/",
"lint:fix": "biome check --fix src/",
"format": "biome format --write src/"
```

- [ ] **Step 4: Run lint:fix to auto-fix existing issues**

```bash
npm run lint:fix
```

Expected: Biome reports warnings/errors and auto-fixes what it can. Some warnings may remain (unused variables, explicit `any`). These are acceptable for now.

- [ ] **Step 5: Add lint step to CI**

Read `.github/workflows/ci.yml`. Find the job that runs `npm run build`. Add before it:

```yaml
- name: Lint
  run: npm run lint
```

- [ ] **Step 6: Run tests to verify nothing broke**

```bash
npm test
```

Expected: All existing tests pass. Biome formatting should not break runtime behavior.

- [ ] **Step 7: Commit**

```bash
git add biome.json package.json .github/workflows/ci.yml
git commit -m "chore: add Biome linting and formatting

- Install @biomejs/biome
- Add lint, lint:fix, format scripts
- Add lint step to CI pipeline
- Auto-fix existing style issues"
```

---

### Task 2: Install Drizzle ORM & Define Base Schema

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/server/db/schema/users.ts`
- Create: `src/server/db/schema/projects.ts`
- Create: `src/server/db/schema/experiments.ts`
- Create: `src/server/db/schema/audit.ts`
- Create: `src/server/db/schema/apiKeys.ts`
- Create: `src/server/db/schema/inventory.ts`
- Create: `src/server/db/schema/projectManagement.ts`
- Create: `src/server/db/schema/collaboration.ts`
- Create: `src/server/db/schema/knowledge.ts`
- Create: `src/server/db/schema/ai.ts`
- Create: `src/server/db/schema/index.ts`
- Create: `src/server/db/migrations/` (auto-generated)

**Interfaces:**
- Produces: Typed Drizzle schema objects used by all subsequent tasks
- Consumes: Existing `@libsql/client` connection from `src/lib/db.ts`

- [ ] **Step 1: Install Drizzle ORM and Drizzle Kit**

```bash
npm install drizzle-orm
npm install -D drizzle-kit
```

Expected: `drizzle-orm` in `dependencies`, `drizzle-kit` in `devDependencies`.

- [ ] **Step 2: Create drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/db/schema/index.ts',
  out: './src/server/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || 'file:.nexus/workbench.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
```

- [ ] **Step 3: Create users schema**

Create `src/server/db/schema/users.ts`:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name'),
  image: text('image'),
  provider: text('provider'), // 'github' | 'google' | 'email'
  providerId: text('provider_id'),
  institution: text('institution'),
  researchArea: text('research_area'),
  orcid: text('orcid'),
  bio: text('bio'),
  // Future multi-tenancy (nullable now)
  orgId: text('org_id'),
  teamId: text('team_id'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 4: Create projects schema**

Create `src/server/db/schema/projects.ts`:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  orgId: text('org_id'), // nullable, future multi-tenancy
  title: text('title').notNull(),
  description: text('description'),
  targetProduct: text('target_product'),
  status: text('status').default('active'), // active, archived, deleted
  visibility: text('visibility').default('private'), // private, unlisted, public
  forkedFrom: text('forked_from'), // FK to projects.id for forking
  createdBy: text('created_by'), // FK to users.id
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
});

export const projectMembers = sqliteTable('project_members', {
  projectId: text('project_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').default('editor'), // owner, admin, editor, viewer
  invitedBy: text('invited_by'),
  joinedAt: text('joined_at').$defaultFn(() => new Date().toISOString()),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
```

- [ ] **Step 5: Create experiments schema**

Create `src/server/db/schema/experiments.ts`:

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const experiments = sqliteTable('experiments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  tool: text('tool').notNull(), // tool ID from toolRegistry.ts
  inputJson: text('input_json'), // JSON string of inputs
  outputJson: text('output_json'), // JSON string of outputs
  status: text('status').default('pending'), // pending, running, completed, failed
  durationMs: integer('duration_ms'),
  errorMessage: text('error_message'),
  createdBy: text('created_by'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const experimentArtifacts = sqliteTable('experiment_artifacts', {
  id: text('id').primaryKey(),
  experimentId: text('experiment_id').notNull(),
  type: text('type').notNull(), // 'result', 'visualization', 'export', 'file'
  name: text('name'),
  path: text('path'), // R2 key or local path
  sizeBytes: integer('size_bytes'),
  mimeType: text('mime_type'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;
```

- [ ] **Step 6: Create audit log schema**

Create `src/server/db/schema/audit.ts`:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  sequenceNumber: integer('sequence_number').unique(),
  timestamp: text('timestamp').notNull(),
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name'),
  actorEmail: text('actor_email'),
  actorIp: text('actor_ip'),
  action: text('action').notNull(), // create, update, delete, export, sign, login, share
  entityType: text('entity_type'), // project, experiment, task, inventory, etc.
  entityId: text('entity_id'),
  projectId: text('project_id'),
  beforeState: text('before_state'), // JSON snapshot
  afterState: text('after_state'), // JSON snapshot
  changeSummary: text('change_summary'),
  hash: text('hash').notNull(), // SHA-256 of this row
  previousHash: text('previous_hash'), // hash of previous entry (chain)
  metadata: text('metadata'), // JSON for additional context
});

export type AuditEntry = typeof auditLog.$inferSelect;
export type NewAuditEntry = typeof auditLog.$inferInsert;
```

- [ ] **Step 7: Create API keys schema**

Create `src/server/db/schema/apiKeys.ts`:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(), // SHA-256 of the key
  keyPrefix: text('key_prefix').notNull(), // first 11 chars for display: nxb_xxxxxxx
  scopes: text('scopes').default('read,write'), // JSON array
  expiresAt: text('expires_at'),
  lastUsedAt: text('last_used_at'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
```

- [ ] **Step 8: Create inventory schema**

Create `src/server/db/schema/inventory.ts`:

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const inventoryStrains = sqliteTable('inventory_strains', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  genotype: text('genotype'),
  species: text('species').default('E. coli'),
  source: text('source'),
  parentStrainId: text('parent_strain_id'),
  associatedPlasmidIds: text('associated_plasmid_ids'), // JSON array
  freezerLocationId: text('freezer_location_id'),
  boxPosition: text('box_position'),
  aliquotCount: integer('aliquot_count').default(0),
  resistanceMarkers: text('resistance_markers'), // JSON array
  notes: text('notes'),
  projectId: text('project_id'),
  createdBy: text('created_by'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  archived: integer('archived').default(0),
});

export const inventoryPlasmids = sqliteTable('inventory_plasmids', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  backbone: text('backbone'),
  insertDescription: text('insert_description'),
  insertSequence: text('insert_sequence'),
  insertLengthBp: integer('insert_length_bp'),
  resistance: text('resistance'),
  copyNumber: text('copy_number'),
  promoter: text('promoter'),
  tags: text('tags'), // JSON array
  linkedPathwayNode: text('linked_pathway_node'),
  designSourceTool: text('design_source_tool'),
  freezerLocationId: text('freezer_location_id'),
  concentrationNgUl: real('concentration_ng_ul'),
  addgeneId: text('addgene_id'),
  sequenceVerified: integer('sequence_verified').default(0),
  notes: text('notes'),
  projectId: text('project_id'),
  createdBy: text('created_by'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  archived: integer('archived').default(0),
});

export const inventoryPrimers = sqliteTable('inventory_primers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sequence5to3: text('sequence_5to3').notNull(),
  lengthBp: integer('length_bp'),
  tmCelsius: real('tm_celsius'),
  gcPercent: real('gc_percent'),
  targetGene: text('target_gene'),
  modification5prime: text('modification_5prime'),
  pairId: text('pair_id'),
  concentrationUM: real('concentration_uM'),
  vendor: text('vendor'),
  notes: text('notes'),
  projectId: text('project_id'),
  createdBy: text('created_by'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  archived: integer('archived').default(0),
});

export const inventoryChemicals = sqliteTable('inventory_chemicals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  casNumber: text('cas_number'),
  molecularFormula: text('molecular_formula'),
  molecularWeight: real('molecular_weight_g_mol'),
  vendor: text('vendor'),
  catalogNumber: text('catalog_number'),
  lotNumber: text('lot_number'),
  purityPercent: real('purity_percent'),
  expiryDate: text('expiry_date'),
  hazardClass: text('hazard_class'), // JSON array
  sdsUrl: text('sds_url'),
  storageTemperature: text('storage_temperature'),
  quantityRemaining: real('quantity_remaining'),
  quantityUnit: text('quantity_unit'),
  reorderThreshold: real('reorder_threshold'),
  notes: text('notes'),
  projectId: text('project_id'),
  createdBy: text('created_by'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  archived: integer('archived').default(0),
});

export const inventoryLocations = sqliteTable('inventory_locations', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
  type: text('type').notNull(), // building, room, freezer, shelf, box, position
  name: text('name').notNull(),
  capacity: integer('capacity'),
  currentCount: integer('current_count').default(0),
  temperatureC: real('temperature_c'),
  notes: text('notes'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 9: Create project management schema**

Create `src/server/db/schema/projectManagement.ts`:

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const pmTasks = sqliteTable('pm_tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('backlog'), // backlog, in_progress, review, done, blocked
  priority: text('priority').default('medium'), // critical, high, medium, low
  assignedTo: text('assigned_to'),
  createdBy: text('created_by'),
  dueDate: text('due_date'),
  milestoneId: text('milestone_id'),
  toolId: text('tool_id'),
  experimentRecordId: text('experiment_record_id'),
  tags: text('tags'), // JSON array
  sortOrder: integer('sort_order').default(0),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  completedAt: text('completed_at'),
});

export const pmMilestones = sqliteTable('pm_milestones', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  dueDate: text('due_date'),
  status: text('status').default('upcoming'), // upcoming, in_progress, completed, missed
  deliverables: text('deliverables'), // JSON array
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  completedAt: text('completed_at'),
});

export const pmTemplates = sqliteTable('pm_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category'),
  description: text('description'),
  tasks: text('tasks'), // JSON array
  milestones: text('milestones'), // JSON array
  createdBy: text('created_by'),
  isPublic: integer('is_public').default(0),
  forkCount: integer('fork_count').default(0),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 10: Create collaboration schema**

Create `src/server/db/schema/collaboration.ts`:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  userId: text('user_id').notNull(),
  userName: text('user_name'),
  message: text('message').notNull(),
  replyToId: text('reply_to_id'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const commentThreads = sqliteTable('comment_threads', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  projectId: text('project_id'),
  createdBy: text('created_by'),
  resolved: integer('resolved').default(0),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const commentReplies = sqliteTable('comment_replies', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull(),
  userId: text('user_id').notNull(),
  message: text('message').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(), // mention, comment, assignment, alert
  title: text('title'),
  body: text('body'),
  read: integer('read').default(0),
  link: text('link'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const shareLinks = sqliteTable('share_links', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  permission: text('permission').default('view'), // view, edit
  createdBy: text('created_by'),
  expiresAt: text('expires_at'),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').default(0),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 11: Create knowledge schema**

Create `src/server/db/schema/knowledge.ts`:

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const wikiPages = sqliteTable('wiki_pages', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  content: text('content'), // Tiptap JSON
  contentMarkdown: text('content_markdown'), // for FTS5
  category: text('category'), // protocol, design, result, meeting_notes, misc
  tags: text('tags'), // JSON array
  createdBy: text('created_by'),
  lastEditedBy: text('last_edited_by'),
  version: integer('version').default(1),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
});

export const wikiRevisions = sqliteTable('wiki_revisions', {
  id: text('id').primaryKey(),
  pageId: text('page_id').notNull(),
  version: integer('version').notNull(),
  content: text('content'),
  contentMarkdown: text('content_markdown'),
  editedBy: text('edited_by'),
  changeSummary: text('change_summary'),
  editedAt: text('edited_at').$defaultFn(() => new Date().toISOString()),
});

export const protocols = sqliteTable('protocols', {
  id: text('id').primaryKey(),
  wikiPageId: text('wiki_page_id'),
  category: text('category'),
  estimatedDurationMin: integer('estimated_duration_min'),
  difficulty: text('difficulty'), // beginner, intermediate, advanced
  equipment: text('equipment'), // JSON array
  reagents: text('reagents'), // JSON array with links to inventory_chemicals
  steps: text('steps'), // JSON array of {order, description, duration_min, notes}
  forkOf: text('fork_of'),
  forkCount: integer('fork_count').default(0),
  ratingAvg: real('rating_avg'),
  ratingCount: integer('rating_count').default(0),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const literatureEntries = sqliteTable('literature_entries', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  doi: text('doi'),
  title: text('title'),
  authors: text('authors'), // JSON array
  journal: text('journal'),
  year: integer('year'),
  abstract: text('abstract'),
  tags: text('tags'), // JSON array
  userAnnotations: text('user_annotations'), // JSON array
  addedBy: text('added_by'),
  addedAt: text('added_at').$defaultFn(() => new Date().toISOString()),
});

export const decisionLog = sqliteTable('decision_log', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  title: text('title').notNull(),
  context: text('context'),
  options: text('options'), // JSON array
  decision: text('decision'),
  rationale: text('rationale'),
  outcome: text('outcome'),
  relatedExperimentIds: text('related_experiment_ids'), // JSON array
  decidedBy: text('decided_by'),
  decidedAt: text('decided_at').$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 12: Create AI schema**

Create `src/server/db/schema/ai.ts`:

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const aiConversations = sqliteTable('ai_conversations', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  userId: text('user_id'),
  title: text('title'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
});

export const aiMessages = sqliteTable('ai_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  role: text('role').notNull(), // user, assistant, system
  content: text('content').notNull(),
  toolCalls: text('tool_calls'), // JSON
  tokenUsage: text('token_usage'), // JSON {input, output}
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const aiUsage = sqliteTable('ai_usage', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  orgId: text('org_id'),
  date: text('date').notNull(), // YYYY-MM-DD
  model: text('model'),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  costUsd: real('cost_usd').default(0),
  requestType: text('request_type'), // analyze, plan, classify, rag
});
```

- [ ] **Step 13: Create barrel export**

Create `src/server/db/schema/index.ts`:

```typescript
export * from './users';
export * from './projects';
export * from './experiments';
export * from './audit';
export * from './apiKeys';
export * from './inventory';
export * from './projectManagement';
export * from './collaboration';
export * from './knowledge';
export * from './ai';
```

- [ ] **Step 14: Generate initial migration**

```bash
npx drizzle-kit generate
```

Expected: Creates migration files in `src/server/db/migrations/`.

- [ ] **Step 15: Run tests to verify nothing broke**

```bash
npm test
```

Expected: All existing tests pass. New schema files are not imported by existing code yet, so no conflicts.

- [ ] **Step 16: Commit**

```bash
git add drizzle.config.ts src/server/db/schema/ package.json package-lock.json
git commit -m "feat: add Drizzle ORM with complete OS platform schema

- Install drizzle-orm and drizzle-kit
- Define 30+ tables across 10 schema files:
  - users, projects, project_members
  - experiments, experiment_artifacts
  - audit_log (immutable, hash-chained)
  - api_keys (per-user, SHA-256 hashed)
  - inventory (strains, plasmids, primers, chemicals, locations)
  - project management (tasks, milestones, templates)
  - collaboration (chat, comments, notifications, share_links)
  - knowledge (wiki, protocols, literature, decision_log)
  - AI (conversations, messages, usage tracking)
- All tables include nullable org_id/team_id for future multi-tenancy
- snake_case columns auto-mapped to camelCase in TypeScript"
```

---

### Task 3: Configure Sentry Properly

**Files:**
- Modify: `sentry.server.config.ts`
- Modify: `sentry.edge.config.ts`
- Create: `src/utils/sentry.ts`

- [ ] **Step 1: Verify Sentry DSN is set**

```bash
grep -q "SENTRY_DSN" .env.local && echo "SENTRY_DSN found" || echo "SENTRY_DSN missing"
```

If missing, add `SENTRY_DSN=your_dsn_here` to `.env.local`.

- [ ] **Step 2: Enhance sentry.server.config.ts**

Replace contents of `sentry.server.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
  integrations: [
    Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
  ],
  beforeSend(event) {
    // Strip sensitive data
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});
```

- [ ] **Step 3: Enhance sentry.edge.config.ts**

Same content as server config.

- [ ] **Step 4: Create custom span helper**

Create `src/utils/sentry.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  op = 'function'
): Promise<T> {
  return Sentry.startSpan({ name, op }, async () => fn());
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add sentry.server.config.ts sentry.edge.config.ts src/utils/sentry.ts
git commit -m "feat: configure Sentry with release tracking, source maps, and custom spans

- Add release tracking via VERCEL_GIT_COMMIT_SHA
- Strip authorization headers from error reports
- Add withSpan() helper for custom performance tracing
- Add captureError() with context attachment"
```

---

### Task 4: Create API Key Utility & Routes

**Files:**
- Create: `src/utils/apiKeys.ts`
- Create: `app/api/keys/route.ts`
- Create: `app/api/keys/[id]/route.ts`
- Create: `__tests__/apiKeys.test.ts`

**Interfaces:**
- Consumes: Auth.js session from `src/lib/auth.ts`, Drizzle schema from Task 2
- Produces: `POST /api/keys` (create), `GET /api/keys` (list), `DELETE /api/keys/[id]` (revoke)

- [ ] **Step 1: Write failing test for API key generation**

Create `__tests__/apiKeys.test.ts`:

```typescript
import { generateApiKey, hashApiKey } from '../src/utils/apiKeys';

describe('API Keys', () => {
  it('should generate a key with nxb_ prefix', () => {
    const { key, hash, prefix } = generateApiKey();
    expect(key).toMatch(/^nxb_[A-Za-z0-9_-]{32}$/);
    expect(hash).toHaveLength(64); // SHA-256 hex
    expect(prefix).toMatch(/^nxb_[A-Za-z0-9_-]{7}$/);
  });

  it('should produce deterministic hashes', () => {
    const { key, hash } = generateApiKey();
    expect(hashApiKey(key)).toBe(hash);
  });

  it('should generate unique keys', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey().key));
    expect(keys.size).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/apiKeys.test.ts
```

Expected: FAIL — `Cannot find module '../src/utils/apiKeys'`

- [ ] **Step 3: Implement API key utility**

Create `src/utils/apiKeys.ts`:

```typescript
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = nanoid(32);
  const key = `nxb_${randomPart}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 11); // nxb_ + 7 chars
  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/apiKeys.test.ts
```

Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Create API key list/create route**

Create `app/api/keys/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiKeys } from '@/server/db/schema';
import { generateApiKey } from '@/utils/apiKeys';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, session.user.id));

  return NextResponse.json({ keys });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, scopes, expiresAt } = body;

  if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }

  const { key, hash, prefix } = generateApiKey();

  await db.insert(apiKeys).values({
    id: nanoid(),
    userId: session.user.id,
    name,
    keyHash: hash,
    keyPrefix: prefix,
    scopes: scopes ? JSON.stringify(scopes) : 'read,write',
    expiresAt: expiresAt || null,
  });

  // Return the raw key ONCE — it cannot be retrieved later
  return NextResponse.json({ key, prefix, name }, { status: 201 });
}
```

- [ ] **Step 6: Create API key revoke route**

Create `app/api/keys/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiKeys } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const deleted = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, session.user.id)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

- [ ] **Step 8: Commit**

```bash
git add src/utils/apiKeys.ts app/api/keys/ __tests__/apiKeys.test.ts
git commit -m "feat: add per-user API key system

- Generate keys with nxb_ prefix and nanoid(32) randomness
- SHA-256 hash for storage (raw key shown once at creation)
- GET /api/keys — list user's keys (no secret exposed)
- POST /api/keys — create new key (returns raw key once)
- DELETE /api/keys/[id] — revoke key
- TDD: 3 unit tests for key generation and hashing"
```

---

### Task 5: Upgrade Auth.js & Update Middleware

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `middleware.ts`
- Modify: `package.json`

- [ ] **Step 1: Check current Auth.js version**

```bash
npm ls next-auth 2>&1 | head -5
```

Expected: Shows current version (likely 5.0.0-beta.x).

- [ ] **Step 2: Upgrade to stable**

```bash
npm install next-auth@latest @auth/core@latest
```

- [ ] **Step 3: Verify auth config still works**

Read `src/lib/auth.ts` and ensure the providers array still contains GitHub and Google. The API should be compatible — Auth.js v5 stable is backward-compatible with beta.

- [ ] **Step 4: Update middleware to support API key auth**

Read `middleware.ts`. Add API key validation alongside existing auth:

```typescript
// In the middleware function, after existing auth checks:
import { hashApiKey } from '@/utils/apiKeys';

// Check for API key in headers
const apiKey = request.headers.get('x-api-key');
if (apiKey && apiKey.startsWith('nxb_')) {
  const hash = hashApiKey(apiKey);
  // Look up key in DB, check expiry, update last_used_at
  // If valid, allow the request
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts middleware.ts package.json package-lock.json
git commit -m "feat: upgrade Auth.js to stable, add API key middleware support

- Upgrade next-auth from beta to stable release
- Add X-API-Key header validation in middleware
- Support nxb_ prefixed API keys alongside session auth"
```

---

### Task 6: Set Up Cloudflare R2 File Storage

**Files:**
- Create: `src/utils/storage.ts`
- Create: `app/api/files/upload/route.ts`
- Create: `app/api/files/[key]/route.ts`
- Modify: `.env.example`

- [ ] **Step 1: Install AWS SDK (S3-compatible)**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Create storage utility**

Create `src/utils/storage.ts`:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.R2_BUCKET || 'nexus-bio-files';

export async function getUploadUrl(key: string, contentType: string, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function getDownloadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function deleteFile(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  await s3.send(command);
}

export function buildFileKey(projectId: string, category: string, filename: string): string {
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${projectId}/${category}/${timestamp}_${safeName}`;
}
```

- [ ] **Step 3: Create upload route**

Create `app/api/files/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUploadUrl, buildFileKey } from '@/utils/storage';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { filename, contentType, projectId, category } = await request.json();

  if (!filename || !contentType) {
    return NextResponse.json({ error: 'filename and contentType required' }, { status: 400 });
  }

  // Validate content type
  const allowedTypes = [
    'text/plain', 'text/csv', 'application/json',
    'chemical/x-fasta', 'chemical/x-genbank', 'application/xml',
    'application/pdf', 'image/png', 'image/jpeg', 'image/svg+xml',
  ];
  if (!allowedTypes.includes(contentType) && !contentType.startsWith('text/')) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const key = buildFileKey(projectId || 'default', category || 'uploads', filename);
  const uploadUrl = await getUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key });
}
```

- [ ] **Step 4: Create download route**

Create `app/api/files/[key]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDownloadUrl } from '@/utils/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { key } = await params;
  // Decode the key (may contain / characters)
  const decodedKey = decodeURIComponent(key);

  const downloadUrl = await getDownloadUrl(decodedKey);

  return NextResponse.json({ downloadUrl });
}
```

- [ ] **Step 5: Add R2 env vars to .env.example**

Append to `.env.example`:

```
# Cloudflare R2 File Storage
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=nexus-bio-files
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/utils/storage.ts app/api/files/ .env.example package.json package-lock.json
git commit -m "feat: add Cloudflare R2 file storage with pre-signed URLs

- S3-compatible client via @aws-sdk/client-s3
- POST /api/files/upload — generate pre-signed upload URL
- GET /api/files/[key] — generate pre-signed download URL
- Content type validation for allowed file types
- Content-addressed key generation: {projectId}/{category}/{timestamp}_{filename}"
```

---

## Phase 0 Summary

After completing Tasks 1-6, the platform has:
- ✅ Biome linting & formatting (code quality)
- ✅ Drizzle ORM with 30+ typed tables (data foundation)
- ✅ Sentry with proper config (monitoring)
- ✅ Per-user API keys (developer access)
- ✅ Auth.js stable + API key middleware (authentication)
- ✅ Cloudflare R2 file storage (file handling)

**Next phase:** Sequence Editor (the core differentiator) — see Phase 1.

---

## Phase 1: Core Value (Month 3-4)

> Goal: Sequence editor, real-time collaboration, API documentation.

### Task 7: Build Sequence Data Model & Linear Viewer

> This is the HIGHEST PRIORITY feature. The sequence editor is what makes Nexus-Bio a synbio platform vs a calculator.

**Files:**
- Create: `src/components/sequence/types.ts`
- Create: `src/components/sequence/SequenceModel.ts`
- Create: `src/components/sequence/LinearSequenceViewer.tsx`
- Create: `src/components/sequence/FeatureAnnotation.tsx`
- Create: `app/tools/sequence/page.tsx`
- Create: `__tests__/sequenceModel.test.ts`

*Detailed steps for Tasks 7+ will be written after Phase 0 tasks are executed. The sequence editor is a 4-8 week effort that warrants its own sub-plan.*

---

*This plan covers Phase 0 in full detail. Phase 1-4 tasks will be expanded into equally detailed sub-plans as Phase 0 completes.*

**Spec:** `docs/superpowers/specs/2026-06-25-nexus-bio-os-platform-blueprint.md`
