# ADR-002: SQLite Ephemeral Storage with localStorage Fallback

## Status

Accepted — migration to Turso planned

## Context

Nexus-Bio's workbench feature stores project state (evidence, tool payloads, workflow control, audit trail). The storage solution must:
1. Work on Vercel Hobby plan (free tier)
2. Support revision-based conflict detection
3. Survive cold starts
4. Eventually support multi-user collaboration

**Options considered:**
1. Vercel Postgres — managed, persistent, but costs $20/month minimum
2. Turso (libSQL) — SQLite-compatible, edge-replicated, free tier available
3. better-sqlite3 on Vercel — free, but ephemeral (lost on cold start)
4. Upstash Redis — serverless Redis, free tier, but different data model

## Decision

**Phase 1 (current): better-sqlite3 + Zustand localStorage persistence.**
**Phase 2 (planned): Migrate to Turso.**

Current architecture:
- Server: `better-sqlite3` in `src/server/workbenchDb.ts` — ephemeral on Vercel
- Client: Zustand `persist` middleware writes to `localStorage['nexus-bio-workbench']` with 500ms debounce
- Recovery: On cold start, if server returns empty data but localStorage has meaningful data, preserve local data (cold-start recovery logic in `loadFromServer`)

## Consequences

**Positive:**
- Zero infrastructure cost
- Fast reads (in-memory SQLite)
- localStorage provides client-side durability across page refreshes
- Cold-start recovery preserves user data

**Negative:**
- Server data lost on every Vercel cold start (~every 10 min of inactivity)
- Single-user only (localStorage is per-browser)
- No backup or export mechanism (without manual intervention)

**Migration path:**
1. Install `@libsql/client`
2. Create Turso database
3. Replace `better-sqlite3` with `createClient({ url, authToken })`
4. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to Vercel env vars
5. Run migration SQL to create tables

See `/nexus-bio-migrate` skill for detailed steps.
