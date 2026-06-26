import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name"),
  image: text("image"),
  provider: text("provider"), // 'github' | 'google' | 'email'
  providerId: text("provider_id"),
  institution: text("institution"),
  researchArea: text("research_area"),
  orcid: text("orcid"),
  bio: text("bio"),
  // Future multi-tenancy (nullable now)
  orgId: text("org_id"),
  teamId: text("team_id"),
  // MFA (TOTP) fields
  mfaEnabled: integer("mfa_enabled", { mode: "boolean" }).default(false),
  mfaSecret: text("mfa_secret"), // AES-256-GCM encrypted TOTP secret
  mfaBackupCodes: text("mfa_backup_codes"), // JSON array of SHA-256 hashed backup codes
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
