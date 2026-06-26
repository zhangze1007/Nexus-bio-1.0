import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const aiConversations = sqliteTable("ai_conversations", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  userId: text("user_id"),
  title: text("title"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const aiMessages = sqliteTable("ai_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  toolCalls: text("tool_calls"), // JSON
  tokenUsage: text("token_usage"), // JSON {input, output}
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const aiUsage = sqliteTable("ai_usage", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  orgId: text("org_id"),
  date: text("date").notNull(), // YYYY-MM-DD
  model: text("model"),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  costUsd: real("cost_usd").default(0),
  requestType: text("request_type"), // analyze, plan, classify, rag
});
