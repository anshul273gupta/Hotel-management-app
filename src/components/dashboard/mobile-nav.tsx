"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { useRealtime } from "@/hooks/use-realtime";
import type { Role } from "@/lib/types";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.mobile && item.roles.includes(role));
  const [pendingRequests, setPendingRequests] = useState(0);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/service-requests/pending-count");
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data.count ?? 0);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  useRealtime((kind) => {
    if (kind === "requests-updated") fetchPending();
  });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 backdrop-blur md:hidden print:hidden">
      {items.map((item) => {
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
    </nav>
  );
}
