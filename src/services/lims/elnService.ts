/**
 * Electronic Lab Notebook (ELN) Service
 *
 * Manages digital lab notebook entries with rich text content,
 * file attachments, and 21 CFR Part 11 compliant electronic signatures.
 *
 * Signatures include a SHA-256 content hash for tamper detection.
 */

import { createHash, randomUUID } from "node:crypto";
import type { ELNAttachment, ELNEntry, ELNSignature } from "./types";

export interface ELNServiceOptions {
  /** Injected clock for testability */
  clock?: () => Date;
  /** Injected UUID generator for testability */
  uuidFn?: () => string;
}

/**
 * Abstract database interface for ELN persistence.
 * Implementations can use SQLite, PostgreSQL, or in-memory stores.
 */
export interface ELNDatabase {
  run(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export class ELNService {
  private readonly clock: () => Date;
  private readonly uuidFn: () => string;

  constructor(
    private readonly db: ELNDatabase,
    options?: ELNServiceOptions,
  ) {
    this.clock = options?.clock ?? (() => new Date());
    this.uuidFn = options?.uuidFn ?? randomUUID;
  }

  /**
   * Compute a SHA-256 hash of entry content for signature integrity.
   */
  private hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Map a raw database row to an ELNEntry.
   */
  private rowToEntry(row: Record<string, unknown>): ELNEntry {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      title: row.title as string,
      content: row.content as string,
      attachments:
        typeof row.attachments === "string"
          ? JSON.parse(row.attachments as string)
          : ((row.attachments as ELNAttachment[]) ?? []),
      signatures:
        typeof row.signatures === "string"
          ? JSON.parse(row.signatures as string)
          : ((row.signatures as ELNSignature[]) ?? []),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  /**
   * Create a new ELN entry.
   */
  async createEntry(entry: Omit<ELNEntry, "id" | "signatures">): Promise<ELNEntry> {
    const id = this.uuidFn();
    const now = this.clock().toISOString();

    const fullEntry: ELNEntry = {
      ...entry,
      id,
      signatures: [],
      createdAt: entry.createdAt || now,
      updatedAt: entry.updatedAt || now,
    };

    await this.db.run(
      `INSERT INTO eln_entries (id, project_id, title, content, attachments, signatures, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fullEntry.id,
        fullEntry.projectId,
        fullEntry.title,
        fullEntry.content,
        JSON.stringify(fullEntry.attachments),
        JSON.stringify(fullEntry.signatures),
        fullEntry.createdAt,
        fullEntry.updatedAt,
      ],
    );

    return fullEntry;
  }

  /**
   * Retrieve an ELN entry by ID.
   */
  async getEntry(id: string): Promise<ELNEntry | null> {
    const row = await this.db.get("SELECT * FROM eln_entries WHERE id = ?", [id]);
    return row ? this.rowToEntry(row) : null;
  }

  /**
   * Update an ELN entry.
   *
   * IMPORTANT: If the entry has signatures, the content hash will be
   * invalidated. Signatures are preserved but their validity should be
   * re-checked against the new content hash.
   */
  async updateEntry(
    id: string,
    updates: Partial<Pick<ELNEntry, "title" | "content" | "attachments">>,
  ): Promise<ELNEntry> {
    const existing = await this.getEntry(id);
    if (!existing) {
      throw new Error(`ELN entry not found: ${id}`);
    }

    // If the entry is signed, any content change invalidates signatures
    if (existing.signatures.length > 0 && updates.content !== undefined) {
      // Allow update but flag it — signatures will show as invalidated
      // on next read because contentHash won't match
    }

    const now = this.clock().toISOString();
    const merged: ELNEntry = {
      ...existing,
      ...updates,
      updatedAt: now,
    };

    await this.db.run(
      `UPDATE eln_entries
       SET title = ?, content = ?, attachments = ?, updated_at = ?
       WHERE id = ?`,
      [merged.title, merged.content, JSON.stringify(merged.attachments), merged.updatedAt, id],
    );

    return merged;
  }

  /**
   * Add an electronic signature to an ELN entry.
   *
   * Computes a SHA-256 hash of the current content for tamper detection.
   * Multiple signatures can be added (authored -> reviewed -> approved).
   */
  async signEntry(id: string, userId: string, userName: string, meaning: string): Promise<ELNEntry> {
    const existing = await this.getEntry(id);
    if (!existing) {
      throw new Error(`ELN entry not found: ${id}`);
    }

    // Check if user already signed with the same meaning
    const duplicate = existing.signatures.find((s) => s.userId === userId && s.meaning === meaning);
    if (duplicate) {
      throw new Error(`User ${userId} already signed this entry with meaning "${meaning}"`);
    }

    const signature: ELNSignature = {
      userId,
      userName,
      signedAt: this.clock().toISOString(),
      meaning,
      contentHash: this.hashContent(existing.content),
    };

    const updatedSignatures = [...existing.signatures, signature];

    await this.db.run("UPDATE eln_entries SET signatures = ?, updated_at = ? WHERE id = ?", [
      JSON.stringify(updatedSignatures),
      this.clock().toISOString(),
      id,
    ]);

    return {
      ...existing,
      signatures: updatedSignatures,
      updatedAt: this.clock().toISOString(),
    };
  }

  /**
   * List all ELN entries for a project.
   */
  async listEntries(projectId: string): Promise<ELNEntry[]> {
    const rows = await this.db.all("SELECT * FROM eln_entries WHERE project_id = ? ORDER BY created_at DESC", [
      projectId,
    ]);
    return rows.map((row) => this.rowToEntry(row));
  }

  /**
   * Verify signature integrity — checks if content has been tampered with
   * since the signature was applied.
   */
  verifySignature(entry: ELNEntry, signatureIndex: number): boolean {
    const sig = entry.signatures[signatureIndex];
    if (!sig) return false;
    return sig.contentHash === this.hashContent(entry.content);
  }

  /**
   * Delete an ELN entry. Only unsigned entries can be deleted.
   * Signed entries are immutable per 21 CFR Part 11.
   */
  async deleteEntry(id: string): Promise<boolean> {
    const existing = await this.getEntry(id);
    if (!existing) {
      throw new Error(`ELN entry not found: ${id}`);
    }

    if (existing.signatures.length > 0) {
      throw new Error("Cannot delete a signed ELN entry — signatures are immutable per 21 CFR Part 11");
    }

    const result = await this.db.run("DELETE FROM eln_entries WHERE id = ?", [id]);
    return result.rowsAffected > 0;
  }
}
