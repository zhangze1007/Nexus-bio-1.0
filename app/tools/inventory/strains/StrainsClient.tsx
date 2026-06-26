"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { THEME } from "../../../../src/theme";
import InventoryTable from "../../../../src/components/inventory/InventoryTable";
import InventoryForm, { type FormField } from "../../../../src/components/inventory/InventoryForm";
import type { TableColumn } from "../../../../src/components/ide/shared/DataTable";

interface Strain {
  id: string;
  name: string;
  genotype: string | null;
  species: string | null;
  source: string | null;
  aliquot_count: number | null;
  resistance_markers: string | null;
  notes: string | null;
  created_at: string;
}

const FORM_FIELDS: FormField[] = [
  { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. BL21(DE3)" },
  { name: "genotype", label: "Genotype", type: "text", placeholder: "e.g. F- ompT hsdS(rB- mB-) gal dcm" },
  { name: "species", label: "Species", type: "text", placeholder: "E. coli (default)" },
  { name: "source", label: "Source", type: "text", placeholder: "e.g. CGSC, in-house, Addgene" },
  { name: "aliquotCount", label: "Aliquot Count", type: "number", placeholder: "0" },
  { name: "resistanceMarkers", label: "Resistance Markers", type: "text", placeholder: "e.g. kan, amp, cam (comma-separated)", isArray: true, helperText: "Comma-separated list of resistance markers" },
  { name: "notes", label: "Notes", type: "textarea", placeholder: "Additional notes..." },
];

export default function StrainsClient() {
  const [items, setItems] = useState<Strain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Strain | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/inventory/strains");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch strains:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const columns: TableColumn<Strain>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        render: (val) => (
          <span style={{ color: THEME.INK, fontWeight: 600 }}>
            {String(val ?? "")}
          </span>
        ),
      },
      { key: "genotype", header: "Genotype" },
      {
        key: "species",
        header: "Species",
        render: (val) => String(val ?? "E. coli"),
      },
      { key: "source", header: "Source" },
      {
        key: "aliquot_count",
        header: "Aliquots",
        render: (val) => (
          <span style={{ fontFamily: THEME.MONO, color: THEME.MINT }}>
            {val ?? 0}
          </span>
        ),
      },
      {
        key: "resistance_markers",
        header: "Resistance",
        render: (val) => {
          if (!val) return <span style={{ color: THEME.INK_SOFT }}>-</span>;
          let markers: string[];
          try {
            markers = JSON.parse(String(val));
          } catch {
            markers = [String(val)];
          }
          return (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {markers.map((m: string, i: number) => (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: THEME.CHIP_COOL,
                    border: `1px solid ${THEME.CHIP_BORDER}`,
                    color: THEME.CHIP_TEXT,
                    fontFamily: THEME.MONO,
                    fontSize: "10px",
                    fontWeight: 500,
                  }}
                >
                  {m}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        key: "created_at",
        header: "Created",
        render: (val) => (
          <span style={{ fontFamily: THEME.MONO, fontSize: "10px", color: THEME.INK_SOFT }}>
            {val ? new Date(String(val)).toLocaleDateString() : "-"}
          </span>
        ),
      },
    ],
    []
  );

  const handleAdd = useCallback(() => {
    setEditingItem(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((item: Strain) => {
    setEditingItem(item);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    async (item: Strain) => {
      if (!confirm(`Delete strain "${item.name}"?`)) return;
      try {
        const res = await fetch(`/api/inventory/strains/${item.id}`, { method: "DELETE" });
        if (res.ok) fetchItems();
      } catch (err) {
        console.error("Failed to delete:", err);
      }
    },
    [fetchItems]
  );

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      setFormLoading(true);
      try {
        const url = editingItem
          ? `/api/inventory/strains/${editingItem.id}`
          : "/api/inventory/strains";
        const method = editingItem ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });

        if (res.ok) {
          setShowForm(false);
          setEditingItem(null);
          fetchItems();
        }
      } catch (err) {
        console.error("Failed to save:", err);
      } finally {
        setFormLoading(false);
      }
    },
    [editingItem, fetchItems]
  );

  const initialFormValues = useMemo(() => {
    if (!editingItem) return {} as Record<string, string>;
    return {
      name: editingItem.name || "",
      genotype: editingItem.genotype || "",
      species: editingItem.species || "",
      source: editingItem.source || "",
      aliquotCount: editingItem.aliquot_count?.toString() || "",
      resistanceMarkers: (() => {
        if (!editingItem.resistance_markers) return "";
        try {
          return JSON.parse(editingItem.resistance_markers).join(", ");
        } catch {
          return editingItem.resistance_markers;
        }
      })(),
      notes: editingItem.notes || "",
    };
  }, [editingItem]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: THEME.SP_LG }}>
      <div>
        <h2
          style={{
            margin: 0,
            fontFamily: THEME.BRAND,
            fontSize: THEME.FS_XL,
            color: THEME.INK,
            fontWeight: 700,
          }}
        >
          Strain Inventory
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            color: THEME.INK_SOFT,
          }}
        >
          Track bacterial strains, genotypes, and freezer locations
        </p>
      </div>

      <InventoryTable
        items={items}
        columns={columns}
        onAdd={handleAdd}
        onRowClick={handleEdit}
        searchPlaceholder="Search strains by name, genotype, source..."
        emptyMessage="No strains yet. Click 'Add Strain' to get started."
        addLabel="Add Strain"
        isLoading={isLoading}
      />

      {/* Row actions */}
      {items.length > 0 && (
        <div
          style={{
            fontFamily: THEME.SANS,
            fontSize: "10px",
            color: THEME.INK_SOFT,
            textAlign: "center",
          }}
        >
          Click a row to edit. Press Delete in the edit form to remove.
        </div>
      )}

      {showForm && (
        <InventoryForm
          title={editingItem ? "Edit Strain" : "Add Strain"}
          fields={FORM_FIELDS}
          initialValues={initialFormValues}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
          submitLabel={editingItem ? "Update" : "Add Strain"}
          isLoading={formLoading}
        />
      )}
    </div>
  );
}
