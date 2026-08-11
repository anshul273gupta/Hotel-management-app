import { redirect } from "next/navigation";
import { getSession, touchSession } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Keeps "last active" fresh on the owner's Devices page. Throttled inside,
  // so this is not a write on every page view.
  if (session.sessionId) await touchSession(session.sessionId);

  return <DashboardShell session={session}>{children}</DashboardShell>;
}
