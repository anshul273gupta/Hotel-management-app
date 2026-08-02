import { getAvailableRooms, getAvailableRoomsForRange } from "@/lib/rooms";
import { CheckInForm } from "@/components/checkin/checkin-form";
import { ReservationForm } from "@/components/checkin/reservation-form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; tab?: string }>;
}) {
  // The Rooms page links here with ?room=<id> so the room is already chosen.
  const { room: preselectRoomId } = await searchParams;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [rooms, reservationRooms] = await Promise.all([
    getAvailableRooms(),
    getAvailableRoomsForRange(today, tomorrow),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Check-in &amp; Booking
        </h1>
        <p className="text-sm text-muted-foreground">
          {rooms.length} room{rooms.length === 1 ? "" : "s"} available · check guests in instantly or create an advance booking
        </p>
      </div>

      <Tabs defaultValue="walkin">
        <TabsList>
          <TabsTrigger value="walkin">Walk-in Check-in</TabsTrigger>
          <TabsTrigger value="booking">Advance Booking</TabsTrigger>
        </TabsList>
        <TabsContent value="walkin">
          <CheckInForm rooms={rooms} preselectRoomId={preselectRoomId} />
        </TabsContent>
        <TabsContent value="booking">
          <ReservationForm initialRooms={reservationRooms} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
