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
