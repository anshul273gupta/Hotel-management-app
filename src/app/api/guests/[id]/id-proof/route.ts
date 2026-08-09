import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { extensionForMimeType } from "@/lib/id-proof";

/**
 * Serves one of a guest's ID proof photos.
 *
 *   ?i=0          which photo (defaults to the first)
 *   ?download=1   send as an attachment rather than displaying inline
 *
 * Staff-only: this is identity documentation and must never be reachable from
 * the guest-facing QR pages.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const index = Math.max(0, Number(url.searchParams.get("i") ?? "0") || 0);

  const guest = await prisma.guest.findUnique({
    where: { id },
    select: {
      name: true,
      idProofImage: true,
      idProofMimeType: true,
      idProofs: {
        orderBy: { createdAt: "asc" },
        select: { image: true, mimeType: true },
      },
    },
  });
  if (!guest) {
    return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  }

  // Photos captured before multi-image support live on the guest row itself.
  const legacy =
    guest.idProofImage && guest.idProofs.length === 0
      ? [{ image: guest.idProofImage, mimeType: guest.idProofMimeType ?? "image/jpeg" }]
      : [];
  const photos = guest.idProofs.length > 0 ? guest.idProofs : legacy;
  const photo = photos[index];

  if (!photo) {
    return NextResponse.json({ error: "No ID proof on file for this guest" }, { status: 404 });
  }

  const wantsDownload = url.searchParams.get("download") === "1";
  const safeName = guest.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
  const suffix = photos.length > 1 ? `-${index + 1}` : "";
  const filename = `id-proof-${safeName}${suffix}.${extensionForMimeType(photo.mimeType)}`;

  return new NextResponse(new Uint8Array(photo.image), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Disposition": `${wantsDownload ? "attachment" : "inline"}; filename="${filename}"`,
      // Identity documents shouldn't sit in shared caches.
      "Cache-Control": "private, no-store",
    },
  });
}
