import { NextResponse } from "next/server";
import { sqlAll, sqlRun } from "@/src/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = ["strains", "plasmids", "primers", "chemicals", "locations"] as const;
type InventoryType = (typeof VALID_TYPES)[number];

const TABLE_MAP: Record<InventoryType, string> = {
  strains: "inventory_strains",
  plasmids: "inventory_plasmids",
  primers: "inventory_primers",
  chemicals: "inventory_chemicals",
  locations: "inventory_locations",
};

const SEARCH_COLUMNS: Record<InventoryType, string[]> = {
  strains: ["name", "genotype", "source", "species", "notes"],
  plasmids: ["name", "backbone", "insert_description", "resistance", "promoter", "notes"],
  primers: ["name", "sequence_5to3", "target_gene", "vendor", "notes"],
  chemicals: ["name", "cas_number", "vendor", "catalog_number", "notes"],
  locations: ["name", "type", "notes"],
};

function generateId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    if (!VALID_TYPES.includes(type as InventoryType)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
    }

    const inventoryType = type as InventoryType;
    const table = TABLE_MAP[inventoryType];
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const search = url.searchParams.get("search");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10), 500);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    let sql = `SELECT * FROM ${table} WHERE archived = 0`;
    const args: unknown[] = [];

    if (projectId) {
      sql += ` AND project_id = ?`;
      args.push(projectId);
    }

    if (search) {
      const searchCols = SEARCH_COLUMNS[inventoryType];
      const likeClauses = searchCols.map((col) => `${col} LIKE ?`);
      sql += ` AND (${likeClauses.join(" OR ")})`;
      const searchTerm = `%${search}%`;
      for (let i = 0; i < searchCols.length; i++) {
        args.push(searchTerm);
      }
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    args.push(limit, offset);

    const rows = await sqlAll(sql, args);

    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as total FROM ${table} WHERE archived = 0`;
    const countArgs: unknown[] = [];
    if (projectId) {
      countSql += ` AND project_id = ?`;
      countArgs.push(projectId);
    }
    if (search) {
      const searchCols = SEARCH_COLUMNS[inventoryType];
      const likeClauses = searchCols.map((col) => `${col} LIKE ?`);
      countSql += ` AND (${likeClauses.join(" OR ")})`;
      const searchTerm = `%${search}%`;
      for (let i = 0; i < searchCols.length; i++) {
        countArgs.push(searchTerm);
      }
    }
    const countResult = await sqlAll(countSql, countArgs);
    const total = countResult[0]?.total ?? rows.length;

    return NextResponse.json({ items: rows, total });
  } catch (error) {
    console.error(`[inventory] GET error:`, error);
    return NextResponse.json({ error: "Failed to fetch inventory items" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    if (!VALID_TYPES.includes(type as InventoryType)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
    }

    const inventoryType = type as InventoryType;
    const table = TABLE_MAP[inventoryType];
    const body = await request.json();

    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const id = generateId();
    const now = new Date().toISOString();

    // Build column/value pairs from the body, filtering to known columns
    const columns: string[] = ["id", "created_at", "updated_at", "archived"];
    const placeholders: string[] = ["?", "?", "?", "?"];
    const values: unknown[] = [id, now, now, 0];

    // Map camelCase field names to snake_case column names
    const columnMap: Record<string, string> = {
      name: "name",
      genotype: "genotype",
      species: "species",
      source: "source",
      parentStrainId: "parent_strain_id",
      associatedPlasmidIds: "associated_plasmid_ids",
      freezerLocationId: "freezer_location_id",
      boxPosition: "box_position",
      aliquotCount: "aliquot_count",
      resistanceMarkers: "resistance_markers",
      notes: "notes",
      projectId: "project_id",
      createdBy: "created_by",
      backbone: "backbone",
      insertDescription: "insert_description",
      insertSequence: "insert_sequence",
      insertLengthBp: "insert_length_bp",
      resistance: "resistance",
      copyNumber: "copy_number",
      promoter: "promoter",
      tags: "tags",
      linkedPathwayNode: "linked_pathway_node",
      designSourceTool: "design_source_tool",
      concentrationNgUl: "concentration_ng_ul",
      addgeneId: "addgene_id",
      sequenceVerified: "sequence_verified",
      sequence5to3: "sequence_5to3",
      lengthBp: "length_bp",
      tmCelsius: "tm_celsius",
      gcPercent: "gc_percent",
      targetGene: "target_gene",
      modification5prime: "modification_5prime",
      pairId: "pair_id",
      concentrationUM: "concentration_uM",
      vendor: "vendor",
      casNumber: "cas_number",
      molecularFormula: "molecular_formula",
      molecularWeight: "molecular_weight_g_mol",
      catalogNumber: "catalog_number",
      lotNumber: "lot_number",
      purityPercent: "purity_percent",
      expiryDate: "expiry_date",
      hazardClass: "hazard_class",
      sdsUrl: "sds_url",
      storageTemperature: "storage_temperature",
      quantityRemaining: "quantity_remaining",
      quantityUnit: "quantity_unit",
      reorderThreshold: "reorder_threshold",
      parentId: "parent_id",
      capacity: "capacity",
      currentCount: "current_count",
      temperatureC: "temperature_c",
    };

    for (const [field, value] of Object.entries(body)) {
      if (field === "id" || field === "createdAt" || field === "updatedAt" || field === "archived") continue;
      const col = columnMap[field];
      if (col) {
        columns.push(col);
        placeholders.push("?");
        values.push(typeof value === "object" ? JSON.stringify(value) : value);
      }
    }

    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
    await sqlRun(sql, values);

    // Return the created item
    const created = await sqlAll(`SELECT * FROM ${table} WHERE id = ?`, [id]);

    return NextResponse.json({ item: created[0] }, { status: 201 });
  } catch (error) {
    console.error(`[inventory] POST error:`, error);
    return NextResponse.json({ error: "Failed to create inventory item" }, { status: 500 });
  }
}
