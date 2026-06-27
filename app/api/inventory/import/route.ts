import { NextResponse } from "next/server";
import {
  importPrimersFromCSV,
  importStrainsFromCSV,
  importPlasmidsFromCSV,
} from "@/src/services/inventory/inventoryImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = ["primers", "strains", "plasmids"] as const;
type ImportType = (typeof VALID_TYPES)[number];

const IMPORTERS: Record<
  ImportType,
  (csv: string, projectId: string, userId: string) => Promise<{ imported: number; skipped: number; errors: string[] }>
> = {
  primers: importPrimersFromCSV,
  strains: importStrainsFromCSV,
  plasmids: importPlasmidsFromCSV,
};

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 },
      );
    }

    const body = await request.json();
    const { csvContent, type, projectId, createdBy } = body as {
      csvContent?: string;
      type?: string;
      projectId?: string;
      createdBy?: string;
    };

    // Validate type
    if (!type || !VALID_TYPES.includes(type as ImportType)) {
      return NextResponse.json(
        {
          error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Validate csvContent
    if (!csvContent || typeof csvContent !== "string" || csvContent.trim() === "") {
      return NextResponse.json(
        { error: "csvContent is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    // Validate projectId and createdBy (now required)
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }
    if (!createdBy || typeof createdBy !== "string") {
      return NextResponse.json(
        { error: "createdBy is required" },
        { status: 400 },
      );
    }

    const importer = IMPORTERS[type as ImportType];
    const result = await importer(csvContent, projectId, createdBy);

    const status = result.errors.length > 0 && result.imported === 0 ? 422 : 200;

    return NextResponse.json(result, { status });
  } catch (error) {
    console.error("[inventory/import] POST error:", error);
    return NextResponse.json(
      { error: "Failed to import inventory data" },
      { status: 500 },
    );
  }
}
