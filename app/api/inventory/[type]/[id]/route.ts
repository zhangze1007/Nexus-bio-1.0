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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await params;
    if (!VALID_TYPES.includes(type as InventoryType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const table = TABLE_MAP[type as InventoryType];
    const rows = await sqlAll(`SELECT * FROM ${table} WHERE id = ? AND archived = 0`, [id]);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ item: rows[0] });
  } catch (error) {
    console.error(`[inventory] GET/[id] error:`, error);
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await params;
    if (!VALID_TYPES.includes(type as InventoryType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const table = TABLE_MAP[type as InventoryType];
    const body = await request.json();

    // Check item exists
    const existing = await sqlAll(`SELECT * FROM ${table} WHERE id = ? AND archived = 0`, [id]);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

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

    const setClauses: string[] = ["updated_at = ?"];
    const values: unknown[] = [new Date().toISOString()];

    for (const [field, value] of Object.entries(body)) {
      if (field === "id" || field === "createdAt" || field === "updatedAt" || field === "archived") continue;
      const col = columnMap[field];
      if (col) {
        setClauses.push(`${col} = ?`);
        values.push(typeof value === "object" ? JSON.stringify(value) : value);
      }
    }

    values.push(id);
    const sql = `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = ?`;
    await sqlRun(sql, values);

    const updated = await sqlAll(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return NextResponse.json({ item: updated[0] });
  } catch (error) {
    console.error(`[inventory] PUT error:`, error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await params;
    if (!VALID_TYPES.includes(type as InventoryType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const table = TABLE_MAP[type as InventoryType];

    // Soft delete — set archived=1
    const result = await sqlRun(
      `UPDATE ${table} SET archived = 1, updated_at = ? WHERE id = ? AND archived = 0`,
      [new Date().toISOString(), id]
    );

    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[inventory] DELETE error:`, error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
