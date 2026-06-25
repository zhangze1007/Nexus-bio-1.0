import { type NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../src/lib/auth";
import { getDownloadUrl } from "../../../../src/utils/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/files/[key] — Generate a pre-signed download URL.
 *
 * The `[key]` param is the URL-encoded object key in R2.
 * Since keys contain slashes (projectId/category/timestamp_filename),
 * the key is captured as a catch-all segment.
 *
 * Auth: Session cookie (Auth.js) required.
 *
 * Returns: { downloadUrl }
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ key: string }> },
) {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { key } = await params;

	if (!key) {
		return NextResponse.json(
			{ error: "File key is required" },
			{ status: 400 },
		);
	}

	// Decode the key (may contain URL-encoded slashes and special chars)
	const decodedKey = decodeURIComponent(key);

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
