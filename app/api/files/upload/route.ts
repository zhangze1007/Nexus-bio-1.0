import { type NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../src/lib/auth";
import { buildFileKey, getUploadUrl } from "../../../../src/utils/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Allowed MIME types for scientific file uploads.
 * Covers common bioinformatics and scientific formats.
 */
const ALLOWED_TYPES = new Set([
	// Text / data
	"text/plain",
	"text/csv",
	"text/tab-separated-values",
	"application/json",
	"application/xml",
	"text/xml",
	// Bioinformatics formats
	"chemical/x-fasta",
	"chemical/x-genbank",
	"chemical/x-pdb",
	"chemical/x-xyz",
	"chemical/x-mdl-molfile",
	"chemical/x-sdf",
	// Standard document / image
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/svg+xml",
	// Generic binary (for compressed archives)
	"application/gzip",
	"application/zip",
	"application/x-tar",
]);

/**
 * File extension to MIME type mapping for common bioinformatics formats.
 * Used as fallback when the browser sends a generic type.
 */
const EXTENSION_TYPES: Record<string, string> = {
	".fasta": "chemical/x-fasta",
	".fa": "chemical/x-fasta",
	".fna": "chemical/x-fasta",
	".faa": "chemical/x-fasta",
	".gb": "chemical/x-genbank",
	".gbk": "chemical/x-genbank",
	".genbank": "chemical/x-genbank",
	".pdb": "chemical/x-pdb",
	".xyz": "chemical/x-xyz",
	".mol": "chemical/x-mdl-molfile",
	".sdf": "chemical/x-sdf",
	".csv": "text/csv",
	".tsv": "text/tab-separated-values",
	".json": "application/json",
	".xml": "application/xml",
	".pdf": "application/pdf",
	".gz": "application/gzip",
	".zip": "application/zip",
};

function inferContentType(filename: string, provided: string): string {
	// If the provided type is already specific (not generic), use it
	if (ALLOWED_TYPES.has(provided) && !provided.startsWith("application/octet-stream")) {
		return provided;
	}

	// Try to infer from extension
	const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
	return EXTENSION_TYPES[ext] || provided;
}

/**
 * POST /api/files/upload — Generate a pre-signed upload URL.
 *
 * Auth: Session cookie (Auth.js) required.
 *
 * Body: { filename, contentType, projectId?, category? }
 * Returns: { uploadUrl, key }
 */
export async function POST(request: NextRequest) {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let body: {
		filename?: string;
		contentType?: string;
		projectId?: string;
		category?: string;
	};
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { filename, projectId, category } = body;
	let { contentType } = body;

	if (!filename || typeof filename !== "string") {
		return NextResponse.json(
			{ error: "filename is required" },
			{ status: 400 },
		);
	}

	if (!contentType || typeof contentType !== "string") {
		return NextResponse.json(
			{ error: "contentType is required" },
			{ status: 400 },
		);
	}

	// Infer content type from extension if browser sent a generic type
	contentType = inferContentType(filename, contentType);

	// Validate content type
	if (!ALLOWED_TYPES.has(contentType) && !contentType.startsWith("text/")) {
		return NextResponse.json(
			{
				error: "Unsupported file type",
				allowed: Array.from(ALLOWED_TYPES),
			},
			{ status: 400 },
		);
	}

	// Build object key: {projectId}/{category}/{timestamp}_{sanitizedFilename}
	const key = buildFileKey(
		projectId || session.user.id,
		category || "uploads",
		filename,
	);

	try {
		const uploadUrl = await getUploadUrl(key, contentType);
		return NextResponse.json({ uploadUrl, key });
	} catch (err) {
		console.error("Failed to generate upload URL:", err);
		return NextResponse.json(
			{ error: "Failed to generate upload URL" },
			{ status: 500 },
		);
	}
}
