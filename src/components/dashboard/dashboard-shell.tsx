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
        {/*
          The bar is padded by the status-bar height so the logo, bell and
          profile button sit below the phone's clock instead of under it.
          Height stays 4rem of usable space; the inset is added on top.
        */}
        <header className="app-header-safe sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur print:hidden">
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
        <main className="app-main-safe flex-1 bg-gradient-to-br from-amber-50/80 via-yellow-50/50 to-orange-50/20 px-4 py-5 md:px-6 md:py-6 print:bg-none print:p-0 print:pb-0">
          {children}
        </main>
      </div>
      <MobileNav role={session.role} />
    </div>
    </RealtimeProvider>
  );
}
