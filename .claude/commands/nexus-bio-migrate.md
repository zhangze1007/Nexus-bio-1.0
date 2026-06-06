---
name: nexus-bio-migrate
description: Database migration helper for Nexus-Bio SQLite → Turso transition
---

# /nexus-bio-migrate

Guide the migration from ephemeral SQLite to persistent Turso database.

## Current State
- SQLite via `better-sqlite3` in `src/server/workbenchDb.ts`
- Ephemeral on Vercel (lost on cold start)
- Zustand persist provides localStorage backup

## Migration Steps

1. **Install Turso CLI**:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   ```

2. **Create database**:
   ```bash
   turso db create nexus-bio
   turso db tokens create nexus-bio
   ```

3. **Create migration SQL** at `src/server/db/migrations/001_initial.sql`:
   ```sql
   CREATE TABLE IF NOT EXISTS workbench_projects (
     id TEXT PRIMARY KEY,
     state_json TEXT NOT NULL,
     revision INTEGER NOT NULL DEFAULT 1,
     updated_at TEXT NOT NULL DEFAULT (datetime('now')),
     actor_id TEXT
   );
   ```

4. **Install client**:
   ```bash
   npm install @libsql/client
   ```

5. **Modify `src/server/workbenchDb.ts`**:
   - Replace `better-sqlite3` with `@libsql/client`
   - Use `createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! })`

6. **Add env vars to Vercel**:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`

7. **Verify**: Create a workbench project, wait for cold start, confirm data persists.

## Output
Step-by-step migration guide with verification at each step.
