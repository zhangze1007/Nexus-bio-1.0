"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { THEME } from "../../../../src/theme";
import InventoryTable from "../../../../src/components/inventory/InventoryTable";
import InventoryForm, { type FormField } from "../../../../src/components/inventory/InventoryForm";
import type { TableColumn } from "../../../../src/components/ide/shared/DataTable";

interface Plasmid {
  id: string;
  name: string;
  backbone: string | null;
  insert_description: string | null;
  resistance: string | null;
  copy_number: string | null;
  promoter: string | null;
  sequence_verified: number | null;
  linked_pathway_node: string | null;
  notes: string | null;
  created_at: string;
}

const FORM_FIELDS: FormField[] = [
  { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. pET28a-GFP" },
  { name: "backbone", label: "Backbone", type: "text", placeholder: "e.g. pET28a, pUC19" },
  { name: "insertDescription", label: "Insert Description", type: "text", placeholder: "e.g. sfGFP codon-optimized" },
  { name: "resistance", label: "Resistance", type: "text", placeholder: "e.g. kan, amp" },
  { name: "copyNumber", label: "Copy Number", type: "text", placeholder: "e.g. high, low, p15A" },
  { name: "promoter", label: "Promoter", type: "text", placeholder: "e.g. T7, lac, araBAD" },
  { name: "sequenceVerified", label: "Sequence Verified", type: "select", options: [
    { value: "1", label: "Yes" },
    { value: "0", label: "No" },
  ]},
  { name: "linkedPathwayNode", label: "Linked Pathway Node", type: "text", placeholder: "Pathway node ID (optional)" },
  { name: "notes", label: "Notes", type: "textarea", placeholder: "Additional notes..." },
];

export default function PlasmidsClient() {
  const [items, setItems] = useState<Plasmid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Plasmid | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/inventory/plasmids");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch plasmids:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const columns: TableColumn<Plasmid>[] = useMemo(
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
      { key: "backbone", header: "Backbone" },
      { key: "insert_description", header: "Insert" },
      { key: "resistance", header: "Resistance" },
      { key: "copy_number", header: "Copy #" },
      { key: "promoter", header: "Promoter" },
      {
        key: "sequence_verified",
        header: "Verified",
        render: (val) =>
          val ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                color: THEME.SUCCESS_HIGH,
                fontFamily: THEME.MONO,
                fontSize: "10px",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Yes
            </span>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                color: THEME.RISK_LOW,
                fontFamily: THEME.MONO,
                fontSize: "10px",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              No
            </span>
          ),
      },
      {
        key: "linked_pathway_node",
        header: "Pathway Link",
        render: (val) => {
          if (!val) return <span style={{ color: THEME.INK_SOFT }}>-</span>;
          return (
            <Link
              href="/tools/pathd"
              style={{
                color: THEME.SKY,
                fontFamily: THEME.MONO,
                fontSize: "10px",
                textDecoration: "none",
              }}
            >
              {String(val)}
            </Link>
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

  const handleEdit = useCallback((item: Plasmid) => {
    setEditingItem(item);
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      setFormLoading(true);
      try {
        const url = editingItem
          ? `/api/inventory/plasmids/${editingItem.id}`
          : "/api/inventory/plasmids";
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
      backbone: editingItem.backbone || "",
      insertDescription: editingItem.insert_description || "",
      resistance: editingItem.resistance || "",
      copyNumber: editingItem.copy_number || "",
      promoter: editingItem.promoter || "",
      sequenceVerified: editingItem.sequence_verified?.toString() || "0",
      linkedPathwayNode: editingItem.linked_pathway_node || "",
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
          Plasmid Inventory
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            color: THEME.INK_SOFT,
          }}
        >
          Track plasmid constructs, backbones, and sequence verification status
        </p>
      </div>

      <InventoryTable
        items={items}
        columns={columns}
        onAdd={handleAdd}
        onRowClick={handleEdit}
        searchPlaceholder="Search plasmids by name, backbone, insert..."
        emptyMessage="No plasmids yet. Click 'Add Plasmid' to get started."
        addLabel="Add Plasmid"
        isLoading={isLoading}
      />

      {showForm && (
        <InventoryForm
          title={editingItem ? "Edit Plasmid" : "Add Plasmid"}
          fields={FORM_FIELDS}
          initialValues={initialFormValues}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
          submitLabel={editingItem ? "Update" : "Add Plasmid"}
          isLoading={formLoading}
        />
      )}
    </div>
  );
}
