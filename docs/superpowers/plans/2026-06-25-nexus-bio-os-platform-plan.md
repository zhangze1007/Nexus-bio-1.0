# Nexus-Bio OS Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Nexus-Bio 1.0 from a demo platform into a production-grade Synthetic Biology Operating System across 13 branches.

**Architecture:** 8-layer platform (Infrastructure → Data → Auth → Scientific → Tools → Collaboration → AI → Business) built incrementally over 4 phases.

**Tech Stack:** Next.js 15, React 19, TypeScript, Drizzle ORM, Turso/libSQL, Upstash Redis, Socket.io, Yjs, Stripe, PostHog, Storybook, Biome

**Spec:** `docs/superpowers/specs/2026-06-25-nexus-bio-os-platform-blueprint.md`

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
- Produces: `biome check` command for CI

- [ ] **Step 1: Install Biome**

```bash
npm install -D @biomejs/biome
```

- [ ] **Step 2: Create biome.json config**

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

Add to `"scripts"`:
```json
"lint": "biome check src/",
"lint:fix": "biome check --fix src/",
"format": "biome format --write src/"
```

- [ ] **Step 4: Run lint:fix to auto-fix existing issues**

```bash
npm run lint:fix
```

- [ ] **Step 5: Add lint step to CI**

In `.github/workflows/ci.yml`, add before typecheck:
```yaml
- name: Lint
  run: npm run lint
```

- [ ] **Step 6: Run tests to verify nothing broke**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add biome.json package.json .github/workflows/ci.yml
git commit -m "chore: add Biome linting and formatting"
```

---

### Task 2: Configure Sentry Properly

**Files:**
- Modify: `sentry.server.config.ts`
- Modify: `sentry.edge.config.ts`
- Create: `src/utils/sentry.ts` (helper for custom spans)

- [ ] **Step 1: Verify Sentry DSN is set**

Check that `SENTRY_DSN` is in `.env.local` or Vercel environment variables.

- [ ] **Step 2: Enhance sentry.server.config.ts**

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
  integrations: [
    Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
  ],
});
```

- [ ] **Step 3: Enhance sentry.edge.config.ts**

Same config as server config.

- [ ] **Step 4: Create custom span helper**

```typescript
// src/utils/sentry.ts
import * as Sentry from '@sentry/nextjs';

export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  op = 'function'
): Promise<T> {
  return Sentry.startSpan({ name, op }, async () => fn());
}
```

- [ ] **Step 5: Commit**

```bash
git add sentry.server.config.ts sentry.edge.config.ts src/utils/sentry.ts
git commit -m "feat: configure Sentry with release tracking and custom spans"
```

---

### Task 3: Install Drizzle ORM & Define Base Schema

