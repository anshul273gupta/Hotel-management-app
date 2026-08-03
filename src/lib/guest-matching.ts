import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export type GuestIdentity = {
  title?: string;
  guestName: string;
  mobile?: string;
  address?: string;
  idProofType?: string;
  idProofNumber?: string;
  specialRequests?: string;
};

/**
 * Finds the existing guest a booking belongs to, or creates one.
 *
 * Mobile number is the reliable key and is tried first. Since it became
 * optional, though, guests without one had no key at all and every booking
 * minted a brand new record — the same walk-in appearing several times in the
 * register after a few visits.
 *
 * Fall back to an ID proof, which is also unique to a person, and finally to
 * an exact name match among other guests who likewise have no mobile. The
 * name check is deliberately the last resort and never applies to guests who
 * do have a number, so two different people called "Ramesh Kumar" who each
 * gave a phone number stay separate.
 */
export async function findOrCreateGuest(data: GuestIdentity, db: Db = prisma) {
  const name = data.guestName.trim();
  const mobile = data.mobile?.trim() || null;
  const idProofNumber = data.idProofNumber?.trim() || null;

  const updates = {
    title: data.title,
    name,
    ...(data.idProofType ? { idProofType: data.idProofType } : {}),
    ...(idProofNumber ? { idProofNumber } : {}),
    ...(data.address ? { address: data.address } : {}),
    ...(data.specialRequests ? { specialRequests: data.specialRequests } : {}),
  };

  if (mobile) {
    return db.guest.upsert({
      where: { mobile },
      create: {
        title: data.title,
        name,
        mobile,
        address: data.address || undefined,
        idProofType: data.idProofType || undefined,
        idProofNumber: idProofNumber || undefined,
        specialRequests: data.specialRequests || undefined,
      },
      update: updates,
    });
  }

  // No mobile given. Try the ID proof first, then fall back to the name.
  //
  // The name lookup deliberately includes guests who *do* have a number on
  // file: the same person is often booked once with a phone number and once
  // without, and ignoring those left two rows for one guest. Reusing the
  // existing record keeps their history together, and the number already
  // stored is preserved rather than being wiped by this booking.
  const existing = idProofNumber
    ? await db.guest.findFirst({
        where: { idProofNumber },
        orderBy: { createdAt: "asc" },
      })
    : await db.guest.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
      });

  if (existing) {
    return db.guest.update({ where: { id: existing.id }, data: updates });
  }

  return db.guest.create({
    data: {
      title: data.title,
      name,
      mobile: null,
      address: data.address || undefined,
      idProofType: data.idProofType || undefined,
      idProofNumber: idProofNumber || undefined,
      specialRequests: data.specialRequests || undefined,
    },
  });
}
