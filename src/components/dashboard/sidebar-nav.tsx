"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getNavForRole, type NavItem } from "@/lib/nav";
import { usePendingRequestCount } from "@/hooks/use-pending-request-count";
import type { Role } from "@/lib/types";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = getNavForRole(role);
  const pendingRequests = usePendingRequestCount();

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:sticky md:top-0 md:flex md:h-screen md:flex-col print:hidden">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-5">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-sm ring-1 ring-border">
          <Image src="/logo.jpeg" alt="" fill className="object-cover" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-semibold">Hotel Agrawal Inn</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item: NavItem) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          const showDot = item.href === "/requests" && pendingRequests > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 shadow-sm dark:from-amber-500 dark:to-yellow-400 dark:text-amber-950"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {showDot && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {pendingRequests}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