**Files:**
- Create: `src/server/db/schema/index.ts`
- Create: `src/server/db/schema/users.ts`
- Create: `src/server/db/schema/projects.ts`
- Create: `src/server/db/schema/experiments.ts`
- Create: `src/server/db/schema/audit.ts`
- Create: `drizzle.config.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: Typed Drizzle schema objects for all base tables
- Consumes: Existing `@libsql/client` connection from `src/lib/db.ts`

- [ ] **Step 1: Install Drizzle ORM**

```bash
npm install drizzle-orm
npm install -D drizzle-kit
```

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

- [ ] **Step 3: Define users schema**

```typescript
// src/server/db/schema/users.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  email: text('email').unique().notNull(),
  name: text('name'),
  image: text('image'),
  provider: text('provider'), // 'github', 'google', 'email'
  providerId: text('provider_id'),
  institution: text('institution'),
  researchArea: text('research_area'),
  orcid: text('orcid'),
  bio: text('bio'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 4: Define projects schema**

```typescript
// src/server/db/schema/projects.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  title: text('title').notNull(),
  description: text('description'),
  targetProduct: text('target_product'),
  status: text('status').default('active'),
  visibility: text('visibility').default('private'), // private, unlisted, public
  forkedFrom: text('forked_from'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 5: Define experiments schema**

```typescript
// src/server/db/schema/experiments.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const experiments = sqliteTable('experiments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  tool: text('tool').notNull(),
  inputJson: text('input_json'),
  outputJson: text('output_json'),
  status: text('status').default('pending'),
  durationMs: integer('duration_ms'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 6: Define audit log schema**

```typescript
// src/server/db/schema/audit.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  sequenceNumber: integer('sequence_number').unique(),
  timestamp: text('timestamp').notNull(),
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  projectId: text('project_id'),
  changeSummary: text('change_summary'),
  hash: text('hash').notNull(),
  previousHash: text('previous_hash'),
});
```

- [ ] **Step 7: Export all schemas**

```typescript
// src/server/db/schema/index.ts
export * from './users';
export * from './projects';
export * from './experiments';
export * from './audit';
```

- [ ] **Step 8: Generate initial migration**

```bash
npx drizzle-kit generate
```

- [ ] **Step 9: Commit**

```bash
git add src/server/db/schema/ drizzle.config.ts package.json
git commit -m "feat: add Drizzle ORM with base schema (users, projects, experiments, audit)"
```

---

### Task 4: Add Inventory Schema

**Files:**
- Create: `src/server/db/schema/inventory.ts`
- Modify: `src/server/db/schema/index.ts`

- [ ] **Step 1: Define inventory tables**

```typescript
// src/server/db/schema/inventory.ts
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
  type: text('type').notNull(), // building, room, freezer, shelf, box
  name: text('name').notNull(),
  capacity: integer('capacity'),
  currentCount: integer('current_count').default(0),
  temperatureC: real('temperature_c'),
  notes: text('notes'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 2: Export from index.ts**

Add to `src/server/db/schema/index.ts`:
```typescript
export * from './inventory';
```

- [ ] **Step 3: Generate migration**

```bash
npx drizzle-kit generate
```

- [ ] **Step 4: Commit**

```bash
git add src/server/db/schema/inventory.ts src/server/db/schema/index.ts
git commit -m "feat: add inventory schema (strains, plasmids, primers, chemicals, locations)"
```

---

### Task 5: Add Project Management Schema

**Files:**
- Create: `src/server/db/schema/projectManagement.ts`
- Modify: `src/server/db/schema/index.ts`

- [ ] **Step 1: Define PM tables**

```typescript
// src/server/db/schema/projectManagement.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const pmTasks = sqliteTable('pm_tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('backlog'),
  priority: text('priority').default('medium'),
  assignedTo: text('assigned_to'),
  createdBy: text('created_by'),
  dueDate: text('due_date'),
  milestoneId: text('milestone_id'),
  toolId: text('tool_id'),
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
  status: text('status').default('upcoming'),
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

- [ ] **Step 2: Export and generate migration**

```bash
# Add export to index.ts, then:
npx drizzle-kit generate
```

- [ ] **Step 3: Commit**

```bash
git add src/server/db/schema/projectManagement.ts src/server/db/schema/index.ts
git commit -m "feat: add project management schema (tasks, milestones, templates)"
```

---

### Task 6: Add Collaboration Schema

**Files:**
- Create: `src/server/db/schema/collaboration.ts`
- Modify: `src/server/db/schema/index.ts`

- [ ] **Step 1: Define collaboration tables**

```typescript
// src/server/db/schema/collaboration.ts
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
  type: text('type').notNull(),
  title: text('title'),
  body: text('body'),
  read: integer('read').default(0),
  link: text('link'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const shareLinks = sqliteTable('share_links', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  permission: text('permission').default('view'),
  createdBy: text('created_by'),
  expiresAt: text('expires_at'),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').default(0),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 2: Export and commit**

```bash
npx drizzle-kit generate
git add src/server/db/schema/collaboration.ts src/server/db/schema/index.ts
git commit -m "feat: add collaboration schema (chat, comments, notifications, share links)"
```

---

### Task 7: Add Knowledge & AI Schema

**Files:**
- Create: `src/server/db/schema/knowledge.ts`
- Create: `src/server/db/schema/ai.ts`
- Modify: `src/server/db/schema/index.ts`

- [ ] **Step 1: Define knowledge tables**

```typescript
// src/server/db/schema/knowledge.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const wikiPages = sqliteTable('wiki_pages', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  content: text('content'),
  contentMarkdown: text('content_markdown'),
  category: text('category'),
  tags: text('tags'),
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
  editedBy: text('edited_by'),
  changeSummary: text('change_summary'),
  editedAt: text('edited_at').$defaultFn(() => new Date().toISOString()),
});

