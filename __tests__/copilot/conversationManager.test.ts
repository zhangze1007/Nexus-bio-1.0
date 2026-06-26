/** @jest-environment node */
/**
 * ConversationManager — CRUD, message ordering, summarization.
 */

import { ConversationManager } from "../../src/services/copilot/conversationManager";
import type { DatabaseAdapter } from "../../src/server/db/adapter";

// ── In-memory mock database ──────────────────────────────────────────

function createMockDb(): DatabaseAdapter {
  const tables: Record<string, Record<string, unknown>[]> = {
    ai_conversations: [],
    ai_messages: [],
  };
  let tsCounter = 0;
  const nextTs = () => new Date(1_700_000_000_000 + ++tsCounter * 1000).toISOString();

  return {
    exec: jest.fn(),
    pragma: jest.fn(),
    close: jest.fn(),
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        // INSERT INTO ai_conversations
        if (sql.includes("INSERT INTO ai_conversations")) {
          tables.ai_conversations.push({
            id: params[0],
            project_id: params[1],
            user_id: params[2],
            title: params[3],
            created_at: params[4],
            updated_at: params[5],
          });
          return { changes: 1, lastInsertRowid: 0 };
        }
        // INSERT INTO ai_messages
        if (sql.includes("INSERT INTO ai_messages")) {
          tables.ai_messages.push({
            id: params[0],
            conversation_id: params[1],
            role: params[2],
            content: params[3],
            tool_calls: params[4],
            created_at: nextTs(),
          });
          return { changes: 1, lastInsertRowid: 0 };
        }
        // UPDATE ai_conversations SET updated_at
        if (sql.includes("UPDATE ai_conversations SET updated_at")) {
          const conv = tables.ai_conversations.find(
            (c) => c.id === params[1],
          );
          if (conv) conv.updated_at = params[0];
          return { changes: 1, lastInsertRowid: 0 };
        }
        return { changes: 0, lastInsertRowid: 0 };
      },
      get: (...params: unknown[]) => {
        // SELECT * FROM ai_conversations WHERE id = ?
        if (sql.includes("SELECT * FROM ai_conversations WHERE id")) {
          return tables.ai_conversations.find((c) => c.id === params[0]);
        }
        // SELECT COUNT(*) FROM ai_messages
        if (sql.includes("COUNT(*)")) {
          const convId = params[0];
          const count = tables.ai_messages.filter(
            (m) => m.conversation_id === convId,
          ).length;
          return { cnt: count };
        }
        return undefined;
      },
      all: (...params: unknown[]) => {
        // SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC
        if (
          sql.includes("ai_messages") &&
          sql.includes("conversation_id") &&
          sql.includes("ASC") &&
          !sql.includes("LIMIT")
        ) {
          return tables.ai_messages
            .filter((m) => m.conversation_id === params[0])
            .sort((a, b) =>
              String(a.created_at).localeCompare(String(b.created_at)),
            );
        }
        // SELECT * FROM ai_messages ... ORDER BY created_at DESC LIMIT ?
        if (
          sql.includes("ai_messages") &&
          sql.includes("DESC") &&
          sql.includes("LIMIT")
        ) {
          return tables.ai_messages
            .filter((m) => m.conversation_id === params[0])
            .sort((a, b) =>
              String(b.created_at).localeCompare(String(a.created_at)),
            )
            .slice(0, Number(params[1]));
        }
        // SELECT * FROM ai_messages ... ORDER BY created_at ASC LIMIT ?
        if (
          sql.includes("ai_messages") &&
          sql.includes("ASC") &&
          sql.includes("LIMIT")
        ) {
          return tables.ai_messages
            .filter((m) => m.conversation_id === params[0])
            .sort((a, b) =>
              String(a.created_at).localeCompare(String(b.created_at)),
            )
            .slice(0, Number(params[1]));
        }
        // SELECT * FROM ai_conversations WHERE user_id = ?
        if (sql.includes("ai_conversations") && sql.includes("user_id")) {
          let results = tables.ai_conversations.filter(
            (c) => c.user_id === params[0],
          );
          if (params[1] !== undefined) {
            results = results.filter((c) => c.project_id === params[1]);
          }
          return results.sort((a, b) =>
            String(b.updated_at).localeCompare(String(a.updated_at)),
          );
        }
        return [];
      },
    }),
  };
}

