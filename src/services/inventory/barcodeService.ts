/**
 * Barcode / QR Code generation service for inventory items.
 *
 * Pure TypeScript -- no external dependencies.
 * Encodes inventory items as "{TYPE}:{id}" strings for barcode scanning,
 * and produces deep-link URLs for QR codes that open the item in Nexus-Bio.
 */

/** Supported inventory item types. */
export type InventoryItemType =
  | "PLASMID"
  | "STRAIN"
  | "CHEMICAL"
  | "PRIMER"
  | "OLIGO"
  | "MEDIA"
  | "EQUIPMENT"
  | "SAMPLE"
  | "OTHER";

/**
 * Generate a barcode data string in "{TYPE}:{id}" format.
 *
 * @param itemType  The inventory item category.
 * @param itemId    The unique item identifier (must be non-empty).
 * @returns A deterministic string suitable for 1-D barcode encoding.
 * @throws {Error} If itemType or itemId is empty / whitespace-only.
 */
export function generateBarcodeData(itemType: InventoryItemType, itemId: string): string {
  const trimmedType = itemType.trim();
  const trimmedId = itemId.trim();

  if (!trimmedType) {
    throw new Error("itemType must be a non-empty string");
  }
  if (!trimmedId) {
    throw new Error("itemId must be a non-empty string");
  }

  return `${trimmedType.toUpperCase()}:${trimmedId}`;
}

/**
 * Generate a deep-link URL for QR code generation.
 *
 * The URL points to the inventory item detail page in the running
 * Nexus-Bio instance. QR code generators can render this URL directly.
 *
 * @param itemType  The inventory item category.
 * @param itemId    The unique item identifier.
 * @returns A full URL string (e.g. "https://nexus-bio-1-0.vercel.app/inventory/PLASMID:pAUR123").
 * @throws {Error} If itemType or itemId is empty / whitespace-only.
 */
export function generateQRUrl(itemType: InventoryItemType, itemId: string): string {
  const barcode = generateBarcodeData(itemType, itemId);
  const base = getBaseUrl();
  return `${base}/inventory/${encodeURIComponent(barcode)}`;
}

/**
 * Parse a barcode data string back into its type and id components.
 *
 * Expects the canonical "{TYPE}:{id}" format produced by
 * {@link generateBarcodeData}. The type portion is normalised to
 * upper-case on return.
 *
 * @param data  The raw barcode string (e.g. from a scanner).
 * @returns An object with `type` and `id` fields.
 * @throws {Error} If the string does not contain a ":" separator, or
 *                 either portion is empty.
 */
export function parseBarcodeData(data: string): {
  type: string;
  id: string;
} {
  const trimmed = data.trim();

  if (!trimmed) {
    throw new Error("Barcode data must be a non-empty string");
  }

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex === -1) {
    throw new Error(`Invalid barcode format: missing ":" separator in "${trimmed}"`);
  }

  const type = trimmed.substring(0, colonIndex).trim();
  const id = trimmed.substring(colonIndex + 1).trim();

  if (!type) {
    throw new Error("Barcode type portion must not be empty");
  }
  if (!id) {
    throw new Error("Barcode id portion must not be empty");
  }

  return { type: type.toUpperCase(), id };
}

/**
 * Derive the application base URL.
 *
 * On the server / during SSR, falls back to the canonical deployment URL.
 * In the browser, uses `window.location.origin`.
 */
function getBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://nexus-bio-1-0.vercel.app";
}

/**
 * Derive a human-readable location code from a barcode data string.
 *
 * Converts "PLASMID:pAUR123" to "PLA-PAUR123" (first 3 chars of type,
 * dash, uppercase id truncated to 12 chars).
 *
 * @param barcodeData  A canonical barcode string from {@link generateBarcodeData}.
 * @returns A short location code suitable for shelf / freezer labels.
 */
export function deriveLocationCode(barcodeData: string): string {
  const { type, id } = parseBarcodeData(barcodeData);
  const prefix = type.substring(0, 3).toUpperCase();
  const shortId = id.toUpperCase().substring(0, 12);
  return `${prefix}-${shortId}`;
}