export const protocols = sqliteTable('protocols', {
  id: text('id').primaryKey(),
  wikiPageId: text('wiki_page_id'),
  category: text('category'),
  estimatedDurationMin: integer('estimated_duration_min'),
  difficulty: text('difficulty'),
  equipment: text('equipment'),
  reagents: text('reagents'),
  steps: text('steps'),
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
  authors: text('authors'),
  journal: text('journal'),
  year: integer('year'),
  abstract: text('abstract'),
  tags: text('tags'),
  userAnnotations: text('user_annotations'),
  addedBy: text('added_by'),
  addedAt: text('added_at').$defaultFn(() => new Date().toISOString()),
});

export const decisionLog = sqliteTable('decision_log', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  title: text('title').notNull(),
  context: text('context'),
  options: text('options'),
  decision: text('decision'),
  rationale: text('rationale'),
  outcome: text('outcome'),
  decidedBy: text('decided_by'),
  decidedAt: text('decided_at').$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 2: Define AI tables**

```typescript
// src/server/db/schema/ai.ts
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
  role: text('role').notNull(),
  content: text('content').notNull(),
  toolCalls: text('tool_calls'),
  tokenUsage: text('token_usage'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const aiUsage = sqliteTable('ai_usage', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  orgId: text('org_id'),
  date: text('date').notNull(),
  model: text('model'),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  costUsd: real('cost_usd').default(0),
  requestType: text('request_type'),
});
```

- [ ] **Step 3: Export and commit**

```bash
npx drizzle-kit generate
git add src/server/db/schema/knowledge.ts src/server/db/schema/ai.ts src/server/db/schema/index.ts
git commit -m "feat: add knowledge and AI schema (wiki, protocols, literature, conversations, usage)"
```

---

### Task 8: Upgrade Auth.js to Stable & Add Email Login

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `package.json`

- [ ] **Step 1: Check current Auth.js version**

```bash
npm ls next-auth
```

- [ ] **Step 2: Upgrade to stable**

```bash
npm install next-auth@latest @auth/core@latest
```

- [ ] **Step 3: Add Resend email provider**

```bash
npm install resend
```

- [ ] **Step 4: Add Resend provider to auth config**

In `src/lib/auth.ts`, add to providers array:
```typescript
import { Resend } from 'resend';

// Add to providers:
Resend({
  apiKey: process.env.RESEND_API_KEY,
  from: 'noreply@nexus-bio.vercel.app',
})
```

- [ ] **Step 5: Add RESEND_API_KEY to .env.local**

```
RESEND_API_KEY=re_xxxxx
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts package.json
git commit -m "feat: upgrade Auth.js to stable, add Resend email provider"
```

---

### Task 9: Add Per-User API Key System

**Files:**
- Create: `src/server/db/schema/apiKeys.ts`
- Create: `app/api/keys/route.ts`
- Modify: `src/server/db/schema/index.ts`
- Modify: `middleware.ts`

**Interfaces:**
- Produces: `POST /api/keys` (create), `GET /api/keys` (list), `DELETE /api/keys/[id]` (revoke)
- Consumes: Auth.js session for user identity

- [ ] **Step 1: Define API keys schema**

```typescript
// src/server/db/schema/apiKeys.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(), // first 8 chars for display
  scopes: text('scopes').default('read,write'), // JSON array
  expiresAt: text('expires_at'),
  lastUsedAt: text('last_used_at'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 2: Create API key generation utility**

```typescript
// src/utils/apiKeys.ts
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `nxb_${nanoid(32)}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 11); // nxb_xxxxxxx
  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
```

- [ ] **Step 3: Create API key routes**

Create `app/api/keys/route.ts` for create/list and `app/api/keys/[id]/route.ts` for revoke.

- [ ] **Step 4: Update middleware to validate API keys**

In `middleware.ts`, add API key validation:
```typescript
const apiKey = request.headers.get('x-api-key');
if (apiKey) {
  const hash = hashApiKey(apiKey);
  // Look up in api_keys table, check expiry, update last_used_at
}
```

- [ ] **Step 5: Export and commit**

```bash
npx drizzle-kit generate
git add src/server/db/schema/apiKeys.ts src/utils/apiKeys.ts app/api/keys/ middleware.ts src/server/db/schema/index.ts
git commit -m "feat: add per-user API key system with SHA-256 hashing"
```

---

### Task 10: Add File Storage API

**Files:**
- Create: `app/api/files/upload/route.ts`
- Create: `app/api/files/[key]/route.ts`
- Modify: `.env.example`

- [ ] **Step 1: Install AWS SDK for S3-compatible storage**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Create S3 client utility**

```typescript
// src/utils/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function getUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function getDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}
```

- [ ] **Step 3: Create upload route**

Create `app/api/files/upload/route.ts` that generates pre-signed upload URLs.

- [ ] **Step 4: Create download route**

Create `app/api/files/[key]/route.ts` that generates pre-signed download URLs.

- [ ] **Step 5: Add R2 env vars to .env.example**

```
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=nexus-bio-files
```

- [ ] **Step 6: Commit**

```bash
git add app/api/files/ src/utils/storage.ts .env.example package.json
git commit -m "feat: add Cloudflare R2 file storage with pre-signed URLs"
```

---

## Phase 1: Core Value (Month 3-4)

> Goal: Multi-user platform with real-time collaboration, sequence editor, and open API.

---

### Task 11: Set Up WebSocket Server

**Files:**
- Create: `server.ts` (project root)
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install Socket.io**

```bash
npm install socket.io socket.io-client
```

- [ ] **Step 2: Create custom server**

```typescript
// server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' },
    path: '/api/ws',
  });

  io.on('connection', (socket) => {
    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
    });
    socket.on('cursor:move', (data) => {
      socket.to(`project:${data.projectId}`).emit('cursor:update', data);
    });
    socket.on('chat:message', (data) => {
      io.to(`project:${data.projectId}`).emit('chat:message', data);
    });
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  httpServer.listen(port);
});
```

- [ ] **Step 3: Update package.json scripts**

```json
"dev": "tsx server.ts",
"start": "NODE_ENV=production tsx server.ts"
```

- [ ] **Step 4: Test server starts**

```bash
npm run dev
```

- [ ] **Step 5: Commit**

```bash
git add server.ts package.json
git commit -m "feat: add Socket.io WebSocket server for real-time collaboration"
```

---

### Task 12: Add API Documentation with OpenAPI

**Files:**
- Create: `src/services/api/openapiSpec.ts`
- Create: `app/docs/api/page.tsx`

- [ ] **Step 1: Install OpenAPI tools**

```bash
npm install swagger-jsdoc @scalar/api-reference-react
```

- [ ] **Step 2: Create OpenAPI spec generator**

```typescript
// src/services/api/openapiSpec.ts
export const openapiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Nexus-Bio API',
    version: '1.0.0',
    description: 'Synthetic Biology Operating System API',
    contact: { email: 'fuchanze@gmail.com' },
  },
  servers: [
    { url: 'https://nexus-bio-1-0.vercel.app', description: 'Production' },
    { url: 'http://localhost:3000', description: 'Local' },
  ],
  paths: {
    '/api/v1/analyze': {
      post: {
        summary: 'AI Analysis',
        description: 'Send a query to the AI research assistant',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { prompt: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Analysis result' } },
      },
    },
    '/api/v1/fba': {
      post: {
        summary: 'Flux Balance Analysis',
        description: 'Run FBA simulation',
        responses: { '200': { description: 'FBA result' } },
      },
    },
    // ... more endpoints
  },
};
```

- [ ] **Step 3: Create docs page**

```typescript
// app/docs/api/page.tsx
'use client';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import spec from '@/services/api/openapiSpec';

export default function ApiDocs() {
  return <ApiReferenceReact configuration={{ spec, theme: 'kepler' }} />;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/services/api/openapiSpec.ts app/docs/api/ package.json
git commit -m "feat: add OpenAPI 3.1 spec and interactive API documentation"
```

---

### Task 13: Set Up Storybook

**Files:**
- Create: `.storybook/main.ts`
- Create: `.storybook/preview.ts`
- Create: `src/components/tools/shared/MetricCard.stories.tsx`

- [ ] **Step 1: Install Storybook**

```bash
npx storybook@latest init --type nextjs
```

- [ ] **Step 2: Configure Storybook**

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/nextjs', options: {} },
};
export default config;
```

- [ ] **Step 3: Configure dark theme preview**

```typescript
// .storybook/preview.ts
import type { Preview } from '@storybook/react';
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    backgrounds: { default: 'dark', values: [{ name: 'dark', value: '#0d0f14' }] },
  },
};
export default preview;
```

- [ ] **Step 4: Write first story (MetricCard)**

```typescript
// src/components/tools/shared/MetricCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MetricCard } from './MetricCard';

