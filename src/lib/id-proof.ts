import "server-only";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB — a phone photo comfortably fits
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export type IdProofUpload = {
  /** Prisma's Bytes field maps to Uint8Array, not Node's Buffer subclass. */
  bytes: Uint8Array<ArrayBuffer>;
  mimeType: string;
};

/**
 * Validates and reads an uploaded ID proof photo.
 *
 * The image is kept in the database rather than written to disk: serverless
 * hosting has no persistent filesystem, so anything saved to public/uploads
 * disappears between requests. ID photos are small and rarely read, which
 * makes a column a reasonable home for them.
 */
export async function readIdProofUpload(file: unknown): Promise<IdProofUpload | null> {
  if (!(file instanceof File) || file.size === 0) return null;

  if (!ALLOWED.has(file.type)) {
    throw Object.assign(new Error("ID proof must be a JPG, PNG or WebP image"), { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    throw Object.assign(new Error("ID proof image is too large (max 6 MB)"), { status: 413 });
  }

  return {
    // Explicitly an ArrayBuffer-backed view: Prisma's Bytes field rejects the
    // wider ArrayBufferLike that File.arrayBuffer() is typed as.
    bytes: new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>,
    mimeType: file.type,
  };
}

/** File extension for the download filename, derived from the stored type. */
export function extensionForMimeType(mimeType: string | null): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}
