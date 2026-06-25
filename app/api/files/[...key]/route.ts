import { type NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../src/lib/auth";
import { getDownloadUrl } from "../../../../src/utils/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/files/[...key] — Generate a pre-signed download URL.
 *
 * Uses a catch-all route because R2 keys contain slashes:
 *   projectId/category/timestamp_filename
 *
 * Auth: Session cookie (Auth.js) required.
 *
 * Returns: { downloadUrl }
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ key: string[] }> },
) {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { key: keySegments } = await params;

	if (!keySegments || keySegments.length === 0) {
		return NextResponse.json(
			{ error: "File key is required" },
			{ status: 400 },
		);
	}

	// Reconstruct the full key from catch-all segments
	const decodedKey = keySegments.map((s) => decodeURIComponent(s)).join("/");

	try {
		const downloadUrl = await getDownloadUrl(decodedKey);
		return NextResponse.json({ downloadUrl });
	} catch (err) {
		console.error("Failed to generate download URL:", err);
		return NextResponse.json(
			{ error: "Failed to generate download URL" },
			{ status: 500 },
		);
	}
}
