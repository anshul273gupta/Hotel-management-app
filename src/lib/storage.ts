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
export async function saveUploadedFile(
  file: File,
  folder: "id-proofs" | "service-requests",
): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name) || guessExtension(file.type);
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
