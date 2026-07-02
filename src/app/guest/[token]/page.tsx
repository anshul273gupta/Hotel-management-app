import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ServiceRequestPage } from "@/components/guest/service-request-page";
import { HOTEL_NAME, HOTEL_PHONE } from "@/lib/whatsapp";

const SERVICE_START_HOUR = 10;
const SERVICE_END_HOUR = 21;

const pastelPinkStyle = {
  "--background": "oklch(0.96 0.02 350)",
  "--foreground": "oklch(0.25 0.05 350)",
  "--muted-foreground": "oklch(0.50 0.04 350)",
  "--primary": "oklch(0.65 0.18 350)",
} as React.CSSProperties;

function HotelCard({
  emoji,
  heading,
  subtext,
  showCall = true,
}: {
  emoji: string;
  heading: string;
  subtext: string;
  showCall?: boolean;
}) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-4"
      style={pastelPinkStyle}
    >
      <div className="max-w-sm w-full text-center space-y-5">
        {/* Hotel logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl shadow-md">
            <Image src="/logo.jpeg" alt={HOTEL_NAME} fill className="object-cover" />
          </div>
          <p className="font-display text-base font-semibold text-foreground">{HOTEL_NAME}</p>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <p className="text-4xl">{emoji}</p>
          <h1 className="font-display text-xl font-semibold text-foreground">{heading}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{subtext}</p>
        </div>

        {/* Call reception button */}
        {showCall && (
          <a
            href={`tel:+91${HOTEL_PHONE}`}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90 active:opacity-80"
            style={{ backgroundColor: "oklch(0.65 0.18 350)" }}
          >
            📞 Call Reception
          </a>
        )}
      </div>
    </main>
  );
}

export default async function GuestRoomPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const room = await prisma.room.findUnique({
    where: { qrToken: token },
    include: { bookings: { where: { status: "CHECKED_IN" }, take: 1 } },
  });

  if (!room) {
    return (
      <HotelCard
        emoji="❓"
        heading="Invalid QR Code"
        subtext="This QR code does not belong to any room. Please scan the QR code placed inside your room."
        showCall={false}
      />
    );
  }

  // Outside service hours
  const hour = new Date().getHours();
  if (hour < SERVICE_START_HOUR || hour >= SERVICE_END_HOUR) {
    return (
      <HotelCard
        emoji="🕙"
        heading="Service Hours Are Over"
        subtext={`Room service requests are accepted between 10:00 AM and 9:00 PM. For urgent needs, please call reception — we are always here for you.`}
      />
    );
  }

  // Room has no checked-in guest
  if (room.bookings.length === 0) {
    return (
      <HotelCard
        emoji="🛏️"
        heading="No Guest in This Room"
        subtext="This room currently has no checked-in guest. If you need assistance, please call reception."
      />
    );
  }

  return (
    <ServiceRequestPage
      roomToken={token}
      roomNumber={room.number}
      hotelName={HOTEL_NAME}
      receptionPhone={HOTEL_PHONE}
    />
  );
}
