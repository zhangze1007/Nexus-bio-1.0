import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const experiments = sqliteTable("experiments", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  tool: text("tool").notNull(), // tool ID from toolRegistry.ts
  inputJson: text("input_json"), // JSON string of inputs
  outputJson: text("output_json"), // JSON string of outputs
  status: text("status").default("pending"), // pending, running, completed, failed
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  createdBy: text("created_by"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const experimentArtifacts = sqliteTable("experiment_artifacts", {
  id: text("id").primaryKey(),
  experimentId: text("experiment_id").notNull(),
  type: text("type").notNull(), // 'result', 'visualization', 'export', 'file'
  name: text("name"),
  path: text("path"), // R2 key or local path
  sizeBytes: integer("size_bytes"),
  mimeType: text("mime_type"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;
