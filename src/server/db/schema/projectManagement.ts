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
