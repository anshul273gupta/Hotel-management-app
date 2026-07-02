"use client";

import Image from "next/image";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { UserMenu } from "@/components/dashboard/user-menu";
import { AutoBookingProcessor } from "@/components/dashboard/auto-booking-processor";
import { ServiceRequestAlert } from "@/components/dashboard/service-request-alert";
import { ArrivalCheckAlert } from "@/components/dashboard/arrival-check-alert";
import { PushNotificationSetup } from "@/components/dashboard/push-notification-setup";
import { RealtimeProvider } from "@/lib/realtime-context";
import type { SessionPayload } from "@/lib/auth";

export function DashboardShell({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  return (
    <RealtimeProvider>
    <div className="flex min-h-screen">
      <AutoBookingProcessor />
      <ServiceRequestAlert />
      <ArrivalCheckAlert />
      <PushNotificationSetup />
      <SidebarNav role={session.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6 print:hidden">
          <div className="flex items-center gap-2 md:hidden">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-sm ring-1 ring-border">
              <Image src="/logo.jpeg" alt="" fill className="object-cover" />
            </div>
            <span className="font-display text-base font-semibold">Hotel Agrawal Inn</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <NotificationBell />
            <UserMenu name={session.name} email={session.email} role={session.role} />
          </div>
        </header>
        <main className="flex-1 bg-gradient-to-br from-amber-50/80 via-yellow-50/50 to-orange-50/20 px-4 py-5 pb-24 md:px-6 md:py-6 md:pb-6 print:bg-none print:p-0 print:pb-0">{children}</main>
      </div>
      <MobileNav role={session.role} />
    </div>
    </RealtimeProvider>
  );
}
