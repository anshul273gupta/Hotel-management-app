-- CreateTable
CREATE TABLE "guest_id_proofs" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "image" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_id_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_id_proofs_guestId_idx" ON "guest_id_proofs"("guestId");

-- AddForeignKey
ALTER TABLE "guest_id_proofs" ADD CONSTRAINT "guest_id_proofs_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
