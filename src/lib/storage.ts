import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

/**
 * Saves an uploaded file to local disk under public/uploads/<folder>/.
 * Swap this implementation for an S3/Cloudinary client to move to cloud storage —
 * callers only depend on the returned public URL.
 */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function saveUploadedFile(
  file: File,
  folder: "id-proofs" | "service-requests",
): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error("File is too large (max 8 MB)"), { status: 413 });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw Object.assign(new Error("Only JPG, PNG, WebP or PDF files are allowed"), { status: 415 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Derive the extension from the validated MIME type only. Trusting
  // file.name allowed a caller to smuggle in names like "../../evil.html"
  // and control the written path.
  const ext = guessExtension(file.type);
  const filename = `${randomUUID()}${ext}`;
  const dir = path.join(UPLOAD_ROOT, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  return `/uploads/${folder}/${filename}`;
}

function guessExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
    default:
      return ".jpg";
  }
}