const meta: Meta<typeof MetricCard> = { title: 'Shared/MetricCard', component: MetricCard };
export default meta;
type Story = StoryObj<typeof MetricCard>;

export const Default: Story = { args: { label: 'Growth Rate', value: '0.87 h⁻¹' } };
export const Loading: Story = { args: { label: 'Growth Rate', value: '...' } };
```

- [ ] **Step 5: Add storybook scripts to package.json**

```json
"storybook": "storybook dev -p 6006",
"build-storybook": "storybook build"
```

- [ ] **Step 6: Commit**

```bash
git add .storybook/ src/components/tools/shared/MetricCard.stories.tsx package.json
git commit -m "feat: add Storybook 8 with dark theme and MetricCard story"
```

---

## Phase 2: Domain Depth (Month 5-7)

> Goal: Best-in-class computational tools, ML models, inventory system.

---

### Task 14: Implement Real SteadyCom for Community FBA

**Files:**
- Modify: `src/server/fbaEngine.ts`
- Create: `__tests__/steadyCom.test.ts`

- [ ] **Step 1: Write failing test for SteadyCom**

```typescript
// __tests__/steadyCom.test.ts
import { steadyCom } from '../src/server/fbaEngine';

describe('SteadyCom Community FBA', () => {
  it('should solve a 2-species community model', () => {
    // Define a simple 2-species model
    const model = {
      species: [
        { id: 'S1', reactions: [...], metabolites: [...] },
        { id: 'S2', reactions: [...], metabolites: [...] },
      ],
      sharedMetabolites: ['glucose', 'acetate'],
    };
    const result = steadyCom(model);
    expect(result.status).toBe('optimal');
    expect(result.growthRate).toBeGreaterThan(0);
    expect(result.speciesFluxes).toHaveProperty('S1');
    expect(result.speciesFluxes).toHaveProperty('S2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/steadyCom.test.ts
```

- [ ] **Step 3: Implement SteadyCom algorithm**

SteadyCom iterates: fix community growth rate μ, solve LP for each species, update μ based on community constraint. Repeat until convergence.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/steadyCom.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/fbaEngine.ts __tests__/steadyCom.test.ts
git commit -m "feat: implement real SteadyCom community FBA algorithm"
```

---

### Task 15: Build Escher-Style Flux Map Visualization

**Files:**
- Create: `src/components/visualizations/FluxMap.tsx`

- [ ] **Step 1: Install d3.js**

```bash
npm install d3 @types/d3
```

- [ ] **Step 2: Build FluxMap component**

```typescript
// src/components/visualizations/FluxMap.tsx
'use client';
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface FluxMapProps {
  model: { metabolites: any[]; reactions: any[] };
  fluxes: Map<string, number>;
  width?: number;
  height?: number;
}

export function FluxMap({ model, fluxes, width = 800, height = 600 }: FluxMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // ... d3 force layout, metabolite nodes, reaction edges with flux-proportional width
  }, [model, fluxes]);

  return <svg ref={svgRef} width={width} height={height} />;
}
```

- [ ] **Step 3: Integrate into FBASimPage**

- [ ] **Step 4: Commit**

```bash
git add src/components/visualizations/FluxMap.tsx
git commit -m "feat: add Escher-style interactive metabolic flux map visualization"
```

---

## Phase 3: Enterprise (Month 8-10)

> Goal: Enterprise-ready with LIMS, compliance, performance.

---

### Task 16: Implement Immutable Audit Trail

**Files:**
- Create: `src/services/audit/auditLogger.ts`
- Create: `src/services/audit/chainVerifier.ts`

- [ ] **Step 1: Write test for hash chain**

```typescript
// __tests__/auditChain.test.ts
import { auditLogger } from '../src/services/audit/auditLogger';
import { verifyChain } from '../src/services/audit/chainVerifier';

describe('Audit Chain', () => {
  it('should create hash-chained entries', async () => {
    const entry1 = await auditLogger.log({ actorId: 'u1', action: 'create', entityType: 'project', entityId: 'p1' });
    const entry2 = await auditLogger.log({ actorId: 'u1', action: 'update', entityType: 'project', entityId: 'p1' });
    expect(entry2.previousHash).toBe(entry1.hash);
  });

  it('should verify chain integrity', async () => {
    const result = await verifyChain();
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Implement audit logger with SHA-256 chaining**

- [ ] **Step 3: Implement chain verifier**

- [ ] **Step 4: Run tests**

```bash
npx jest __tests__/auditChain.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/audit/ __tests__/auditChain.test.ts
git commit -m "feat: implement immutable audit trail with SHA-256 hash chain"
```

---

### Task 17: Add Stripe Billing Integration

**Files:**
- Create: `src/services/billing/stripeClient.ts`
- Create: `app/api/billing/checkout/route.ts`
- Create: `app/api/billing/webhook/route.ts`

- [ ] **Step 1: Install Stripe**

```bash
npm install stripe
```

- [ ] **Step 2: Create Stripe client**

```typescript
// src/services/billing/stripeClient.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});
```

- [ ] **Step 3: Create checkout route**

- [ ] **Step 4: Create webhook handler for subscription events**

- [ ] **Step 5: Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to .env.example**

- [ ] **Step 6: Commit**

```bash
git add src/services/billing/ app/api/billing/ package.json .env.example
git commit -m "feat: add Stripe billing integration with checkout and webhooks"
```

---

## Phase 4: Growth (Month 11-12)

> Goal: Launch, community, go-to-market.

---

### Task 18: Build Landing Page

**Files:**
- Create: `app/(marketing)/layout.tsx`
- Create: `app/(marketing)/page.tsx`

- [ ] **Step 1: Create marketing route group layout**

Separate from the IDE layout — no IDEShell, no sidebar.

- [ ] **Step 2: Build landing page with hero, features, pricing, CTA**

- [ ] **Step 3: Add framer-motion scroll animations**

- [ ] **Step 4: Commit**

```bash
git add app/\(marketing\)/
git commit -m "feat: add conversion-optimized landing page"
```

---

### Task 19: Set Up PostHog Analytics

**Files:**
- Create: `src/components/analytics/PostHogProvider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Install PostHog**

```bash
npm install posthog-js posthog-node
```

- [ ] **Step 2: Create PostHog provider**

- [ ] **Step 3: Wrap app layout**

- [ ] **Step 4: Track custom events (tool_opened, experiment_created, fba_run)**

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/ app/layout.tsx package.json
git commit -m "feat: add PostHog product analytics with custom event tracking"
```

---

### Task 20: Build Documentation Site

**Files:**
- Create: `docs-site/` (separate Nextra project)

- [ ] **Step 1: Initialize Nextra project**

```bash
npx create-nextra@latest docs-site
```

- [ ] **Step 2: Write getting started guide, tool documentation, API reference**

- [ ] **Step 3: Deploy to Vercel as docs.nexus-bio.vercel.app**

- [ ] **Step 4: Commit**

```bash
git add docs-site/
git commit -m "feat: add Nextra documentation site"
```

---

## Summary

| Phase | Tasks | Duration | Deliverable |
|-------|-------|----------|-------------|
| **P0: Foundation** | 1-10 | Month 1-2 | Production-ready platform with proper tooling, auth, data layer |
| **P1: Core Value** | 11-13 | Month 3-4 | Real-time collab, API docs, Storybook |
| **P2: Domain Depth** | 14-15 | Month 5-7 | SteadyCom, flux maps, inventory, ML models |
| **P3: Enterprise** | 16-17 | Month 8-10 | Audit trail, billing, compliance |
| **P4: Growth** | 18-20 | Month 11-12 | Landing page, analytics, docs site |

Each task is independently testable and committable. Tasks within a phase can be parallelized. Cross-phase dependencies are documented in the spec.

---

*Spec: `docs/superpowers/specs/2026-06-25-nexus-bio-os-platform-blueprint.md`*
