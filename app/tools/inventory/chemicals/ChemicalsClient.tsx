"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { THEME } from "../../../../src/theme";
import InventoryTable from "../../../../src/components/inventory/InventoryTable";
import InventoryForm, { type FormField } from "../../../../src/components/inventory/InventoryForm";
import type { TableColumn } from "../../../../src/components/ide/shared/DataTable";

interface Chemical {
  id: string;
  name: string;
  cas_number: string | null;
  molecular_formula: string | null;
  molecular_weight_g_mol: number | null;
  vendor: string | null;
  catalog_number: string | null;
  lot_number: string | null;
  purity_percent: number | null;
  expiry_date: string | null;
  storage_temperature: string | null;
  quantity_remaining: number | null;
  quantity_unit: string | null;
  notes: string | null;
  created_at: string;
}

function getExpiryColor(dateStr: string | null): string {
  if (!dateStr) return THEME.INK_SOFT;
  const now = new Date();
  const expiry = new Date(dateStr);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return THEME.RISK_HIGH; // expired
  if (diffDays < 7) return THEME.RISK_HIGH;
  if (diffDays < 30) return THEME.RISK_LOW;
  return THEME.SUCCESS_HIGH;
}

const FORM_FIELDS: FormField[] = [
  { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. IPTG, Ampicillin" },
  { name: "casNumber", label: "CAS Number", type: "text", placeholder: "e.g. 367-93-1" },
  { name: "vendor", label: "Vendor", type: "text", placeholder: "e.g. Sigma-Aldrich, Thermo" },
  { name: "catalogNumber", label: "Catalog #", type: "text", placeholder: "e.g. I6758" },
  { name: "lotNumber", label: "Lot #", type: "text", placeholder: "e.g. SLCC2045" },
  { name: "purityPercent", label: "Purity %", type: "number", placeholder: "e.g. 99.5" },
  { name: "expiryDate", label: "Expiry Date", type: "text", placeholder: "YYYY-MM-DD" },
  { name: "storageTemperature", label: "Storage Temp", type: "text", placeholder: "e.g. -20C, RT, 4C" },
  { name: "quantityRemaining", label: "Quantity Remaining", type: "number", placeholder: "e.g. 500" },
  { name: "quantityUnit", label: "Unit", type: "select", options: [
    { value: "g", label: "grams (g)" },
    { value: "mg", label: "milligrams (mg)" },
    { value: "kg", label: "kilograms (kg)" },
    { value: "mL", label: "milliliters (mL)" },
    { value: "L", label: "liters (L)" },
    { value: "uL", label: "microliters (uL)" },
  ]},
  { name: "notes", label: "Notes", type: "textarea", placeholder: "Hazard info, SDS notes, etc." },
];

export default function ChemicalsClient() {
  const [items, setItems] = useState<Chemical[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Chemical | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [pubchemQuery, setPubchemQuery] = useState("");
  const [pubchemLoading, setPubchemLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/inventory/chemicals");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch chemicals:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const columns: TableColumn<Chemical>[] = useMemo(
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
        key: "cas_number",
        header: "CAS #",
        render: (val) => (
          <span style={{ fontFamily: THEME.MONO, fontSize: "10px" }}>
            {val ?? "-"}
          </span>
        ),
      },
      { key: "vendor", header: "Vendor" },
      { key: "lot_number", header: "Lot #" },
      {
        key: "purity_percent",
        header: "Purity",
        render: (val) =>
          val ? (
            <span style={{ fontFamily: THEME.MONO, color: THEME.MINT }}>
              {Number(val).toFixed(1)}%
            </span>
          ) : (
            <span style={{ color: THEME.INK_SOFT }}>-</span>
          ),
      },
      {
        key: "expiry_date",
        header: "Expiry",
        render: (val) => {
          if (!val) return <span style={{ color: THEME.INK_SOFT }}>-</span>;
          const color = getExpiryColor(String(val));
          return (
            <span style={{ fontFamily: THEME.MONO, fontSize: "10px", color, fontWeight: 600 }}>
              {new Date(String(val)).toLocaleDateString()}
            </span>
          );
        },
      },
      { key: "storage_temperature", header: "Storage" },
      {
        key: "quantity_remaining",
        header: "Remaining",
        render: (val, row) => {
          const qty = Number(val ?? 0);
          const unit = row.quantity_unit || "g";
          // Simple progress bar based on a heuristic max of 1000
          const pct = Math.min(100, (qty / 1000) * 100);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "100px" }}>
              <div
                style={{
                  flex: 1,
                  height: `${THEME.PROGRESS_HEIGHT}px`,
                  borderRadius: `${THEME.PROGRESS_RADIUS}px`,
                  background: THEME.PROGRESS_TRACK,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: `${THEME.PROGRESS_RADIUS}px`,
                    background: THEME.PROGRESS_GRADIENT,
                    boxShadow: pct > 0 ? THEME.PROGRESS_GLOW : "none",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <span style={{ fontFamily: THEME.MONO, fontSize: "10px", color: THEME.INK_SOFT, whiteSpace: "nowrap" }}>
                {qty} {unit}
              </span>
            </div>
          );
        },
      },
    ],
    []
  );

  const handleAdd = useCallback(() => {
    setEditingItem(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((item: Chemical) => {
    setEditingItem(item);
    setShowForm(true);
  }, []);

  const handlePubChemLookup = useCallback(async () => {
    if (!pubchemQuery.trim()) return;
    setPubchemLoading(true);
    try {
      const res = await fetch(`/api/pubchem?name=${encodeURIComponent(pubchemQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        // Pre-fill form with PubChem data
        if (data.molecularFormula || data.molecularWeight) {
          // We'll apply these when the form opens
        }
      }
    } catch {
      // ignore
    } finally {
      setPubchemLoading(false);
    }
  }, [pubchemQuery]);

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      setFormLoading(true);
      try {
        const url = editingItem
          ? `/api/inventory/chemicals/${editingItem.id}`
          : "/api/inventory/chemicals";
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
      casNumber: editingItem.cas_number || "",
      vendor: editingItem.vendor || "",
      catalogNumber: editingItem.catalog_number || "",
      lotNumber: editingItem.lot_number || "",
      purityPercent: editingItem.purity_percent?.toString() || "",
      expiryDate: editingItem.expiry_date || "",
      storageTemperature: editingItem.storage_temperature || "",
      quantityRemaining: editingItem.quantity_remaining?.toString() || "",
      quantityUnit: editingItem.quantity_unit || "g",
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
          Chemical Inventory
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            color: THEME.INK_SOFT,
          }}
        >
          Track reagents, chemicals, and consumables with expiry monitoring
        </p>
      </div>

      {/* PubChem auto-fill bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: THEME.SP_SM,
          padding: `${THEME.SP_SM}px ${THEME.SP_MD}px`,
          background: THEME.PANEL_STRONG,
          borderRadius: THEME.R_SM,
          border: `1px solid ${THEME.BORDER}`,
        }}
      >
        <span
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_XS,
            color: THEME.INK_SOFT,
            whiteSpace: "nowrap",
          }}
        >
          PubChem lookup:
        </span>
        <input
          type="text"
          value={pubchemQuery}
          onChange={(e) => setPubchemQuery(e.target.value)}
          placeholder="Enter compound name to auto-fill formula and MW"
          style={{
            flex: 1,
            padding: "4px 10px",
            borderRadius: THEME.R_SM,
            border: `1px solid ${THEME.BORDER}`,
            background: THEME.INPUT_BG,
            color: THEME.INPUT_TEXT,
            fontFamily: THEME.SANS,
            fontSize: "11px",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={handlePubChemLookup}
          disabled={pubchemLoading || !pubchemQuery.trim()}
          style={{
            padding: "4px 12px",
            borderRadius: THEME.R_SM,
            border: `1px solid ${THEME.SKY}33`,
            background: `${THEME.SKY}12`,
            color: THEME.SKY,
            fontFamily: THEME.SANS,
            fontSize: "11px",
            fontWeight: 500,
            cursor: pubchemLoading || !pubchemQuery.trim() ? "not-allowed" : "pointer",
            opacity: pubchemLoading || !pubchemQuery.trim() ? 0.5 : 1,
          }}
        >
          {pubchemLoading ? "Looking up..." : "Lookup"}
        </button>
      </div>

      <InventoryTable
        items={items}
        columns={columns}
        onAdd={handleAdd}
        onRowClick={handleEdit}
        searchPlaceholder="Search chemicals by name, CAS number, vendor..."
        emptyMessage="No chemicals yet. Click 'Add Chemical' to get started."
        addLabel="Add Chemical"
        isLoading={isLoading}
      />

      {showForm && (
        <InventoryForm
          title={editingItem ? "Edit Chemical" : "Add Chemical"}
          fields={FORM_FIELDS}
          initialValues={initialFormValues}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
          submitLabel={editingItem ? "Update" : "Add Chemical"}
          isLoading={formLoading}
        />
      )}
    </div>
  );
}
