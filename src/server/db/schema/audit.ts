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
