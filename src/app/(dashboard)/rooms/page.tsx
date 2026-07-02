import { getRoomsWithCurrentBooking } from "@/lib/rooms";
import { RoomGrid } from "@/components/rooms/room-grid";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const rooms = await getRoomsWithCurrentBooking();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Room Inventory
        </h1>
        <p className="text-sm text-muted-foreground">
          {rooms.length} rooms · live status across the property
        </p>
      </div>

      <RoomGrid rooms={rooms} />
    </div>
  );
}
