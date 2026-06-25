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
