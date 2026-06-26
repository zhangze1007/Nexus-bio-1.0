import { NextResponse } from "next/server";
import { sqlAll } from "@/src/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEARCH_TARGETS = [
  {
    type: "strains",
    table: "inventory_strains",
    columns: ["name", "genotype", "source", "species"],
  },
  {
    type: "plasmids",
    table: "inventory_plasmids",
    columns: ["name", "backbone", "insert_description", "resistance"],
  },
  {
    type: "primers",
    table: "inventory_primers",
    columns: ["name", "sequence_5to3", "target_gene"],
  },
  {
    type: "chemicals",
    table: "inventory_chemicals",
    columns: ["name", "cas_number", "vendor"],
  },
] as const;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    const projectId = url.searchParams.get("projectId");

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ results: {} });
    }

    const searchTerm = `%${q.trim()}%`;
    const results: Record<string, unknown[]> = {};

    await Promise.all(
      SEARCH_TARGETS.map(async (target) => {
        let sql = `SELECT *, '${target.type}' as _type FROM ${target.table} WHERE archived = 0`;
        const args: unknown[] = [];

        const likeClauses = target.columns.map((col) => `${col} LIKE ?`);
        sql += ` AND (${likeClauses.join(" OR ")})`;
        for (let i = 0; i < target.columns.length; i++) {
          args.push(searchTerm);
        }

        if (projectId) {
          sql += ` AND project_id = ?`;
          args.push(projectId);
        }

        sql += ` LIMIT 20`;

        const rows = await sqlAll(sql, args);
        results[target.type] = rows;
      })
    );

    return NextResponse.json({ results, query: q.trim() });
  } catch (error) {
    console.error(`[inventory/search] error:`, error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
