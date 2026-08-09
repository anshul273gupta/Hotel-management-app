"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { usePendingRequestCount } from "@/hooks/use-pending-request-count";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Role } from "@/lib/types";

/** Tabs that fit along the bottom bar before the "More" button. */
const MAX_TABS = 4;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const pendingRequests = usePendingRequestCount();
  const [moreOpen, setMoreOpen] = useState(false);

  // Everything this role may see, in the order declared in nav.ts.
  const allowed = NAV_ITEMS.filter((item) => item.roles.includes(role));

  // The bar itself only has room for a handful of tabs, so the rest move into
  // a "More" sheet. Previously anything without `mobile: true` — Bookings
  // Calendar, QR Codes and the owner's Profit Dashboard — simply had no way of
  // being reached on a phone at all.
  const tabs = allowed.filter((item) => item.mobile).slice(0, MAX_TABS);
  const tabHrefs = new Set(tabs.map((t) => t.href));
  const overflow = allowed.filter((item) => !tabHrefs.has(item.href));

  const overflowActive = overflow.some((item) => isActive(pathname, item.href));

  return (
    // app-nav-safe pads by the gesture-bar height. It replaces a bare
    // env(safe-area-inset-bottom), which stays 0 inside the Android app —
    // there the value has to come from Capacitor's injected variable instead.
    <nav className="app-nav-safe fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 backdrop-blur md:hidden print:hidden">
      {tabs.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        const showDot = item.href === "/requests" && pendingRequests > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {showDot && (
                <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {pendingRequests}
                </span>
              )}
            </span>
            {item.label}
          </Link>
        );
      })}

      {overflow.length > 0 && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
              overflowActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </SheetTrigger>
          <SheetContent side="bottom" className="app-nav-safe">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="grid gap-1 px-4 pb-6">
              {overflow.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}
