import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { extensionForMimeType } from "@/lib/id-proof";

/**
 * Serves a guest's ID proof photo.
 *
 * Add ?download=1 to get it as a file attachment rather than displayed inline,
 * so staff can save a copy for the register.
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
  const guest = await prisma.guest.findUnique({
    where: { id },
    select: { name: true, idProofImage: true, idProofMimeType: true },
  });

  if (!guest?.idProofImage) {
    return NextResponse.json({ error: "No ID proof on file for this guest" }, { status: 404 });
  }

  const mimeType = guest.idProofMimeType ?? "image/jpeg";
  const wantsDownload = new URL(request.url).searchParams.get("download") === "1";
  const safeName = guest.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
  const filename = `id-proof-${safeName}.${extensionForMimeType(guest.idProofMimeType)}`;

  return new NextResponse(new Uint8Array(guest.idProofImage), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${wantsDownload ? "attachment" : "inline"}; filename="${filename}"`,
      // Identity documents shouldn't sit in shared caches.
      "Cache-Control": "private, no-store",
    },
  });
}