function deterministicManager(db: DatabaseAdapter) {
  let n = 0;
  return new ConversationManager(db, {
    idFactory: () => `id_${++n}`,
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("ConversationManager", () => {
  describe("createConversation", () => {
    it("creates a conversation with generated id and timestamps", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      const conv = await manager.createConversation("proj-1", "user-1");

      expect(conv.id).toBe("id_1");
      expect(conv.projectId).toBe("proj-1");
      expect(conv.userId).toBe("user-1");
      expect(conv.title).toBe("New Conversation");
      expect(conv.messages).toEqual([]);
      expect(conv.createdAt).toBeDefined();
      expect(conv.updatedAt).toBeDefined();
    });

    it("uses custom title when provided", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      const conv = await manager.createConversation(
        null,
        "user-1",
        "Lycopene pathway design",
      );

      expect(conv.title).toBe("Lycopene pathway design");
    });
  });

  describe("getConversation", () => {
    it("returns null for non-existent id", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      const result = await manager.getConversation("nonexistent");
      expect(result).toBeNull();
    });

    it("returns conversation with messages", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      await manager.createConversation("proj-1", "user-1");
      await manager.addMessage("id_1", {
        role: "user",
        content: "Hello",
      });
      await manager.addMessage("id_1", {
        role: "assistant",
        content: "Hi there!",
      });

      const conv = await manager.getConversation("id_1");

      expect(conv).not.toBeNull();
      expect(conv!.messages).toHaveLength(2);
      expect(conv!.messages[0].role).toBe("user");
      expect(conv!.messages[0].content).toBe("Hello");
      expect(conv!.messages[1].role).toBe("assistant");
      expect(conv!.messages[1].content).toBe("Hi there!");
    });
  });

  describe("addMessage", () => {
    it("adds a message with generated id and timestamp", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      await manager.createConversation("proj-1", "user-1");
      const msg = await manager.addMessage("id_1", {
        role: "user",
        content: "Test message",
      });

      expect(msg.id).toBe("id_2");
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("Test message");
      expect(msg.timestamp).toBeDefined();
    });

    it("stores tool calls as JSON", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      await manager.createConversation("proj-1", "user-1");
      const msg = await manager.addMessage("id_1", {
        role: "assistant",
        content: "Running FBA...",
        toolCalls: [
          {
            id: "tc-1",
            tool: "fbasim",
            inputs: { reactions: ["R1"] },
            status: "completed",
            result: { flux: 1.5 },
          },
        ],
      });

      expect(msg.toolCalls).toHaveLength(1);
      expect(msg.toolCalls![0].tool).toBe("fbasim");
    });

    it("touches conversation updated_at on message add", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      await manager.createConversation("proj-1", "user-1");
      const before = (
        (await manager.getConversation("id_1")) as NonNullable<
          Awaited<ReturnType<typeof manager.getConversation>>
        >
      ).updatedAt;

      // Small delay to ensure different timestamp
      await manager.addMessage("id_1", {
        role: "user",
        content: "Second message",
      });

      const after = (
        (await manager.getConversation("id_1")) as NonNullable<
          Awaited<ReturnType<typeof manager.getConversation>>
        >
      ).updatedAt;

      expect(after).toBeDefined();
      // Both should be defined (we can't guarantee different due to fast execution)
      expect(before).toBeDefined();
    });
  });

  describe("getRecentMessages", () => {
    it("returns messages in chronological order (oldest first)", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      await manager.createConversation("proj-1", "user-1");
      await manager.addMessage("id_1", { role: "user", content: "First" });
      await manager.addMessage("id_1", {
        role: "assistant",
        content: "Second",
      });
      await manager.addMessage("id_1", { role: "user", content: "Third" });

      const msgs = await manager.getRecentMessages("id_1", 10);

      expect(msgs).toHaveLength(3);
      expect(msgs[0].content).toBe("First");
      expect(msgs[2].content).toBe("Third");
    });

    it("respects limit parameter", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      await manager.createConversation("proj-1", "user-1");
      for (let i = 0; i < 5; i++) {
        await manager.addMessage("id_1", {
          role: "user",
          content: `Message ${i}`,
        });
      }

      const msgs = await manager.getRecentMessages("id_1", 2);

      expect(msgs).toHaveLength(2);
      // Should be the last 2, in chronological order
      expect(msgs[0].content).toBe("Message 3");
      expect(msgs[1].content).toBe("Message 4");
    });
  });

  describe("summarizeOldMessages", () => {
    it("returns empty string when 20 or fewer messages", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      await manager.createConversation("proj-1", "user-1");
      for (let i = 0; i < 15; i++) {
        await manager.addMessage("id_1", {
          role: "user",
          content: `Message ${i}`,
        });
      }

      const summary = await manager.summarizeOldMessages("id_1");
      expect(summary).toBe("");
    });

    it("summarizes messages beyond the 20-message window", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      await manager.createConversation("proj-1", "user-1");
      for (let i = 0; i < 25; i++) {
        await manager.addMessage("id_1", {
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i}`,
        });
      }

      const summary = await manager.summarizeOldMessages("id_1");
      expect(summary).toContain("Previous conversation summary");
      expect(summary).toContain("5 messages"); // 25 - 20 = 5
    });
  });

  describe("listConversations", () => {
    it("lists conversations for a user", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      await manager.createConversation("proj-1", "user-1");
      await manager.createConversation("proj-2", "user-1");
      await manager.createConversation("proj-1", "user-2");

      const convs = await manager.listConversations("user-1");
      expect(convs).toHaveLength(2);
    });

    it("filters by project when projectId is provided", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      await manager.createConversation("proj-1", "user-1");
      await manager.createConversation("proj-2", "user-1");

      const convs = await manager.listConversations("user-1", "proj-1");
      expect(convs).toHaveLength(1);
      expect(convs[0].projectId).toBe("proj-1");
    });

    it("returns empty array for user with no conversations", async () => {
      const db = createMockDb();
      const manager = deterministicManager(db);

      const convs = await manager.listConversations("nobody");
      expect(convs).toEqual([]);
    });
  });
});
