import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DevicesList } from "@/components/devices/devices-list";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const session = await getSession();
  // Checked here as well as in the API: the menu link is already hidden from
  // staff, but the address could still be typed in directly.
  if (!session || session.role !== "OWNER") redirect("/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Signed-in Devices
        </h1>
        <p className="text-sm text-muted-foreground">
          Every phone and computer currently signed in, for both logins.
        </p>
      </div>

      <DevicesList />
    </div>
  );
}
