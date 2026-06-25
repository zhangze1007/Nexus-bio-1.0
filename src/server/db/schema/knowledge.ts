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
