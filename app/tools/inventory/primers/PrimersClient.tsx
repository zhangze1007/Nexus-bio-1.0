"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { THEME } from "../../../../src/theme";
import InventoryTable from "../../../../src/components/inventory/InventoryTable";
import InventoryForm, { type FormField } from "../../../../src/components/inventory/InventoryForm";
import type { TableColumn } from "../../../../src/components/ide/shared/DataTable";

interface Primer {
  id: string;
  name: string;
  sequence_5to3: string;
  length_bp: number | null;
  tm_celsius: number | null;
  gc_percent: number | null;
  target_gene: string | null;
  modification_5prime: string | null;
  vendor: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Calculate melting temperature using the Wallace rule (for short primers <20bp)
 * and the salt-adjusted formula for longer primers.
 * Tm = 2*(A+T) + 4*(G+C) for primers <= 13bp
 * Tm = 64.9 + 41*(G+C-16.4)/(A+T+G+C) for longer primers
 */
function calcTm(seq: string): number {
  const s = seq.toUpperCase().replace(/[^ATGC]/g, "");
  if (s.length === 0) return 0;
  const a = (s.match(/A/g) || []).length;
  const t = (s.match(/T/g) || []).length;
  const g = (s.match(/G/g) || []).length;
  const c = (s.match(/C/g) || []).length;
  const gc = g + c;
  const at = a + t;
  const len = s.length;

  if (len <= 13) {
    return 2 * at + 4 * gc;
  }
  return 64.9 + 41 * (gc - 16.4) / len;
}

function calcGC(seq: string): number {
  const s = seq.toUpperCase().replace(/[^ATGC]/g, "");
  if (s.length === 0) return 0;
  const gc = (s.match(/[GC]/g) || []).length;
  return (gc / s.length) * 100;
}

const FORM_FIELDS: FormField[] = [
  { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. pET28a-F1" },
  {
    name: "sequence5to3",
    label: "Sequence (5' to 3')",
    type: "text",
    required: true,
    placeholder: "e.g. ATGCGATCGATCGATCGA",
    helperText: "DNA sequence. Tm and GC% are auto-calculated.",
  },
  { name: "targetGene", label: "Target Gene", type: "text", placeholder: "e.g. GFP, lacZ" },
  { name: "modification5prime", label: "5' Modification", type: "text", placeholder: "e.g. FAM, biotin, phosphorylation" },
  { name: "vendor", label: "Vendor", type: "text", placeholder: "e.g. IDT, Sigma, Eurofins" },
  { name: "notes", label: "Notes", type: "textarea", placeholder: "Additional notes..." },
];

export default function PrimersClient() {
  const [items, setItems] = useState<Primer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Primer | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/inventory/primers");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch primers:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const columns: TableColumn<Primer>[] = useMemo(
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
      {
        key: "sequence_5to3",
        header: "Sequence",
        render: (val) => {
          const seq = String(val ?? "");
          const truncated = seq.length > 24 ? seq.slice(0, 24) + "..." : seq;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "10px",
                  color: THEME.INK_SOFT,
                  maxWidth: "200px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={seq}
              >
                {truncated}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(seq);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "20px",
                  height: "20px",
                  borderRadius: "4px",
                  border: "none",
                  background: "rgba(255,255,255,0.05)",
                  color: THEME.INK_SOFT,
                  cursor: "pointer",
                  fontSize: "10px",
                  flexShrink: 0,
                }}
                title="Copy sequence"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          );
        },
      },
      {
        key: "length_bp",
        header: "Length",
        render: (val) => (
          <span style={{ fontFamily: THEME.MONO }}>
            {val ?? "-"} bp
          </span>
        ),
      },
      {
        key: "tm_celsius",
        header: "Tm (C)",
        render: (val) => (
          <span style={{ fontFamily: THEME.MONO, color: THEME.APRICOT }}>
            {val ? `${Number(val).toFixed(1)}` : "-"}
          </span>
        ),
      },
      {
        key: "gc_percent",
        header: "GC%",
        render: (val) => (
          <span style={{ fontFamily: THEME.MONO, color: THEME.MINT }}>
            {val ? `${Number(val).toFixed(1)}%` : "-"}
          </span>
        ),
      },
      { key: "target_gene", header: "Target" },
      { key: "modification_5prime", header: "5' Mod" },
      { key: "vendor", header: "Vendor" },
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

  const handleEdit = useCallback((item: Primer) => {
    setEditingItem(item);
    setShowForm(true);
  }, []);

  const handleBulkImport = useCallback(async () => {
    setBulkError("");
    const lines = bulkText.trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
      setBulkError("No data to import");
      return;
    }

    // Parse CSV: name, sequence, target_gene
    const header = lines[0].toLowerCase();
    const startIdx = header.includes("name") ? 1 : 0;
    const primers: Record<string, unknown>[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(",").map((s) => s.trim());
      if (parts.length < 2) continue;

      const seq = parts[1]?.toUpperCase().replace(/[^ATGC]/g, "") || "";
      primers.push({
        name: parts[0],
        sequence5to3: seq,
        lengthBp: seq.length,
        tmCelsius: calcTm(seq),
        gcPercent: calcGC(seq),
        targetGene: parts[2] || "",
      });
    }

    if (primers.length === 0) {
      setBulkError("No valid primers found. Expected: name, sequence, target_gene");
      return;
    }

    // Import each primer
    let imported = 0;
    for (const primer of primers) {
      try {
        const res = await fetch("/api/inventory/primers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(primer),
        });
        if (res.ok) imported++;
      } catch {
        // continue
      }
    }

    setShowBulkImport(false);
    setBulkText("");
    fetchItems();
  }, [bulkText, fetchItems]);

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      setFormLoading(true);
      try {
        // Auto-calculate Tm and GC% from sequence
        const seq = (values.sequence5to3 as string) || "";
        if (seq) {
          values.lengthBp = seq.length;
          values.tmCelsius = calcTm(seq);
          values.gcPercent = calcGC(seq);
        }

        const url = editingItem
          ? `/api/inventory/primers/${editingItem.id}`
          : "/api/inventory/primers";
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
      sequence5to3: editingItem.sequence_5to3 || "",
      targetGene: editingItem.target_gene || "",
      modification5prime: editingItem.modification_5prime || "",
      vendor: editingItem.vendor || "",
      notes: editingItem.notes || "",
    };
  }, [editingItem]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: THEME.SP_LG }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: THEME.SP_MD, flexWrap: "wrap" }}>
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
            Primer Inventory
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              color: THEME.INK_SOFT,
            }}
          >
            Track oligonucleotide primers with auto-calculated Tm and GC%
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBulkImport(!showBulkImport)}
          style={{
            padding: "6px 14px",
            borderRadius: THEME.R_SM,
            border: `1px solid ${THEME.SKY}33`,
            background: `${THEME.SKY}12`,
            color: THEME.SKY,
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Bulk CSV Import
        </button>
      </div>

      {showBulkImport && (
        <div
          style={{
            padding: THEME.SP_MD,
            background: THEME.PANEL_STRONG,
            borderRadius: THEME.R_MD,
            border: `1px solid ${THEME.BORDER}`,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              color: THEME.INK,
              fontWeight: 600,
            }}
          >
            Bulk Import (CSV)
          </p>
          <p
            style={{
              margin: "0 0 8px",
              fontFamily: THEME.MONO,
              fontSize: "10px",
              color: THEME.INK_SOFT,
            }}
          >
            Format: name, sequence, target_gene (one per line. Header row optional.)
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"name,sequence,target_gene\npET28a-F1,ATGCGATCGATCGA,lacZ\npET28a-R1,TCTAGCTAGCTAGC,lacZ"}
            rows={6}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: THEME.R_SM,
              border: `1px solid ${THEME.BORDER}`,
              background: THEME.INPUT_BG,
              color: THEME.INPUT_TEXT,
              fontFamily: THEME.MONO,
              fontSize: "11px",
              outline: "none",
              resize: "vertical",
            }}
          />
          {bulkError && (
            <p style={{ margin: "4px 0 0", color: THEME.CORAL, fontFamily: THEME.SANS, fontSize: "11px" }}>
              {bulkError}
            </p>
          )}
          <div style={{ display: "flex", gap: THEME.SP_SM, marginTop: THEME.SP_SM }}>
            <button
              type="button"
              onClick={handleBulkImport}
              style={{
                padding: "6px 16px",
                borderRadius: THEME.R_SM,
                border: `1px solid ${THEME.MINT}55`,
                background: `${THEME.MINT}20`,
                color: THEME.MINT,
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_SM,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => { setShowBulkImport(false); setBulkText(""); setBulkError(""); }}
              style={{
                padding: "6px 16px",
                borderRadius: THEME.R_SM,
                border: `1px solid ${THEME.BORDER}`,
                background: "transparent",
                color: THEME.INK_SOFT,
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_SM,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <InventoryTable
        items={items}
        columns={columns}
        onAdd={handleAdd}
        onRowClick={handleEdit}
        searchPlaceholder="Search primers by name, sequence, target gene..."
        emptyMessage="No primers yet. Click 'Add Primer' or use bulk CSV import."
        addLabel="Add Primer"
        isLoading={isLoading}
      />

      {showForm && (
        <InventoryForm
          title={editingItem ? "Edit Primer" : "Add Primer"}
          fields={FORM_FIELDS}
          initialValues={initialFormValues}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
          submitLabel={editingItem ? "Update" : "Add Primer"}
          isLoading={formLoading}
        />
      )}
    </div>
  );
}
