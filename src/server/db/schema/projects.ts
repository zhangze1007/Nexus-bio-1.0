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
