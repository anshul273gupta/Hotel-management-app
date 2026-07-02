import { getGuestsRegister } from "@/lib/guests";
import { GuestsTable } from "@/components/guests/guests-table";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const guests = await getGuestsRegister();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Guest Register
        </h1>
        <p className="text-sm text-muted-foreground">
          {guests.length} guest{guests.length === 1 ? "" : "s"} on record · search, filter, and review stay history
        </p>
      </div>

      <GuestsTable guests={guests} />
    </div>
  );
}
