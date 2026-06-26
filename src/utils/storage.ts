import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 file storage utility.
 *
 * R2 is S3-compatible, so we use the AWS SDK with a custom endpoint.
 * Pre-signed URLs allow clients to upload/download directly to R2
 * without routing file bytes through our server.
 *
 * Required env vars:
 *   R2_ENDPOINT          — e.g. https://xxx.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET            — bucket name (default: nexus-bio-files)
 */

function getS3Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
}

function getBucket(): string {
  return process.env.R2_BUCKET || "nexus-bio-files";
}

/**
 * Generate a pre-signed URL for uploading a file to R2.
 *
 * @param key         — Object key (path) in the bucket
 * @param contentType — MIME type of the file
 * @param expiresIn   — URL validity in seconds (default: 3600 = 1 hour)
 * @returns Pre-signed PUT URL
 */
export async function getUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

/**
 * Generate a pre-signed URL for downloading a file from R2.
 *
 * @param key       — Object key (path) in the bucket
 * @param expiresIn — URL validity in seconds (default: 3600 = 1 hour)
 * @returns Pre-signed GET URL
 */
export async function getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

/**
 * Delete a file from R2.
 *
 * @param key — Object key (path) in the bucket
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  await getS3Client().send(command);
}

/**
 * Build a content-addressed file key for R2.
 *
 * Format: {projectId}/{category}/{timestamp}_{sanitizedFilename}
 *
 * @param projectId — Project identifier (or 'default')
 * @param category  — File category (e.g. 'fasta', 'genbank', 'pdb', 'uploads')
 * @param filename  — Original filename (will be sanitized)
 * @returns Object key for R2
 */
export function buildFileKey(projectId: string, category: string, filename: string): string {
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${projectId}/${category}/${timestamp}_${safeName}`;
}
