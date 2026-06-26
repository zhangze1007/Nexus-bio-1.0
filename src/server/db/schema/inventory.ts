import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const inventoryStrains = sqliteTable("inventory_strains", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  genotype: text("genotype"),
  species: text("species").default("E. coli"),
  source: text("source"),
  parentStrainId: text("parent_strain_id"),
  associatedPlasmidIds: text("associated_plasmid_ids"), // JSON array
  freezerLocationId: text("freezer_location_id"),
  boxPosition: text("box_position"),
  aliquotCount: integer("aliquot_count").default(0),
  resistanceMarkers: text("resistance_markers"), // JSON array
  notes: text("notes"),
  projectId: text("project_id"),
  createdBy: text("created_by"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  archived: integer("archived").default(0),
});

export const inventoryPlasmids = sqliteTable("inventory_plasmids", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  backbone: text("backbone"),
  insertDescription: text("insert_description"),
  insertSequence: text("insert_sequence"),
  insertLengthBp: integer("insert_length_bp"),
  resistance: text("resistance"),
  copyNumber: text("copy_number"),
  promoter: text("promoter"),
  tags: text("tags"), // JSON array
  linkedPathwayNode: text("linked_pathway_node"),
  designSourceTool: text("design_source_tool"),
  freezerLocationId: text("freezer_location_id"),
  concentrationNgUl: real("concentration_ng_ul"),
  addgeneId: text("addgene_id"),
  sequenceVerified: integer("sequence_verified").default(0),
  notes: text("notes"),
  projectId: text("project_id"),
  createdBy: text("created_by"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  archived: integer("archived").default(0),
});

export const inventoryPrimers = sqliteTable("inventory_primers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sequence5to3: text("sequence_5to3").notNull(),
  lengthBp: integer("length_bp"),
  tmCelsius: real("tm_celsius"),
  gcPercent: real("gc_percent"),
  targetGene: text("target_gene"),
  modification5prime: text("modification_5prime"),
  pairId: text("pair_id"),
  concentrationUM: real("concentration_uM"),
  vendor: text("vendor"),
  notes: text("notes"),
  projectId: text("project_id"),
  createdBy: text("created_by"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  archived: integer("archived").default(0),
});

export const inventoryChemicals = sqliteTable("inventory_chemicals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  casNumber: text("cas_number"),
  molecularFormula: text("molecular_formula"),
  molecularWeight: real("molecular_weight_g_mol"),
  vendor: text("vendor"),
  catalogNumber: text("catalog_number"),
  lotNumber: text("lot_number"),
  purityPercent: real("purity_percent"),
  expiryDate: text("expiry_date"),
  hazardClass: text("hazard_class"), // JSON array
  sdsUrl: text("sds_url"),
  storageTemperature: text("storage_temperature"),
  quantityRemaining: real("quantity_remaining"),
  quantityUnit: text("quantity_unit"),
  reorderThreshold: real("reorder_threshold"),
  notes: text("notes"),
  projectId: text("project_id"),
  createdBy: text("created_by"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  archived: integer("archived").default(0),
});

export const inventoryLocations = sqliteTable("inventory_locations", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  type: text("type").notNull(), // building, room, freezer, shelf, box, position
  name: text("name").notNull(),
  capacity: integer("capacity"),
  currentCount: integer("current_count").default(0),
  temperatureC: real("temperature_c"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});
