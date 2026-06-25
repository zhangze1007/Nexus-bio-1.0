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
